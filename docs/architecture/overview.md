# 架构概览

## 总体结构

项目采用单一 React 前端，没有后端和持久化层。界面由 React 组件组织，地图和战斗对象使用 Canvas 绘制，游戏更新由 `requestAnimationFrame` 驱动。

```text
main.tsx
  └─ app/App.tsx
      └─ game/components/TowerDefenseGame.tsx
          ├─ UI 组件
          ├─ rendering/canvasRenderer.ts
          │   └─ rendering/spriteRegistry.ts → assets/*
          └─ game/engine/useGameEngine.ts
              ├─ config/*
              ├─ engine/gameFlow.ts
              ├─ engine/combat.ts
              ├─ pathfinding/*
              ├─ services/audio.ts
              └─ useGameLoop.ts
```

## 状态模型

`useGameEngine` 有意把状态分成两类：

- `uiState` 使用 React state，保存剩余建造次数、金币、矿坑生命、波次、阶段和游戏等级等需要触发界面更新的数据。运行时字段仍保留 `wood` 命名，界面与玩法语义统一为“剩余建造”。
- `gameStateRef` 使用 ref，保存敌人、塔、子弹、伤害数字、网格、真实路径、候选落塔预览和生成队列等高频变化对象，避免每帧触发 React 重渲染。

外部组件只调用引擎暴露的动作，例如放置塔、删除障碍、合成和开始波次，不直接修改引擎内部 state。

## 回合状态机

引擎使用显式状态约束一轮操作，而不是只依靠按钮显隐：

```text
building ──放满配置数量──> deciding ──保留1座──> ready ──开波──> playing
                                                               │   ▲
                                                               └─ paused

playing ──非最终波结算──> building
playing ──第12波结算────> victory
playing ──矿坑生命归零──> game_over
victory/game_over ──重新开始──> building
```

`gameFlow.ts` 保存可独立测试的建造批次、开波前置条件和最终波状态规则。UI 只能通过 `placeTower`、`finalizeTowers`、`startWave`、`pause`、`resume` 和 `resetGame` 等动作推动状态转换。暂停状态不满足 `useGameLoop` 的运行条件，因此动画帧和基于帧的游戏时间都会停止。

## 一帧的主要流程

1. `useGameLoop` 计算并限制 delta time。
2. 引擎更新敌人生成、移动、毒素/减速/眩晕、塔攻击、子弹碰撞和伤害数字生命周期。
3. 引擎处理死亡、奖励、漏怪和波次结束。
4. 渲染函数读取 `gameStateRef`，由 `rendering/canvasRenderer.ts` 将地图对象绘制到 Canvas。

`combat.ts` 提供伤害减免与暴击、目标优先级、多目标数量和减速比例等纯计算。`useGameEngine` 负责把这些规则编排进逐帧战斗，并处理溅射、邻近目标穿透、毒素、眩晕、金币奖励和矿坑伤害。`config/economy.ts` 集中定义起始资源、每轮建造资源和 20 金币清障成本；数值组件和引擎都读取这份配置。

Canvas 渲染与玩法状态分离：`spriteRegistry.ts` 统一映射 8 种基础塔、6 种特殊塔、4 类敌人、5 种障碍、出入口和地砖素材；`canvasRenderer.ts` 只读取场景快照，负责铺设地砖、真实/预览路线、候选阻塞格、精灵、血条、战斗状态效果和伤害数字。React 组件可使用同一注册表在选择与合成界面展示真实塔素材，避免维护重复的美术映射。

## 寻路边界

寻路模块只依赖网格类型和地图配置。`findPath` 将起点、中间必经点和终点拆成若干段，每段执行 BFS，再拼接成完整路径。`evaluateBatchPlacement` 通过克隆网格并临时阻塞候选格完成放置验证，同时检查本轮剩余建造容量；`createBatchPlacementPreview` 复用同一结果生成瞬时预览，不修改真实网格或 `currentPath`。

## 显示适配边界

Canvas 始终使用地图配置对应的 320×400 逻辑分辨率和高分屏 backing store，窄屏只通过 CSS 等比缩放显示尺寸。Pointer Events 会根据 Canvas 实际显示区域还原为逻辑坐标后再换算格子；按住或拖动时更新候选预览，正常松开沿用点击提交，取消、失焦或拖出则清除预览并阻止误放。桌面和手机共用同一套寻路、碰撞与绘制数据。游戏壳最大宽度为 430 像素，顶部使用五张紧凑资源卡，8×10 地图占据主体宽度，建造面板固定在地图下方；建造决策和合成界面采用触控友好的底部面板，并限制在动态视口高度内滚动。

## 当前技术债

- `useGameEngine.ts` 同时承担资源、建造、合成、波次、战斗和渲染，体积较大。后续应按系统逐步提取纯函数，并为每次提取补测试。
- 当前 18 个测试文件、118 项测试已覆盖寻路、地图与经济配置、塔和敌人配置、12 波及最终 Boss 配置、响应式 Canvas 坐标换算与指针预览状态、移动布局结构、精灵注册、建造容量与预览结果、伤害数字生命周期与表现、建造/波次纯状态规则、矿坑伤害、伤害与索敌、子弹范围、邻近穿透、毒素、减速/眩晕计时、幂等死亡、合成列表权限和碰撞工具。Hook 内部的完整逐帧编排、React 交互及从一波结算到下一轮补给仍缺少直接的自动化集成测试。
- Chromium 已在 390×844 下验证三次建造、三选一、开波、暂停/继续和合成列表，并在 360×800 与 390×693 下检查触控尺寸和可达性；本轮另在 390×844 下验证按住预览、按住跨格、松开提交、拖出取消、堵路提示及角落出入口完整显示。完整第一波结算和完整 12 波通关尚未做浏览器端端到端验收。
- `src/devtools/` 保留手工检查代码，但不作为自动化测试的替代品。
- 交互反馈大量使用 `alert` 和控制台日志，后续应统一为游戏内通知与可控调试日志。
- 视觉令牌目前集中在 `TowerDefenseGame.css` 的 CSS 变量中，仍未抽成跨页面的独立主题层；后续新增界面应继续复用现有阳光、草地、奶油、金色、棕色和青色语义色。

这些问题不应通过一次大规模重写解决；优先增加回归测试，再做小步拆分。
