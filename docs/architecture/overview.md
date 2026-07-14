# 架构概览

## 总体结构

项目采用单一 React 前端，没有后端和持久化层。界面由 React 组件组织，地图和战斗对象使用 Canvas 绘制，游戏更新由 `requestAnimationFrame` 驱动。

```text
main.tsx
  └─ app/App.tsx
      └─ game/components/TowerDefenseGame.tsx
          ├─ UI 组件
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

- `uiState` 使用 React state，保存木材、金币、矿坑生命、波次、阶段和游戏等级等需要触发界面更新的数据。
- `gameStateRef` 使用 ref，保存敌人、塔、子弹、网格、路径和生成队列等高频变化对象，避免每帧触发 React 重渲染。

外部组件只调用引擎暴露的动作，例如放置塔、删除障碍、合成和开始波次，不直接修改引擎内部 state。

## 回合状态机

引擎使用显式状态约束一轮操作，而不是只依靠按钮显隐：

```text
building ──放满5座──> deciding ──保留1座──> ready ──开波──> playing
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
2. 引擎更新敌人生成、移动、毒素/减速/眩晕、塔攻击和子弹碰撞。
3. 引擎处理死亡、奖励、漏怪和波次结束。
4. 渲染函数读取 `gameStateRef`，将地图对象绘制到 Canvas。

`combat.ts` 提供伤害减免与暴击、目标优先级、多目标数量和减速比例等纯计算。`useGameEngine` 负责把这些规则编排进逐帧战斗，并处理溅射、邻近目标穿透、毒素、眩晕、金币奖励和矿坑伤害。`config/economy.ts` 集中定义起始资源、每轮建造资源和 10 金币清障成本；数值组件和引擎都读取这份配置。

## 寻路边界

寻路模块只依赖网格类型和地图配置。`findPath` 将起点、中间必经点和终点拆成若干段，每段执行 BFS，再拼接成完整路径。放置验证通过克隆网格并临时阻塞候选格完成，不应修改传入网格。

## 显示适配边界

Canvas 始终使用地图配置对应的逻辑分辨率和高分屏 backing store，窄屏只通过 CSS 等比缩放显示尺寸。指针事件会根据 Canvas 实际显示区域还原为逻辑坐标后再换算格子，因此桌面和手机共用同一套寻路、碰撞与绘制数据。小于 760 像素时，顶部状态与操作区改为网格排列，地图优先显示，建造面板移至地图下方；五选一和合成弹窗限制在动态视口高度内并允许内部滚动。

## 当前技术债

- `useGameEngine.ts` 同时承担资源、建造、合成、波次、战斗和渲染，体积较大。后续应按系统逐步提取纯函数，并为每次提取补测试。
- 当前 11 个测试文件、74 项测试已覆盖寻路、地图与经济配置、塔和敌人配置、12 波及最终 Boss 配置、响应式 Canvas 点击换算、建造/波次纯状态规则、矿坑伤害、伤害与索敌、子弹范围、邻近穿透、毒素、减速/眩晕计时、幂等死亡、合成列表权限和碰撞工具。Hook 内部的完整逐帧编排、React 交互及从一波结算到下一轮补给仍缺少直接的自动化集成测试。
- Chromium 已验证首轮建造到开波、暂停时帧冻结及继续后恢复，但完整第一波结算和完整 12 波通关尚未做浏览器端端到端验收。
- `src/devtools/` 保留手工检查代码，但不作为自动化测试的替代品。
- 交互反馈大量使用 `alert` 和控制台日志，后续应统一为游戏内通知与可控调试日志。
- 多数组件仍使用行内样式，视觉系统尚未形成统一的设计令牌；当前响应式规则集中在游戏壳和关键弹窗，后续新增界面仍需沿用这些布局边界。

这些问题不应通过一次大规模重写解决；优先增加回归测试，再做小步拆分。
