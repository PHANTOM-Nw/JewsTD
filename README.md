# 宝石 TD

一个使用 React、TypeScript 和 Canvas 实现的单机塔防小游戏，玩法参考经典宝石 TD：每轮随机建造宝石塔、保留其中一座、把其余塔转为障碍，并通过迷宫式布阵延长敌人的行进路线。

当前仓库已形成基础的 12 波可玩原型：每轮必须依次经过 `building → deciding → ready → playing`，放满 5 座随机塔并选择唯一一座保留后才能开波。原型包含 8 种基础宝石、6 种特殊合成塔、动态 BFS 寻路、10 金币清障、最终 Boss 波，以及暂停/继续、胜利/失败和重新开始。游戏地图、状态栏和操作面板支持手机窄屏布局，Canvas 会在保持内部逻辑分辨率的同时按可用宽度等比缩放。

战斗效果已接入多目标、暴击、溅射、邻近目标穿透、按配置比例减速、毒素和眩晕。当前 11 个测试文件、74 项测试保护配置、寻路、响应式 Canvas 点击换算、建造/波次状态、矿坑伤害和主要战斗规则；Chromium 最小交互验证覆盖首轮建造、强制五选一、开波、暂停冻结和继续恢复。完整第一波结算以及从第 1 波持续打到第 12 波胜利，尚未在浏览器中完成端到端实测，因此不应把当前验证范围理解为完整通关验收。

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
```

测试使用 Vitest，`npm run test:watch` 可在开发时持续监听。GitHub Actions 会在推送和拉取请求上使用 Node.js 20 执行安装、lint、测试和构建。

推送到 `main` 且上述检查全部通过后，GitHub Actions 会将同一次构建的 `dist/` 通过 SSH 和 rsync 自动更新到阿里云静态站点目录。服务器地址、端口、用户和目录来自 Actions Variables，私钥与已核验的主机指纹来自 Actions Secrets；workflow 不修改或重载 Nginx。首次启用前请按[阿里云静态站点部署](docs/development/deployment.md)配置 `production` Environment 和服务器权限。

## 目录

```text
src/
├── app/                   # React 应用壳
├── game/                  # 游戏功能域
│   ├── components/        # 游戏界面和 Canvas 组件
│   ├── config/            # 地图、塔、敌人和波次配置
│   ├── engine/            # 游戏状态、动作和帧循环
│   ├── pathfinding/       # BFS 寻路及 React 封装
│   ├── services/          # 音频等有状态服务
│   ├── types/             # 游戏领域类型
│   └── utils/             # 无状态通用计算
├── devtools/              # 未接入正式 UI 的手工检查组件
└── main.tsx               # 浏览器入口

docs/
├── architecture/          # 当前架构与数据流
├── development/           # 开发约定
├── product/               # 当前玩法和原作调研
├── reference/             # 配置、算法参考
└── records/               # 变更记录与历史生成报告

.github/workflows/         # GitHub Actions 自动化验证
```

## 文档入口

- [文档导航](docs/README.md)
- [当前玩法](docs/product/gameplay.md)
- [架构概览](docs/architecture/overview.md)
- [游戏配置入口](docs/reference/game-configuration.md)
- [开发约定](docs/development/conventions.md)
- [阿里云静态站点部署](docs/development/deployment.md)
- [本次项目整理记录](docs/records/2026-07-14-project-initialization.md)
- [基础 12 波可玩原型记录](docs/records/2026-07-14-playable-12-wave-prototype.md)

代码内的 `src/game/config/` 是运行时数值的唯一事实来源；文档用于解释配置，不复制整份数值表。
