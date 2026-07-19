# 阿里云前端与排行榜 API 部署

生产部署有两个入口：`.github/workflows/ci.yml` 在每次推送到 `main` 后自动发布，`.github/workflows/deploy-branch.yml` 通过 `workflow_dispatch` 手动发布操作员选中的 ref，可用于分支验收或回滚到历史 ref。两个入口都会使用 Node.js 20 安装依赖并执行 lint、测试、前端构建和排行榜 API 构建；全部通过后才会依次部署 API 与前端，不会直接发布已有的未知来源产物。

现有静态站点不需要重新初始化。排行榜首次上线前需要额外执行一次 `deploy/bootstrap.sh`，并把同域 `/api` 反向代理片段人工合并进现有 Nginx HTTPS `server` 块。此后日常 CI 负责 API 发布、数据库迁移、systemd 重启、健康检查和前端同步，不会反复修改 Nginx、systemd 或持久数据目录。

## GitHub Actions 配置

继续在仓库的 `production` Environment 中配置原有 Actions Variables：

| 名称 | 示例 | 用途 |
| --- | --- | --- |
| `DEPLOY_HOST` | `game.example.com` | 阿里云服务器的 DNS 名称或 IPv4 地址 |
| `DEPLOY_PORT` | `22` | SSH 端口 |
| `DEPLOY_USER` | `jewstd-deploy` | 发布用户，也是 API systemd 服务运行用户 |
| `DEPLOY_PATH` | `/opt/JewsTD/dist` | 前端静态产物目录，必须位于 `/opt/JewsTD/` 下 |

排行榜部署支持以下可选 Variables；未配置时使用表中默认值：

| 名称 | 默认值 | 用途 |
| --- | --- | --- |
| `API_DEPLOY_PATH` | `/opt/JewsTD/api` | API 发布目录，必须与前端目录不同 |
| `API_DATABASE_PATH` | `/var/lib/jewstd/leaderboard.sqlite` | 持久化 SQLite 文件，必须位于 `/var/lib/` 下 |
| `API_SERVICE_NAME` | `jewstd-leaderboard.service` | bootstrap 创建且 CI 可以受限重启的 systemd 服务 |
| `API_HEALTH_URL` | `http://127.0.0.1:3001/api/health` | 服务器本机健康检查地址 |

Secrets 仍使用原有名称：

| 名称 | 内容 |
| --- | --- |
| `DEPLOY_SSH_PRIVATE_KEY` | 发布专用、无交互口令的 SSH 私钥 |
| `DEPLOY_KNOWN_HOSTS` | 已核验指纹的目标服务器 `known_hosts` 条目 |

仓库级 Variables 和 Secrets 也能被 workflow 读取，但优先使用 `production` Environment，便于配置审批规则和限制生产配置作用域。不要把私钥、主机指纹、服务器地址或数据库提交到仓库。

`DEPLOY_PATH` 必须与现有 Nginx 静态站点的 `root` 完全一致。`API_DEPLOY_PATH`、`API_DATABASE_PATH`、`API_SERVICE_NAME` 和 `API_HEALTH_URL` 必须与 bootstrap 使用的值一致；如果自定义 API 端口，还要同步 systemd 环境文件、健康检查 URL 和 Nginx 上游端口。

`DEPLOY_KNOWN_HOSTS` 应从可信环境生成，并通过阿里云控制台或已有可信连接独立核对主机密钥指纹。例如默认 SSH 端口可先获取候选条目：

```bash
ssh-keyscan -H example.com
```

非默认端口使用 `ssh-keyscan -H -p <端口> <主机>`。`ssh-keyscan` 的输出本身不能证明服务器身份，核对指纹后再保存为 Secret。workflow 启用 `StrictHostKeyChecking`，不会在运行时自动接受新主机密钥。

## 排行榜首次 bootstrap

服务器需已有 Node.js 20 或更高版本、npm、OpenSSH Server、rsync、curl、Nginx、systemd 和 `visudo`。现有静态发布用户与 SSH 公钥配置继续复用，不需要创建第二个发布账号。

从服务器上的可信仓库检出中审阅并运行：

```bash
sudo DEPLOY_USER=jewstd-deploy \
  API_ROOT=/opt/JewsTD/api \
  DATA_DIR=/var/lib/jewstd \
  SERVICE_NAME=jewstd-leaderboard.service \
  bash deploy/bootstrap.sh
```

脚本可重复执行，负责：

1. 创建 `/opt/JewsTD/api` API 发布目录和 `/var/lib/jewstd` 持久数据目录，并交给发布用户。
2. 写入 `/etc/jewstd/leaderboard.env`，默认配置 `API_HOST=127.0.0.1`、`API_PORT=3001`、`DATABASE_PATH=/var/lib/jewstd/leaderboard.sqlite`、`RUN_TTL_MS=86400000`。
3. 从示例生成 `/etc/systemd/system/jewstd-leaderboard.service`，执行 `daemon-reload` 并启用服务；首次 API 产物尚未发布时不会提前启动。
4. 写入 `/etc/sudoers.d/jewstd-leaderboard-deploy`，只允许发布用户无交互执行该服务的 `restart` 和 `is-active --quiet`。

systemd 服务以发布用户运行，启用 `NoNewPrivileges`、私有临时目录和只读系统保护，只把持久数据目录列入可写路径。bootstrap 不删除数据库，也不会授予发布用户修改任意 systemd 服务的权限。

bootstrap 不会猜测或覆盖现有 TLS、域名和静态站点配置。把 `deploy/nginx/jewstd-api-location.conf.example` 中的 `location /api/` 人工合并进当前 HTTPS `server` 块，再执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

该位置把同域 `/api/` 转发到 `127.0.0.1:3001`，并传递真实客户端地址供 API 限流。API 应保持只监听 loopback，不直接向公网开放 3001 端口。

## 自动、手动与回滚发布

推送到 `main` 时，`ci.yml` 自动构建并发布该提交。需要发布其他 ref 时，在 GitHub Actions 的 “Manual deploy” workflow 中选择目标 ref 后运行；命令行也可以为 workflow dispatch 指定包含该 workflow 的分支或标签。回滚同样选择指向目标历史提交的 ref，并从该提交重新执行完整质量检查和构建，不复用旧 Actions artifact。

手动入口不是“仅回滚前端”：所选 ref 的 API 与前端会作为一组重新构建和发布，仍然先完成 API 生产依赖安装、迁移、重启和健康检查，随后才更新前端。数据库文件与榜单成绩不会随代码 ref 回滚；迁移只向前执行，不做降级或恢复。因此发布旧 ref 前必须确认其 API 能读取当前数据库 schema，真正需要恢复数据或降级 schema 时应停止 workflow，按独立数据库恢复流程处理。

质量任务会构建同一提交的前端 `dist/` 和 `server/dist/`，并分别上传短期 artifact。生产任务按以下顺序执行：

1. 校验 SSH、前端/API 发布路径、数据库路径、systemd 服务名和 loopback 健康检查 URL。
2. 确认前端与 API 目录已存在、可写、可进入且不是符号链接。
3. 用 rsync 把 API 编译产物、`package.json` 和锁文件同步到 `API_DEPLOY_PATH`。
4. 在服务器执行 `npm ci --omit=dev`，以 `API_DATABASE_PATH` 运行幂等 `server:migrate`。
5. 通过 bootstrap 授予的受限 sudo 重启 API，检查 systemd 为 active，再从服务器本机轮询 `/api/health`。
6. API 健康后才用 rsync 更新前端 `dist/`。

前端和 API rsync 都使用延迟删除与延迟更新，并统一发布文件权限。自动与手动 workflow 的生产 `deploy` job 共享 `production-deploy` concurrency group，并都设置 `cancel-in-progress: false`；所有生产发布会强制排队串行，已经开始的 API 迁移、重启或 rsync 不会被另一发布取消。质量任务可以并行执行，但只有取得该共享锁的部署任务能修改服务器。workflow 不修改 `/etc/nginx/`、`/etc/systemd/`、`/etc/jewstd/` 或 sudoers；这些仍属于首次初始化和受控运维范围。

## 数据与备份边界

生产数据库默认位于 `/var/lib/jewstd/leaderboard.sqlite`，不在 `/opt/JewsTD/api` 或前端 `dist` 下，也不是 rsync 目标。API 对文件数据库启用 WAL，因此运维备份必须同时考虑 SQLite 主文件及 WAL 状态，优先使用 SQLite 的在线备份能力或在一致性窗口内备份；不要只复制一个可能正在写入的主文件。

自动与手动 workflow 都只做向前迁移，不负责备份、恢复、schema 降级或清理历史成绩。上线前应由服务器运维另行配置定期备份和恢复演练。重新运行 bootstrap、自动发布、手动发布或代码回滚都不得删除 `/var/lib/jewstd`。

## 故障处理

质量检查、SSH 主机校验、目录校验、依赖安装、迁移、systemd 状态或健康检查任一步失败，本次部署即失败。API 健康检查通过前不会更新前端，因此已有静态站仍保留上一版本；排行榜不可用时游戏本身也会降级为仅本地计分，仍可完成对局和重新开始。

排查 API 时优先检查：

```bash
sudo systemctl status jewstd-leaderboard.service
sudo journalctl -u jewstd-leaderboard.service
curl --fail http://127.0.0.1:3001/api/health
```

如果修改了 Nginx 片段，先运行 `nginx -t` 再重载。修复配置或权限后，自动发布可重新运行对应的 `ci.yml` 失败任务，手动/回滚发布应确认所选 ref 后重新运行 “Manual deploy”；日常静态文件变化不需要重载 Nginx。
