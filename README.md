# 宝石 TD

一个使用 React、TypeScript 和 Canvas 实现的单机塔防小游戏，玩法参考经典宝石 TD：每轮随机建造宝石塔、保留其中一座、把其余塔转为障碍，并通过迷宫式布阵延长敌人的行进路线。

当前仓库处于可运行原型阶段，已实现 8 种基础宝石、6 种特殊合成塔、动态 BFS 寻路、12 个波次、战斗循环、资源和矿坑生命系统。

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
npm run build
```

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
```

## 文档入口

- [文档导航](docs/README.md)
- [当前玩法](docs/product/gameplay.md)
- [架构概览](docs/architecture/overview.md)
- [游戏配置入口](docs/reference/game-configuration.md)
- [开发约定](docs/development/conventions.md)
- [本次项目整理记录](docs/records/2026-07-14-project-initialization.md)

代码内的 `src/game/config/` 是运行时数值的唯一事实来源；文档用于解释配置，不复制整份数值表。
