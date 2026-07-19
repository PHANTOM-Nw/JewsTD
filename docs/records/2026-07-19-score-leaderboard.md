# 分数系统与休闲排行榜

## 背景

麻将 TD 的金币只承担拆墙经济，无法表达玩家一局中的击杀和构筑成果。本次在不改变 12 波主循环、牌实体归属或经济平衡的前提下，增加独立分数、终局匿名上传和全服排行榜，并把排行榜 API 纳入现有阿里云部署流程。

用户确认明刻（碰）得分为 300，并要求日常部署 workflow 同步发布排行榜服务。现有静态站配置继续保留；新增服务允许一次受控的服务器初始化，不让日常 CI 每次以高权限重写 Nginx 或 systemd。

## 发现

- 敌人可能被直接命中、毒、灼烧或处决杀死，击杀分必须与唯一死亡结算绑定，不能在各伤害分支分别累加。
- 合成已有原子事务结果，只有成功提交后的产物形态可以计分；预览和失败事务不得消耗资源或产生分数。
- 当前游戏没有账号体系。匿名名称允许重名，排行榜按对局而不是按玩家账号去重。
- 浏览器掌握随机数和战斗状态。服务端可以重算分数、检查合理上限，并把同一对局的网络重试收敛为幂等重放，但不能仅凭汇总计数证明一局真实发生，因此该榜只能定位为休闲榜。
- 现有生产环境只发布静态 `dist/`。SQLite 数据必须位于前端和 API 发布目录之外，否则 rsync 的删除行为会威胁运行数据。

## 决定与变更

### v1 计分

计分版本为 `v1`，分数独立于金币：

| 事件 | 分数 |
| --- | ---: |
| 基础敌人击杀 | 10 |
| 快速敌人击杀 | 20 |
| 坦克敌人击杀 | 50 |
| Boss 击杀 | 500 |
| 合成对子 | 100 |
| 合成顺子（吃） | 200 |
| 合成明刻（碰） | 300 |
| 合成杠 | 400 |

每次敌人首次死亡计一次击杀分。每次成功合成按本次产物计分，连续升级累计各步分数；例如 `单牌 → 对子 → 明刻 → 杠` 合计 800 合成分。进入 `victory` 或 `game_over` 后冻结总分、两类分项和事件计数，重新开局归零。

浏览器配置与纯累加函数位于 `src/game/config/scoring.ts`，状态类型位于 `src/game/types/game.ts`，引擎在 `src/game/engine/useGameEngine.ts` 的统一死亡奖励和成功合成路径更新分数。服务端在 `server/src/scoring.ts` 保留同版本的独立权威分值，用提交的事件计数重新计算分项和总分。

### 终局提交与榜单

胜利和失败都可以在终局面板手动提交；普通手动重开和终局“再来一局”都不自动上传旧局，并会申请新的对局凭据。首次挂载会向 `POST /api/runs` 申请 `runId`、短期 `submissionToken` 和 `scoringVersion`。默认令牌有效期为 24 小时，每个 `runId` 只创建一条成绩，服务端只保存令牌哈希。首次有效提交返回 HTTP 201；同 `runId` 和有效令牌重放返回 HTTP 200 以及原成绩和当前名次，即使重放载荷中的名称或分数不同也不会覆盖已存结果。错误令牌仍会被拒绝。

公开名称经过去除首尾空白和 NFC 规范化后必须为 1～16 个 Unicode 字符，不允许控制或格式字符；不同对局可以使用相同名称。终局提交携带冻结的分数明细、`victory | game_over`、波次、矿坑生命、从本局开始时起计算的局时、客户端版本和计分版本。

`GET /api/leaderboard?limit=10&runId=<id>` 返回当前计分版本 Top 10 和可选的本局实际名次。本局未进入 Top 10 时仍可通过 `self` 显示名次。同分按成绩创建时间、数据库行 ID 的先后稳定排序。

浏览器接口封装在 `src/game/services/leaderboard.ts`，终局交互在 `src/game/components/GameResultPanel.tsx` 与 `TowerDefenseGame.tsx` 装配。API 创建、查询或提交失败只显示不可用或重试状态，不阻塞本地计分、战斗、终局或重开；已经冻结的终局局时不会因重试连接继续增长。

### Node + SQLite API

API 位于 `server/src/`，使用 Node HTTP 和 `better-sqlite3`，提供：

- `POST /api/runs`
- `POST /api/scores`
- `GET /api/leaderboard`
- `GET /api/health`

详细 JSON 和错误码契约见 `server/README.md`。数据库迁移与进程启动分别使用 `npm run server:migrate` 和 `npm run server:start`。文件数据库启用外键、WAL、busy timeout 和迁移表；榜单按 `scoringVersion` 隔离。数据库迁移 v2 为 `runs(submitted_at, expires_at)` 增加索引；每次创建 run 时在同一事务内最多删除 100 条过期未提交 run，已提交 run 及其成绩保留，从而控制清理成本并避免历史空 run 无限增长。

服务端校验字段类型和范围、名称、令牌、计分版本、胜负/波次关系、分项重算及按波次事件计数上限，并限制请求体与单位客户端地址的请求频率。唯一 run 归属与幂等重放保证每局至多一条成绩。合成次数上限为 `(wave - 1) + 2 × floor(wave / 2)`：第一项覆盖消耗其他激活塔的合成，后两项分别宽松覆盖偶数轮最多获得的白和对子吸收牌墙再升级产生的额外合成；例如第 2 波前合法的 `pair → 牌墙 pung → white kong` 三连合成不会被拒绝。这些措施只防止错误数据和简单伪造；确定性随机、完整事件日志和服务端回放不在本次范围内。

### 首次初始化与自动/手动部署

`deploy/bootstrap.sh` 是排行榜首次上线的一次性入口，默认创建：

- API 发布目录 `/opt/JewsTD/api`
- 数据目录 `/var/lib/jewstd` 与数据库 `/var/lib/jewstd/leaderboard.sqlite`
- 环境文件 `/etc/jewstd/leaderboard.env`
- systemd 服务 `jewstd-leaderboard.service`
- 只允许发布用户重启和检查该服务的 sudoers 规则

脚本可重复运行但不删除数据，也不会在首个 API 产物存在前启动服务。`deploy/nginx/jewstd-api-location.conf.example` 必须由管理员人工合并到现有 HTTPS `server` 块，经 `nginx -t` 后重载；这样可以保留现有域名、TLS 和静态站配置。API 默认只监听 `127.0.0.1:3001`。

自动 `.github/workflows/ci.yml` 和手动 `.github/workflows/deploy-branch.yml` 沿用同一组 SSH Variables 与 Secrets，并支持 `API_DEPLOY_PATH`、`API_DATABASE_PATH`、`API_SERVICE_NAME`、`API_HEALTH_URL` 四个可选 Variable。`main` 推送自动发布；手动 workflow 重新检出、检查并构建操作员选择的 ref，可用于分支验收或代码回滚。两个入口都会同步 API、安装生产依赖、执行幂等迁移、重启并检查 systemd、从服务器 loopback 验证 `/api/health`，成功后才同步同一 ref 的前端。

手动回滚不会恢复数据库或执行 schema 降级，持久数据库也不属于任何 rsync 目标；发布历史 ref 前必须确认 API 与当前 schema 兼容，备份与恢复由服务器运维另行配置。自动与手动 workflow 的生产 `deploy` job 共享 `production-deploy` concurrency group，且都使用 `cancel-in-progress: false`，因此生产变更强制串行并且不会中途取消正在执行的发布。

## 验证

- 计分纯函数和引擎回归应覆盖四类击杀、四种合成、连续升级、唯一死亡计分、终局冻结与重开归零。
- API 回归应覆盖健康检查、服务端重算、名称校验、无效/过期令牌、首次 201 与重放 200 的幂等语义、重放不覆盖、迁移 v2 索引、每次最多清理 100 条过期未提交 run、版本隔离、合理上限、排序、Top 10 和本人名次。
- UI 回归应覆盖名称 Unicode 长度、提交状态、排行榜空/错/重试、API 不可用降级和重新开局。
- 文档变更已执行 `git diff --check -- docs README.md`；完整仓库由主任务执行 `npm run lint`、`npm test`、`npm run build` 和 `npm run build:server`。

## 后续事项

- 为 SQLite 配置独立于发布流程的定期一致性备份和恢复演练。
- 上线后根据真实通关数据评估 v1 分值；调整规则时发布新的 `scoringVersion`，不把不同规则成绩混入同一榜。
- 如果排行榜转为竞技用途，需要引入服务端可验证事件日志或确定性回放，并重新定义信任和隐私边界。
