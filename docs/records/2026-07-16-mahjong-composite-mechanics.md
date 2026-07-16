# 麻将合成、差异攻击与功能牌实现记录

日期：2026-07-16

## 目标

把 `docs/product/composite.md` 已收敛的 v0.1 规则接入当前麻将牌流，包括：

- 万、条、筒的随机属性与差异化攻击。
- 对子、吃、碰、杠及主动来源属性继承。
- 中、發、白的获取、消耗、附着和战斗效果。
- 普通牌墙、纯墙体、合成材料位置与金币拆除。
- 阶段权限、实体唯一性和暗牌信息边界。

## 实现落点

- `src/game/types/game.ts`：增加面子、随机属性、主动来源、合成塔状态、附着和墙体种类等领域类型。
- `src/game/config/mahjong.ts`：集中保存花色随机区间、面子倍率、花色机制、中发白参数、牌池与隐藏视图规则。
- `src/game/config/economy.ts`：普通牌墙 100 金币、纯墙体 50 金币。
- `src/game/engine/mahjongStats.ts`：按不可变主动来源重算合成属性。
- `src/game/engine/mahjongSynthesis.ts`：纯函数验证对子/吃/碰/杠、牌墙、白、附着继承和实体不变量，输出原子事务计划。
- `src/game/engine/mahjongEngineActions.ts`：提交合成、附着和拆墙计划，维护塔、持久索引、网格、功能牌与牌池。
- `src/game/engine/mahjongWalls.ts`：区分普通牌墙与纯墙体的拆除事务。
- `src/game/engine/mahjongAttack.ts`、`mahjongRuntimeEffects.ts`：攻击计划、伤害与状态结算、持续效果时间推进。
- `src/game/engine/useGameEngine.ts`：把牌流、合成动作、墙体动作和麻将攻击接入实际回合与战斗帧。
- `src/game/components/MahjongActivationDecision.tsx`：三选一前显示候选牌随机属性和基础机制。
- `src/game/components/MahjongSynthesisDialog.tsx`、`MahjongWallDetail.tsx`：合成预览、材料选择、白催化和两类拆墙操作。
- `src/game/rendering/canvasRenderer.ts`：花色/面子弹道、中发外层、纯墙体和目标状态反馈。

## 当前规则摘要

### 花色与面子

- 万为物理暴击与破甲路线，条为快速物理毒素路线，筒为魔法减速与溅射路线。
- 伤害、攻击间隔和攻击距离在花色整数闭区间内独立生成，三选一前公开。
- 对子提供小强化，顺子提供倍率与三发多目标分配，明刻强化花色机制，杠为同牌路线终点。
- 顺子与杠不能继续参与合成。

### 合成与实体

- 合成只允许在 `building`、`ready`，且主动棋子必须已经进入持久塔集合；本轮临时候选塔不能参与。
- 产物保留锚点塔 ID 和位置。非锚点主动材料及墙材料原位置变为纯墙体。
- 吃或碰最多使用 1 张精确匹配的普通牌墙和 1 张白；两者可以同次使用。
- 对子不能使用牌墙或白；杠只接受四单牌、对子加两单牌、两个对子、明刻加单牌。
- 合成塔保存实际数牌实体 ID 与原始主动属性来源；牌墙只贡献牌面，白只贡献逻辑牌位。
- 失败事务不删除塔、不改墙、不扣功能牌、不改牌池。

### 中发白

- 中提供伤害 ×1.25、暴击率 +10 个百分点和 6 点/秒、3 秒的不叠层灼烧。
- 發为万提供处决，为条提供同目标攻频成长，为筒提供对普通/Boss 不同持续时间的眩晕。
- 白只能用于吃或碰，成功合成后消耗，不携带实体 ID、随机属性或附着。
- 单牌/对子容量为一张中或發；顺子/明刻/杠可同时携带中与發。相同附着不叠加。

### 墙体

- 普通牌墙保留实体牌，能被一次吃或碰被动使用；100 金币拆除后实体回池。
- 纯墙体不含实体牌、不能合成；50 金币拆除且不返牌。
- 两类墙都持续阻路，不随波次结束自动清除。

## 固化的默认假设

- 三项随机属性独立使用整数闭区间；实体牌回池后不保存旧随机值，再次落地重新生成。
- 合成伤害和距离取主动来源算术平均；攻击间隔先转频率求平均，再应用最终面子倍率。
- 中的伤害倍率在攻击计划中应用，不写回合成预览的基础面板值。
- 顺子总原始伤害按实际目标数平均，每个目标每周期只结算一次机制。
- 筒溅射只结算直接伤害，不二次传播状态或功能牌效果。
- 同来源毒按形态上限叠层，不同塔来源独立；灼烧不叠层；减速取更强比例和更晚结束时间。
- 暂停冻结战斗与持续效果时间；波次结束清理本波子弹、敌人状态和条的连续攻击层数。
- 發万处决在伤害后生命比例严格低于阈值时触发。

## 信息边界

- 108 张实体使用不编码牌面的不透明 ID，并在牌池、回合牌、手牌、塔和普通牌墙之间唯一流转。
- 新暗牌 UI 视图不包含花色、点数、副本、实体对象或随机属性；旧手牌只公开花色。
- 数牌落地后才公开完整牌面和随机属性，候选路径预览仍使用中性暗牌。
- 普通牌墙保留实体但不保留可继承随机属性；纯墙体不保留实体。

## 验证

对应 Vitest 覆盖集中在：

- `config/mahjong.test.ts`
- `engine/mahjongStats.test.ts`
- `engine/mahjongSynthesis.test.ts`
- `engine/mahjongEngineActions.test.ts`
- `engine/mahjongWalls.test.ts`
- `engine/mahjongAttack.test.ts`
- `engine/mahjongRuntimeEffects.test.ts`
- `components/MahjongActivationDecision.test.tsx`
- `components/MahjongSynthesisDialog.test.tsx`
- `components/MahjongWallDetail.test.tsx`
- `rendering/canvasRenderer.test.ts`

最终合并前仍以仓库约定统一执行 `npm run lint`、`npm test` 和 `npm run build`；浏览器手工验收应至少覆盖一次三选一属性比较、一次合法/非法合成、一次中發附着、一次普通/纯墙拆除及一波实际战斗反馈。

## 文档同步

- `docs/product/composite.md` 从讨论稿更新为当前 v0.1 实现规则。
- `docs/product/gameplay.md` 更新完整玩家流程、差异攻击、合成、功能牌与墙体规则。
- `docs/architecture/overview.md` 更新模块边界、事务模型、实体状态和战斗帧。
- `docs/reference/game-configuration.md` 将配置入口改为麻将事实源，并标记 20 金币通用清障、24 障碍上限和旧宝石塔配置只承担遗留兼容职责。
- 根 `README.md` 与 `docs/README.md` 移除当前运行时仍以旧宝石玩法为主的描述，并保留遗留兼容代码的边界说明。

`docs/records/archive/` 未修改，继续仅作为历史材料保存。
