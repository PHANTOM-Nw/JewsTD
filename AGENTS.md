# 宝石 TD 仓库约定

## 项目目标

这是一个参考经典宝石 TD 玩法的 React + TypeScript + Canvas 单机小游戏。优先保持一局游戏的核心循环可玩：随机建塔、五选一、迷宫寻路、波次战斗、合成成长。

## 修改前先读

- `README.md`
- `docs/architecture/overview.md`
- `docs/development/conventions.md`
- 涉及玩法时阅读 `docs/product/gameplay.md`

## 多代理协作

- 主 agent 主要负责目标拆解、规划、分析、任务调度、冲突协调和最终验收。
- 涉及仓库文件读取、代码或文档写入、测试、构建和运行验证等操作，原则上派 subagent 执行。
- 主 agent 仅在无法委派、需要紧急处理冲突或进行最终轻量核验时直接操作，并说明原因。
- subagent 应按分配范围执行并报告修改、验证结果和潜在冲突；未经调度不得扩大修改范围。

## 代码边界

- 应用装配放 `src/app/`。
- 游戏代码放 `src/game/`，按最具体职责选择子目录。
- 手工检查和未接入正式界面的工具放 `src/devtools/`，生产入口不得导入它们。
- 游戏数值以 `src/game/config/` 为唯一事实来源。
- UI 组件不得直接修改 `useGameEngine` 的内部 state；新增行为应通过引擎动作暴露。
- 不在缺少回归测试时整体重写 `useGameEngine`，优先小步提取纯函数。

## 风格与验证

- TypeScript 使用 2 空格、单引号、无分号；类型使用 `import type`。
- 不通过禁用 lint 规则绕过 Hook 依赖和类型问题。
- 每次代码变更至少运行 `npm run lint`、`npm test` 和 `npm run build`。
- 玩法、公共接口或目录变化必须同步当前文档；一次性记录放 `docs/records/YYYY-MM-DD-topic.md`。
- `docs/records/archive/` 是历史材料，除添加归档说明外不要把它当作当前规范维护。

## 测试约定

- 单元测试使用 Vitest，测试文件与被测模块同目录，命名为 `*.test.ts` 或 `*.test.tsx`。
- 修改寻路、碰撞、合成、资源结算、波次状态或其他玩法规则时，必须新增或更新对应测试。
- 修复缺陷时优先添加能够复现问题的回归测试。
- 测试必须可重复；随机数、计时器、`requestAnimationFrame`、音频和浏览器 API 应固定或模拟。
- 优先断言输入输出和状态变化，避免依赖内部实现细节；快照不能替代关键行为断言。
- `src/devtools/` 中的手工检查不能替代自动化测试。
