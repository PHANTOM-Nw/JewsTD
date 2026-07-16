# 架构概览

## 总体结构

项目是无后端、无持久化层的 React 单页游戏。React 负责状态驱动的界面和操作面板，Canvas 绘制地图、麻将棋子、敌人、弹道与状态效果，`requestAnimationFrame` 驱动战斗帧。

```text
main.tsx
  └─ app/App.tsx
      └─ game/components/TowerDefenseGame.tsx
          ├─ BuildPanel / MahjongActivationDecision
          ├─ MahjongSynthesisDialog / MahjongWallDetail
          ├─ GameCanvas / GameUI
          └─ game/engine/useGameEngine.ts
              ├─ config/mahjong.ts + config/economy.ts
              ├─ engine/mahjongStats.ts
              ├─ engine/mahjongSynthesis.ts
              ├─ engine/mahjongEngineActions.ts
              ├─ engine/mahjongWalls.ts
              ├─ engine/mahjongAttack.ts
              ├─ engine/mahjongRuntimeEffects.ts
              ├─ engine/gameFlow.ts / building.ts / combat.ts
              ├─ engine/enemyMovement.ts / pathfinding/*
              ├─ rendering/canvasRenderer.ts
              └─ useGameLoop.ts
```

当前生产入口只装配麻将流程。旧宝石配置、类型、合成组件、素材和兼容渲染分支仍在仓库中，但不是玩家可访问的规则入口。

## 状态分层

`useGameEngine` 有意把状态分为两类：

- `uiState` 使用 React state，保存剩余建造次数、金币、矿坑生命、波次、阶段，以及经过信息裁剪的牌槽、手牌花色、功能牌等需要触发界面更新的数据。
- `gameStateRef` 保存敌人、塔、子弹、伤害数字、网格、路径、预览、生成队列、战斗计时，以及完整麻将实体状态等高频或受保护数据，避免每帧 React 重渲染，也避免把暗牌实体直接交给 UI。

麻将运行时子状态包括：

- `pool`：当前可摸的实体数牌。
- `roundTiles`：本回合新牌与可能带入的旧手牌，内部保留完整实体，向 UI 只投影允许公开的信息。
- `heldTile`：最多一张跨回合手牌。
- `functionTiles`：通过赌博获得、尚未使用的中發白。
- `handResolutionMode`：剩余牌正在选择处理方式，或已经选择看花色留牌。

组件不能直接修改这些状态。`TowerDefenseGame` 只调用引擎动作，例如拖放、激活、留牌、赌博、合成、中发附着、拆墙、开波、暂停和重开。

## 回合状态机

```text
building ──放满3张──> deciding ──激活1张──> resolving_hand
    ▲                                                │
    │                                                └─留牌或赌博──> ready
    │                                                                    │
    └────────────────────── 非最终波结算 <── playing <──开波─────────────┘
                                                  │  ▲
                                                  ▼  │
                                                paused

playing ──第12波结算──> victory
playing ──矿坑生命归零──> game_over
victory/game_over ──重新开始──> building
```

合成、中发附着和拆墙都在纯规则层与引擎动作层再次检查阶段，只允许 `building` 和 `ready`，不能依赖按钮显隐保证权限。动作还要求锚点和主动材料已经位于 `storedTowerIds` 且网格格子确实归属该塔，因此本轮尚未完成三选一的临时塔不能参与操作。

## 麻将实体模型

`MahjongNumberTile` 表示 108 张实体数牌之一，包含不透明 ID、花色、点数和四份副本序号。ID 生成值不编码牌面。每张实体只能由牌池、回合资源、手牌、持久塔/合成塔或普通牌墙之一拥有。

`MahjongTowerState` 是单牌与合成塔的麻将事实来源：

- `formation`：`single | pair | chow | pung | kong`。
- `suit` 与 `ranks`：产物的花色和逻辑牌面。
- `containedTileIds`：实际被塔占用的数牌实体。
- `activeSources`：曾作为主动棋子的实体 ID 与不可变原始随机属性。
- `attachments`：已经消耗并附着的中或發。
- `usesWhiteSubstitution`：白替代了一个逻辑牌位；白不进入 108 张实体集合。

网格通过 `mahjongWallKind` 区分两种墙：

- `tile` 普通牌墙必须带 `mahjongTile`，占用实体数牌。
- `pure` 纯墙体不能带数牌，只保存阻路拓扑。

这些不变量由合成与拆墙事务在提交前验证，包括实体 ID、塔 ID、材料位置唯一性，以及实体不能重复返回牌池。

## 麻将规则模块

### 配置与属性

`config/mahjong.ts` 集中保存牌池构造、牌面注册表、隐藏视图、随机属性区间、面子倍率、花色机制和中发白参数。`config/economy.ts` 保存 50 起始金币、100 普通牌墙拆除费和 50 纯墙拆除费等经济数值。

`mahjongStats.ts` 从不可变主动来源重算塔属性：伤害与距离取算术平均，攻击间隔先换算频率求平均，再应用产物最终倍率。它不会接收已经放大的上一级面板值，从接口上避免倍率叠乘。

### 合成与墙体事务

`mahjongSynthesis.ts` 是无副作用规划器，检查阶段、锚点、材料、牌面、合法成长路线、牌墙/白数量与实体状态，并返回原子计划。`mahjongEngineActions.ts` 把计划提交为唯一锚点塔、纯墙格、持久塔索引和功能牌变化，再重算路径。失败结果返回原状态，不消耗材料。

`mahjongWalls.ts` 以同样方式规划拆墙：普通牌墙扣 100 金币并把实体放回牌池；纯墙扣 50 金币且不返牌。引擎提交后清空格子并重算路径。

### 攻击与持续效果

`mahjongAttack.ts` 把塔状态和集中配置投影为单次攻击计划：

- 按花色和面子应用物理/魔法、暴击、破甲、毒、减速、溅射与顺子三目标分配。
- 中在攻击计划中增加伤害和暴击并添加灼烧。
- 發按花色提供处决、条的同目标攻频层数或筒的眩晕。
- 视觉子弹数量与语义命中分离，避免顺子三发对同一目标重复结算状态。

`mahjongRuntimeEffects.ts` 使用绝对游戏时间推进毒、灼烧、减速和眩晕；`useGameEngine` 把结果同步到敌人移动字段、伤害数字与 Canvas 状态反馈。暂停不运行帧更新，因此效果计时一并冻结；波次结束清空本波目标状态和条的连续攻击层数。

## 一帧的主要流程

1. `useGameLoop` 计算并限制 delta time。
2. 引擎生成到期敌人并处理入口净空。
3. 先推进旧兼容效果和麻将毒/灼烧，再更新减速与眩晕计时。
4. 统一计算敌人自由位移意图、队列阻挡与有限推动。
5. 持久塔选取目标，麻将塔生成语义攻击计划与弹道。
6. 子弹命中后结算直接伤害、花色/面子机制、中发效果和伤害数字。
7. 引擎处理死亡奖励、漏怪扣血、波次完成与下一轮摸牌。
8. `canvasRenderer.ts` 读取快照绘制地图、棋子、墙体、敌人、弹道、状态和伤害数字。

## 寻路与显示边界

`findPath` 将入口、中间必经点和出口拆为多段 BFS，再拼接完整路径。`evaluateBatchPlacement` 在克隆网格中验证候选格，同时保证本轮剩余建造仍有足够安全位置；`createBatchPlacementPreview` 复用同一结果，但不修改真实网格、路径或暗牌实体。

Canvas 固定使用 320×400 逻辑分辨率与高分屏 backing store，CSS 负责窄屏等比缩放。Pointer Events 从实际显示区域还原逻辑坐标。候选预览使用中性几何暗牌，不读取牌面。React 与 Canvas 牌面共用 `config/mahjong.ts` 的确定性注册表。

麻将视觉采用可组合通道：花色核心、面子标记、中红色外层、發绿色方印、目标状态和伤害数字可以叠加；顺子的视觉弹道数由攻击计划携带，机制仍只按语义命中结算。

## 当前技术债

- `useGameEngine.ts` 仍同时编排牌流、波次、战斗和渲染，虽然麻将属性、合成、墙体与攻击规则已经提取为纯模块，后续仍应小步拆分并补回归测试。
- 旧宝石类型、配置、组件、CSS 和兼容战斗分支尚未删除。它们不应重新接入生产入口；清理前需确认现有测试、素材映射和兼容字段依赖。
- Hook 级完整对局集成测试仍少于纯规则测试；完整 12 波浏览器端到端通关仍需单独验收。
- 交互反馈仍混有 `alert` 与控制台日志，后续应统一为游戏内通知和可控调试日志。
- 数值已集中配置并有自动化覆盖，但 v0.1 平衡仍需通过实际通关数据调整。

这些问题不应通过整体重写 `useGameEngine` 解决；优先保护公开状态变化和实体不变量，再做小步提取或清理。
