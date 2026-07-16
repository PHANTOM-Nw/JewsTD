# 麻将 TD 仓库约定

## 项目目标

这是一个 React + TypeScript + Canvas 单机麻将塔防游戏。当前优先保证 12 波核心循环可玩：摸取暗牌、拖放 3 张、三选一激活、生成牌墙、处理手牌、迷宫寻路和波次战斗。

当前运行时以麻将牌流为准。仓库中仍有旧宝石配置、类型、合成组件和兼容渲染代码；除非任务明确要求，不要据此恢复或扩展旧宝石玩法。

## 修改前先读

- 文档导航与事实来源：`docs/README.md`
- 当前玩法：`docs/product/gameplay.md`
- 架构与约定：`docs/architecture/overview.md`、`docs/development/conventions.md`
- 项目入口与命令：`README.md`
- 修改麻将牌流时：`docs/product/麻将TD核心流程方案_v0.2.md`
- 修改未来合成、花色能力或中发白效果时：`docs/product/composite.md`

事实来源优先级为：可执行源码和类型 > 当前架构、产品与参考文档 > `docs/records/` > `docs/records/archive/`。`README.md` 和架构文档目前仍有部分旧宝石描述；冲突时以源码和类型为准，并在任务范围内同步修正文档。

`docs/product/composite.md` 是持续讨论稿，不等于已实现需求；未获明确确认时不得把其中规则直接接入游戏。

## 多代理协作

- 主 agent 负责目标拆解、任务调度、冲突协调和最终验收。
- 仓库读取、代码或文档写入、测试、构建和运行验证原则上交给 subagent。
- subagent 只修改分配范围，报告改动、验证结果和潜在冲突，不得擅自扩大任务。
- 主 agent 仅在无法委派、处理冲突或进行最终轻量核验时直接操作，并说明原因。

## 玩法与信息边界

- 主流程为 `building → deciding → resolving_hand → ready → playing`，另有 `paused`、`game_over` 和 `victory`。
- 108 张数牌是有唯一 ID 的实体；牌池、回合牌、手牌、激活塔和牌墙之间的转移不得复制或丢失实体。
- 新摸暗牌在规则允许前不得向 UI、预览、可访问性文本或日志泄露花色和点数；旧手牌只公开花色。
- 落地后必须公开准确牌面，并在地图、决策界面和牌墙中保持同一实体身份。
- 万、条、筒 1～9 的 React 与 Canvas 展示必须使用确定性牌面配置，不得用随机图案或近似占位替代。
- 当前激活数牌使用统一中性战斗参数；未实现的花色差异、升级、吃碰杠和功能牌效果不得提前提供入口。

## 代码边界

- 应用装配放 `src/app/`；游戏代码放 `src/game/` 的最具体子目录。
- 手工检查工具放 `src/devtools/`，生产入口不得导入。
- 游戏数值以 `src/game/config/` 为唯一事实来源；麻将牌池、牌面和当前基础战斗参数集中在 `mahjong.ts`。
- UI 组件不得直接修改 `useGameEngine` 内部状态；新增行为通过引擎动作暴露。
- 不整体重写 `useGameEngine`；优先提取纯函数并补充回归测试。
- 现有 `wood`、`tower`、`obstacle` 等旧内部命名可能仍承担兼容职责，不做无测试保护的大范围重命名。

## 风格与验证

- 项目使用 Node.js 20 或更高版本；不要在约定中固定易过期的依赖版本。
- TypeScript 使用 2 空格、单引号、无分号；类型使用 `import type`。
- 不通过禁用 lint 规则绕过 Hook 依赖和类型问题。
- 每次代码变更至少运行 `npm run lint`、`npm test` 和 `npm run build`。
- 玩法、公共接口或目录变化必须同步当前文档；一次性记录放 `docs/records/YYYY-MM-DD-topic.md`。
- `docs/records/archive/` 是历史材料，不作为当前规范维护。

## 测试约定

- 使用 Vitest；测试与被测模块同目录，命名为 `*.test.ts` 或 `*.test.tsx`。
- 修改牌池、抽牌、信息可见性、拖放、三选一、牌墙归属、手牌处理、中发白赌博、寻路、碰撞、资源结算或波次状态时，必须新增或更新测试。
- 修复缺陷时优先添加能复现问题的回归测试。
- 随机数、计时器、`requestAnimationFrame`、音频和浏览器 API 必须固定或模拟。
- 优先断言公开输入输出和状态变化；快照与 `src/devtools/` 手工检查不能替代关键行为断言。
