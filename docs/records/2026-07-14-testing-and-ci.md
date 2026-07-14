# 自动化测试与 CI 基线

日期：2026-07-14

## 变更

- 引入 Vitest，并增加 `npm test` 与 `npm run test:watch` 脚本。
- 为寻路、地图配置、塔合成与等级规则、碰撞工具建立首批单元测试。
- 新增 GitHub Actions，在推送和拉取请求上执行 `npm ci`、lint、测试和构建。
- 在仓库约定、开发约定和 README 中同步测试要求与验证命令。

## 边界

当前测试在 Node 环境运行，主要保护无浏览器依赖的游戏规则。React 组件、Canvas 绘制和 `useGameEngine` 的完整状态转换尚未纳入自动化覆盖，后续应随引擎纯逻辑提取逐步补充。
