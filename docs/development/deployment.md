# 阿里云静态站点部署

生产部署由 `.github/workflows/ci.yml` 管理。每次推送到 `main` 后，GitHub Actions 会先使用 Node.js 20 执行 `npm ci`、lint、测试和构建；只有这些步骤全部通过，才会把同一次构建生成的 `dist/` 通过 SSH 和 rsync 同步到阿里云服务器。

部署任务只更新静态产物，不覆盖 `/etc/nginx/conf.d/jewstd.conf`，也不会执行 Nginx 配置检查或重载。静态文件变化不需要重载 Nginx；Nginx 配置应由服务器运维流程单独管理。

## GitHub Actions 配置

在仓库的 `production` Environment 中配置以下 Actions Variables：

| 名称 | 示例 | 用途 |
| --- | --- | --- |
| `DEPLOY_HOST` | `game.example.com` | 阿里云服务器的 DNS 名称或 IPv4 地址 |
| `DEPLOY_PORT` | `22` | SSH 端口 |
| `DEPLOY_USER` | `jewstd-deploy` | 仅用于发布的 SSH 用户 |
| `DEPLOY_PATH` | `/opt/JewsTD/dist` | 静态产物目标目录，必须位于 `/opt/JewsTD/` 下 |

`DEPLOY_PATH` 必须与 `/etc/nginx/conf.d/jewstd.conf` 中生效的 `root` 目录完全一致。路径由 Variable 提供，workflow 不硬编码实际 Nginx root；示例假设配置为 `root /opt/JewsTD/dist;`。

再配置以下 Actions Secrets：

| 名称 | 内容 |
| --- | --- |
| `DEPLOY_SSH_PRIVATE_KEY` | 发布专用、无交互口令的 SSH 私钥 |
| `DEPLOY_KNOWN_HOSTS` | 已核验指纹的目标服务器 `known_hosts` 条目 |

仓库级 Variables 和 Secrets 也能被 workflow 读取，但优先使用 `production` Environment，便于配置审批规则和限制生产配置的作用域。不要把私钥、主机指纹或服务器地址提交到仓库。

`DEPLOY_KNOWN_HOSTS` 应从可信环境生成，并通过阿里云控制台或已有可信连接独立核对主机密钥指纹。例如默认 SSH 端口可先获取候选条目：

```bash
ssh-keyscan -H example.com
```

非默认端口使用 `ssh-keyscan -H -p <端口> <主机>`。`ssh-keyscan` 的输出本身不能证明服务器身份，核对指纹后再保存为 Secret。workflow 会启用 `StrictHostKeyChecking`，且不会在运行时自动接受新主机密钥。

## 服务器一次性准备

服务器需要安装 OpenSSH Server 和 rsync。建议创建不具备 sudo 权限的专用发布用户，只授予目标目录写权限；Nginx 只需要对静态目录具备读取和目录遍历权限。例如由管理员一次性创建目标目录：

```bash
sudo install -d -o jewstd-deploy -g jewstd-deploy -m 0755 /opt/JewsTD/dist
```

把与 `DEPLOY_SSH_PRIVATE_KEY` 配对的公钥加入发布用户的 `~/.ssh/authorized_keys`。OpenSSH 支持时可在公钥前添加 `restrict`，禁止端口转发、代理转发、X11、PTY 和用户 rc，同时保留 rsync 所需的远程命令能力：

```text
restrict ssh-ed25519 AAAA... github-actions-deploy
```

不要授予发布用户修改 `/etc/nginx/conf.d/jewstd.conf`、重载 Nginx 或写入 `/opt/JewsTD/` 其他目录的权限。首次启用前，应确认：

1. `DEPLOY_PATH` 已存在、不是符号链接，且发布用户对目录有写入与进入权限。
2. Nginx 配置的 `root` 与 `DEPLOY_PATH` 相同。
3. Nginx 运行用户能够读取该目录内的文件。
4. 防火墙和阿里云安全组只向所需来源开放 SSH 和 Web 端口。

## 发布行为与故障处理

同一分支的 Actions 串行执行，`main` 上已开始的生产部署不会被新提交中途取消。rsync 使用延迟删除和延迟更新，上传成功后再应用替换与删除，并把文件权限统一为目录 `0755`、文件 `0644`。

如果质量检查、SSH 主机校验、远程目录检查或 rsync 任一步失败，本次部署会失败。先根据 Actions 日志修复配置或服务器权限，再重新运行失败的 workflow；不需要通过 workflow 重载 Nginx。
