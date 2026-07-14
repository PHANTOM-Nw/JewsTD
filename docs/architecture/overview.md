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
              ├─ pathfinding/*
              ├─ services/audio.ts
              └─ useGameLoop.ts
```

## 状态模型

`useGameEngine` 有意把状态分成两类：

- `uiState` 使用 React state，保存木材、金币、矿坑生命、波次、阶段和游戏等级等需要触发界面更新的数据。
- `gameStateRef` 使用 ref，保存敌人、塔、子弹、网格、路径和生成队列等高频变化对象，避免每帧触发 React 重渲染。

外部组件只调用引擎暴露的动作，例如放置塔、删除障碍、合成和开始波次，不直接修改引擎内部 state。

## 一帧的主要流程

1. `useGameLoop` 计算并限制 delta time。
2. 引擎更新敌人生成、移动、持续效果、塔攻击和子弹碰撞。
3. 引擎处理死亡、奖励、漏怪和波次结束。
4. 渲染函数读取 `gameStateRef`，将地图对象绘制到 Canvas。

## 寻路边界

寻路模块只依赖网格类型和地图配置。`findPath` 将起点、中间必经点和终点拆成若干段，每段执行 BFS，再拼接成完整路径。放置验证通过克隆网格并临时阻塞候选格完成，不应修改传入网格。

## 当前技术债

- `useGameEngine.ts` 同时承担资源、建造、合成、波次、战斗和渲染，体积较大。后续应按系统逐步提取纯函数，并为每次提取补测试。
- `src/devtools/` 仍是手工检查代码，尚未接入正式测试框架。
- 交互反馈大量使用 `alert` 和控制台日志，后续应统一为游戏内通知与可控调试日志。
- 多数组件仍使用行内样式，视觉系统尚未形成设计令牌和响应式布局。

这些问题不应通过一次大规模重写解决；优先增加回归测试，再做小步拆分。
