# 架构概览

## 总体结构

项目由 React 单页游戏和独立 Node 排行榜 API 组成。React 负责状态驱动的界面和操作面板，Canvas 绘制地图、麻将棋子、敌人、弹道与状态效果，`requestAnimationFrame` 驱动战斗帧；Node API 使用 SQLite 持久化已提交成绩。生产环境由 Nginx 提供前端静态文件，并把同域 `/api` 转发给只监听本机地址的 API。

```text
main.tsx
  └─ app/App.tsx
      └─ game/components/TowerDefenseGame.tsx
          ├─ BuildPanel / MahjongActivationDecision / GameResultPanel
          ├─ MahjongSynthesisDialog / MahjongWallDetail
          ├─ MahjongTowerInspection / boardInteraction
          ├─ GameCanvas / GameUI
          └─ game/engine/useGameEngine.ts
              ├─ config/mahjong.ts + config/economy.ts + config/gameSpeed.ts
              ├─ engine/mahjongStats.ts
              ├─ engine/mahjongRoundFlow.ts
              ├─ engine/mahjongSynthesis.ts
              ├─ engine/mahjongEngineActions.ts
              ├─ engine/mahjongWalls.ts
              ├─ engine/mahjongAttack.ts
              ├─ engine/mahjongRuntimeEffects.ts
              ├─ engine/gameFlow.ts / building.ts / combat.ts
              ├─ engine/enemyMovement.ts / pathfinding/*
              ├─ rendering/canvasRenderer.ts
              └─ useGameLoop.ts

src/game/services/leaderboard.ts
  └─ same-origin /api
      └─ server/src/app.ts
          ├─ validation.ts + scoring.ts
          ├─ rateLimit.ts
          └─ database.ts → SQLite
```

当前生产入口只装配麻将流程。旧宝石配置、类型、合成组件、素材和兼容渲染分支仍在仓库中，但不是玩家可访问的规则入口。

## 状态分层

`useGameEngine` 有意把状态分为两类：

- `uiState` 使用 React state，保存剩余建造次数、金币、矿坑生命、波次、阶段，以及经过信息裁剪的牌槽、手牌花色、功能牌等需要触发界面更新的数据。
- `gameStateRef` 保存敌人、塔、子弹、伤害数字、网格、路径、预览、生成队列、战斗计时，以及完整麻将实体状态等高频或受保护数据，避免每帧 React 重渲染，也避免把暗牌实体直接交给 UI。

`uiState.score` 是低频 React 状态，保存总分、击杀分、合成分及四类事件计数。敌人首次死亡和合成事务成功后分别通过纯计分函数生成新状态；分数不复用金币奖励。进入 `victory` 或 `game_over` 后终局界面使用冻结快照，重开时连同其他对局状态归零。

战斗速度是 `useGameEngine` 持有并公开给界面的低频 React 状态。它跨波次保留，重开恢复 1×；组件只能调用引擎暴露的循环切档动作，不能直接修改战斗时钟。

塔查看是 `TowerDefenseGame` 的局部展示状态，只保存 `inspectedTowerId`，每次渲染都从 `gameStateRef.current.towers` 与 `storedTowerIds` 重新解析当前实体，避免合成替换塔对象后继续显示陈旧引用。`boardInteraction.ts` 以纯函数区分三选一、准备阶段合成、战斗查看、中發选塔、墙体和清空选择；它不修改引擎状态。

麻将运行时子状态包括：

- `pool`：当前可摸的实体数牌。
- `roundTiles`：本回合新牌与可能带入的旧手牌，内部保留完整实体，向 UI 只投影允许公开的信息。
- `heldTile`：最多一张跨回合手牌。
- `functionTiles`：通过定期抽取获得、尚未使用的中發白。
- `resolvingHand`：布尔标记，表示当前处于 `resolving_hand` 阶段——进入即公开剩余牌花色，等待玩家保留 1 张手牌。
- `roundNumber`：从 1 开始的麻将建造轮编号，用于在第 2、4、6、8、10、12 轮调度固定 50% 的独立功能牌抽取。

组件不能直接修改这些状态。`TowerDefenseGame` 只调用引擎动作，例如拖放、激活、留牌、合成、中发附着、拆墙、开波、暂停、战斗变速和重开；偶数轮功能牌抽取由留牌事务自动结算。

## 回合状态机

```text
building ──放满3张──> deciding ──激活1张──> resolving_hand
    ▲                                                │
    │                                                └─留1张；偶数轮自动抽取──> ready
    │                                                                    │
    └────────────────────── 非最终波结算 <── playing <──开波─────────────┘
                                                  │  ▲
                                                  ▼  │
                                                paused

playing ──第12波结算──> victory
playing ──矿坑生命归零──> game_over
victory/game_over ──重新开始──> building
```

新对局开始时，前端异步向排行榜 API 申请 `runId`、短期 `submissionToken` 和 `scoringVersion`；连接失败不会阻止本地游戏。只有 `victory` 或 `game_over` 可以从终局面板提交冻结成绩。首次提交创建唯一成绩；网络重试再次发送同一 `runId` 和有效令牌时，服务端返回原成绩及其当前名次，不新增或覆盖记录。终局面板读取当前版本 Top 10，并可用 `runId` 查询本局实际名次。手动重开创建新对局，不提交未结算成绩。

## 计分与排行榜边界

`src/game/config/scoring.ts` 定义浏览器实时展示的 `v1` 分值和纯累加函数；`server/src/scoring.ts` 保存同版本的独立权威重算表与按波次合理计数上限。当前击杀分为基础 10、快速 20、坦克 50、Boss 500；合成分为对子 100、顺子 200、明刻 300、杠 400。每次成功合成按新产物计分，因此连续升级累计各步得分。

`src/game/services/leaderboard.ts` 封装同域请求和错误转换。API 的最小契约为：

- `POST /api/runs` 创建短期对局凭据并返回当前计分版本。
- `POST /api/scores` 接收匿名名称、冻结分数明细、胜负、波次、矿坑生命、局时和客户端版本；服务端重算分项和总分后原子写入。首次写入返回 HTTP 201；同 `runId` 和有效令牌的重放返回 HTTP 200、原 `entry` 及当前 `rank`，重放载荷不会覆盖原成绩。
- `GET /api/leaderboard?limit=10&runId=<id>` 返回当前版本榜单和可选的本人名次。
- `GET /api/health` 检查进程、数据库和当前计分版本。

SQLite 使用严格表、外键、迁移表和 `(scoring_version, total_score DESC, created_at ASC, id ASC)` 排序索引；迁移 v2 另为 run 增加 `(submitted_at, expires_at)` 索引。每次创建 run 时，插入事务会先按到期时间最多清理 100 条已过期且未提交的 run，避免单次请求执行无界删除；已经提交并关联成绩的 run 会保留。文件数据库开启 WAL、`busy_timeout` 和正常同步级别。榜单按 `scoringVersion` 隔离，同分先提交者优先。数据库、WAL 文件和备份必须位于静态与 API 发布目录之外的持久目录，日常发布只能运行向前迁移，不能替换数据库。

服务端还会校验 1～16 个 Unicode 字符的匿名公开名称、短期令牌、胜负/波次关系、分项重算和按波次事件计数上限，并以唯一 `runId` 和幂等重放保证每局至多一条成绩；请求按客户端地址、方法和路径执行内存限流。令牌只保存哈希，错误令牌不能读取已提交成绩。该边界能拦截误提交和低成本篡改，但浏览器仍可伪造战斗事件，当前只承诺休闲榜，不承诺竞技级防作弊。

排行榜是可降级的附加能力：API 创建、查询或提交失败时，前端展示可重试状态，但不得阻塞建造、战斗、终局分数或重新开始。由于使用同域 `/api`，浏览器不需要跨域配置；Nginx 与 API 不可用时也不会把暗牌实体或其他引擎内部状态暴露给网络层。

合成、中发附着和拆墙都在纯规则层与引擎动作层再次检查阶段，只允许 `building` 和 `ready`，不能依赖按钮显隐保证权限。动作还要求锚点和主动材料已经位于 `storedTowerIds` 且网格格子确实归属该塔，因此本轮尚未完成三选一的临时塔不能参与操作。

## 麻将实体模型

`MahjongNumberTile` 表示 108 张实体数牌之一，包含不透明 ID、花色、点数和四份副本序号。ID 生成值不编码牌面。每张实体只能由牌池、回合资源、手牌、持久塔/合成塔或普通牌墙之一拥有。

`MahjongTowerState` 是单牌与合成塔的麻将事实来源：

- `formation`：`single | pair | chow | pung | kong`。
- `suit` 与 `ranks`：产物的花色和逻辑牌面。
- `containedTileIds`：实际被塔占用的数牌实体。
- `activeSources`：曾作为主动棋子的实体 ID 与不可变原始随机属性。
- `attachments`：已经消耗并附着的中或發。
- `whiteSlotIndices`：白替代的牌位下标（与 `ranks` 对齐，长度即白数）；白不进入 108 张实体集合。

网格通过 `mahjongWallKind` 区分两种墙：

- `tile` 普通牌墙必须带 `mahjongTile`，占用实体数牌。
- `pure` 纯墙体不能带数牌，只保存阻路拓扑。

这些不变量由合成与拆墙事务在提交前验证，包括实体 ID、塔 ID、材料位置唯一性，以及实体不能重复返回牌池。

## 麻将规则模块

### 配置与属性

`config/mahjong.ts` 集中保存牌池构造、牌面注册表、隐藏视图、随机属性区间、面子倍率、花色机制和中发白参数。`config/economy.ts` 保存 50 起始金币、100 普通牌墙拆除费和 50 纯墙拆除费等经济数值。`config/gameSpeed.ts` 保存 1×、1.5×、3× 战斗档位、默认档位和纯切档/时间缩放规则。

`mahjongRoundFlow.ts` 以纯事务处理剩余牌：始终保留玩家选中的实体、只把其余实体回池，并在偶数建造轮独立结算功能牌抽取。抽取结果不会改变 `heldTile` 或 108 张数牌的实体归属。

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

`mahjongRuntimeEffects.ts` 使用绝对游戏时间推进毒、灼烧、减速和眩晕；`useGameEngine` 把结果同步到敌人移动字段、伤害数字与 Canvas 状态反馈。只有 `playing` 帧会按所选档位统一缩放战斗 delta；暂停不运行帧更新，因此效果计时一并冻结。波次结束清空本波目标状态和条的连续攻击层数。

## 一帧的主要流程

1. `useGameLoop` 计算并限制真实 delta time；引擎只在 `playing` 时按 1×、1.5× 或 3× 派生统一战斗 delta。
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

持久塔的射程圈与数值气泡由 `MahjongTowerInspection` 作为无指针事件的 React 覆盖层绘制，不进入 Canvas 战斗快照。`boardOverlay.ts` 将塔中心与实际射程从逻辑像素分别换算为 320×400 地图百分比，覆盖容器负责裁剪地图外部分。准备阶段的麻将合成工作台使用透明非模态 backdrop，因此可继续点击地图切换或关闭查看；引擎层的合成阶段校验保持不变。

麻将视觉采用可组合通道：花色核心、面子标记、中红色外层、發绿色方印、目标状态和伤害数字可以叠加；顺子的视觉弹道数由攻击计划携带，机制仍只按语义命中结算。

## 当前技术债

- `useGameEngine.ts` 仍同时编排牌流、波次、战斗和渲染，虽然麻将属性、合成、墙体与攻击规则已经提取为纯模块，后续仍应小步拆分并补回归测试。
- 旧宝石类型、配置、组件、CSS 和兼容战斗分支尚未删除。它们不应重新接入生产入口；清理前需确认现有测试、素材映射和兼容字段依赖。
- Hook 级完整对局集成测试仍少于纯规则测试；完整 12 波浏览器端到端通关仍需单独验收。
- 交互反馈仍混有 `alert` 与控制台日志，后续应统一为游戏内通知和可控调试日志。
- 数值已集中配置并有自动化覆盖，但 v0.1 平衡仍需通过实际通关数据调整。

这些问题不应通过整体重写 `useGameEngine` 解决；优先保护公开状态变化和实体不变量，再做小步提取或清理。
