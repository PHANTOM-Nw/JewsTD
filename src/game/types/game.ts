// 基础坐标
export interface Position {
  x: number
  y: number
}

export type GameStatus =
  | 'building'
  | 'deciding'
  | 'resolving_hand'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'game_over'
  | 'victory'

export type EnemyType = 'basic' | 'fast' | 'tank' | 'boss'

export type MahjongSuit = 'characters' | 'bamboo' | 'dots'
export type MahjongRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
export type MahjongHonor = 'red' | 'green' | 'white'

/** 108 张实体数牌中的一张；copy 用于区分同牌面的四个实体。 */
export interface MahjongNumberTile {
  id: string
  suit: MahjongSuit
  rank: MahjongRank
  copy: 1 | 2 | 3 | 4
}

export interface MahjongRoundTile {
  id: string
  source: 'draw' | 'hand'
  tile: MahjongNumberTile
}

/** UI 只拿到当前规则允许公开的信息，暗牌不会泄露点数或花色。 */
export interface MahjongRoundTileView {
  id: string
  source: MahjongRoundTile['source']
  visibility: 'hidden' | 'suit'
  suit?: MahjongSuit
}

// 宝石塔类型 - 8种基础宝石
export type GemType = 
  | 'amethyst'    // 紫水晶 - 高伤害单体
  | 'diamond'     // 钻石 - 快速多目标
  | 'topaz'       // 黄玉 - 溅射范围
  | 'opal'        // 蛋白石 - 减速
  | 'ruby'        // 红宝石 - 纯粹伤害
  | 'sapphire'    // 蓝宝石 - 魔法穿透
  | 'emerald'     // 翡翠 - 毒素持续伤害
  | 'obsidian'    // 黑曜石 - 眩晕/冻结

// 宝石等级
export type GemLevel = 'chipped' | 'flawed' | 'normal' | 'flawless'

// 特殊塔类型 - 6种合成塔
export type SpecialTowerType = 
  | 'silver'      // 银塔
  | 'malachite'   // 孔雀石
  | 'starRuby'    // 星红宝石
  | 'moonstone'   // 月长石
  | 'jade'        // 玉石
  | 'onyx'        // 玛瑙

// 敌人类
export interface Enemy {
  id: string
  spawnSequence: number
  type: EnemyType
  position: Position
  health: number
  maxHealth: number
  speed: number
  armor: number        // 护甲(减免物理伤害)
  magicResist: number  // 魔抗(减免魔法伤害,0-1)
  pathIndex: number    // 当前路径点索引
  progress: number     // 在两点间的进度(0-1)
  reward: number       // 击杀奖励金币
  mineDamage: number   // 抵达终点时对矿坑造成的伤害
  reachedEnd?: boolean // 是否到达终点
  slowTimer?: number   // 减速剩余时间(ms)
  slowEffect?: number  // 当前减速比例(0-1)
  isDead?: boolean     // 是否已死亡
  
  // 特效相关属性
  poisonEffects?: Array<{
    damage: number
    duration: number
    tickAccumulator: number
  }>
  isStunned?: boolean
  stunTimer?: number
}

// 防御塔类
export interface Tower {
  id: string
  gemType?: GemType           // 基础宝石类型
  specialType?: SpecialTowerType  // 特殊塔类型
  mahjongTile?: MahjongNumberTile // 麻将玩法中的准确实体牌面
  level: GemLevel             // 等级
  gridPosition: { row: number; col: number }
  position: Position
  damage: number
  range: number
  attackSpeed: number         // 攻击间隔(ms)
  lastAttackTime: number
  damageType: 'physical' | 'magic' | 'pure'  // 伤害类型
  
  // 特效属性
  multiTarget?: number          // 多目标数量
  splashRadius?: number         // 溅射半径
  slowEffect?: number           // 减速效果
  critChance?: number           // 暴击率
  critMultiplier?: number       // 暴击倍率
  poisonDamage?: number         // 毒素伤害
  poisonDuration?: number       // 毒素持续时间(ms)
  stunChance?: number           // 眩晕概率
  stunDuration?: number         // 眩晕持续时间(ms)
  pierce?: boolean              // 是否穿透
  targetId?: string             // 当前锁定目标
}

// 子弹类
export interface Bullet {
  id: string
  position: Position
  originPosition: Position
  attackRange: number
  targetId: string
  damage: number
  damageType: 'physical' | 'magic' | 'pure'
  speed: number
  
  // 特效属性
  splashRadius?: number
  slowEffect?: number
  critChance?: number
  critMultiplier?: number
  poisonDamage?: number
  poisonDuration?: number
  stunChance?: number
  stunDuration?: number
  pierce?: boolean
}

export type DamageNumberType = Bullet['damageType'] | 'poison'

export interface DamageNumber {
  id: string
  position: Position
  amount: number
  damageType: DamageNumberType
  critical: boolean
  elapsedMs: number
  durationMs: number
  horizontalOffset: number
}

export type PlacementPreviewStatus =
  | 'valid'
  | 'path_blocked'
  | 'insufficient_capacity'

export interface PlacementPreview {
  position: { row: number; col: number }
  path: Array<{ row: number; col: number }> | null
  status: PlacementPreviewStatus
}

// 地图格子
export interface GridCell {
  row: number
  col: number
  type: 'empty' | 'tower' | 'obstacle' | 'mine' | 'start' | 'end'
  towerId?: string  // 如果有塔,记录塔的ID
  mahjongTile?: MahjongNumberTile // 牌墙保留被锁住的实体牌身份
}

// 波次敌人配置
export interface WaveEnemyConfig {
  type: EnemyType
  count: number
  interval: number  // 生成间隔(ms)
}

// 波次配置
export interface WaveConfig {
  waveNumber: number
  enemies: WaveEnemyConfig[]
  isBossWave?: boolean
  healthMultiplier?: number  // 血量倍率(默认1.0)
}

// 游戏状态
export interface GameState {
  wood: number           // 剩余建造次数(每波数量由经济配置决定)
  gold: number           // 金币
  mineHealth: number     // 矿坑生命
  maxMineHealth: number  // 最大矿坑生命
  wave: number
  enemies: Enemy[]
  towers: Tower[]
  bullets: Bullet[]
  grid: GridCell[][]     // 地图网格
  storedTowers: Tower[]  // 场上跨波次保留塔的合成索引
  gameStatus: GameStatus
  selectedGem: GemType | null  // 当前选中的宝石类型
  currentPath: { row: number; col: number }[] | null  // 当前BFS路径
  availableGems: GemType[]  // 当前波配置数量的随机宝石
}

// UI状态接口
export interface UIState {
  wood: number
  gold: number
  mineHealth: number
  maxMineHealth: number
  wave: number
  gameStatus: GameStatus
  canPlaceTowers: boolean
  gameLevel: number  // 游戏等级,影响塔生成概率
  mahjongPoolCount: number
  roundTiles: MahjongRoundTileView[]
  heldTileSuit: MahjongSuit | null
  functionTiles: MahjongHonor[]
  canGambleForHonor: boolean
  lastHonorGamble: 'success' | 'failure' | null
}
