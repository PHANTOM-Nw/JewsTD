# 麻将 TD

一个使用 React、TypeScript 和 Canvas 实现的单机麻将塔防游戏。当前运行时围绕 12 波核心循环展开：摸取暗牌、拖放 3 张、三选一激活、生成牌墙、处理手牌、构筑迷宫并完成波次战斗。可选的 Node + SQLite 服务提供匿名休闲排行榜；服务不可用时本地对局仍可完整运行。

数牌使用 108 张具有唯一身份的万、条、筒实体。落地后会生成花色区间内的随机伤害、攻击间隔和攻击距离；万、条、筒分别以暴击、毒素和减速为基础机制。场上持久棋子可以合成对子、顺子、明刻和杠，中、發可附着产生额外战斗效果，白可在吃、碰或杠中补足缺牌。普通牌墙与纯墙体分别花费 100 和 50 金币拆除。

当前 `v1` 分数由击杀分和成功合成分组成，胜利与失败都可在终局用 1～16 个 Unicode 字符的匿名公开名称提交。排行榜显示当前计分版本 Top 10 和本局实际名次；完整规则见[当前玩法](docs/product/gameplay.md)。

仓库仍保留旧宝石类型、配置、素材和兼容组件，但生产入口不开放宝石品质、特殊宝石配方或旧宝石合成玩法。

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm ci
npm run dev
```

默认访问 `http://localhost:5173/`。

提交代码前至少执行：

```bash
npm run lint
npm test
npm run build
npm run build:server
```

测试使用 Vitest，`npm run test:watch` 可在开发时持续监听。GitHub Actions 会在推送和拉取请求上执行安装、lint、测试和构建。

排行榜 API 可单独构建、迁移和启动：

```bash
npm run build:server
DATABASE_PATH=/tmp/jewstd.sqlite npm run server:migrate
DATABASE_PATH=/tmp/jewstd.sqlite npm run server:start
```

API 默认监听 `127.0.0.1:3001`。浏览器客户端使用同域 `/api`；本地只启动 Vite 时排行榜会自动降级，不影响游戏。接口与环境变量见 [server/README.md](server/README.md)。

推送到 `main` 且检查通过后，部署 workflow 会发布同一次提交的排行榜 API 与前端：先迁移、重启并验证 API，再更新静态 `dist/`。现有静态站无需重新初始化；排行榜首次上线需要运行一次 bootstrap 并人工合并 Nginx `/api` 片段，详见[阿里云前端与排行榜 API 部署](docs/development/deployment.md)。

## 目录

```text
src/
├── app/                   # React 应用装配
├── game/
│   ├── components/        # 游戏界面、麻将决策和 Canvas 组件
│   ├── assets/            # 地图、敌人及兼容素材
│   ├── config/            # 麻将、经济、地图、敌人和波次配置
│   ├── engine/            # 状态动作、麻将规则和战斗帧
│   ├── pathfinding/       # 多段 BFS
│   ├── rendering/         # Canvas 场景与状态反馈
│   ├── services/          # 音频等有状态服务
│   ├── types/             # 游戏领域类型
│   └── utils/             # 无状态通用计算
├── devtools/              # 不接入生产入口的手工检查工具
└── main.tsx               # 浏览器入口

server/
└── src/                    # 排行榜 HTTP、校验、计分复算与 SQLite 持久化

deploy/
├── bootstrap.sh            # 服务器排行榜一次性初始化
├── nginx/                  # 同域 /api 反向代理片段
└── systemd/                # 排行榜服务单元模板

docs/
├── architecture/          # 当前架构与数据流
├── development/           # 开发与部署约定
├── product/               # 当前玩法和产品规则
├── reference/             # 配置与算法参考
└── records/               # 变更记录与历史归档
```

## 文档入口

- [文档导航](docs/README.md)
- [当前玩法](docs/product/gameplay.md)
- [合成、差异攻击与功能牌](docs/product/composite.md)
- [架构概览](docs/architecture/overview.md)
- [游戏配置入口](docs/reference/game-configuration.md)
- [开发约定](docs/development/conventions.md)
- [阿里云前端与排行榜 API 部署](docs/development/deployment.md)
- [分数与排行榜实现记录](docs/records/2026-07-19-score-leaderboard.md)
- [麻将合成机制实现记录](docs/records/2026-07-16-mahjong-composite-mechanics.md)

运行时数值以 `src/game/config/` 为唯一事实来源；文档解释规则和边界，不复制整份配置实现。
