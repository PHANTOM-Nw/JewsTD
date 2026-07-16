import { useState, useRef, useCallback } from 'react'
import { useGameLoop } from './useGameLoop'
import { usePathfinding } from '../pathfinding/usePathfinding'
import type {
  Enemy,
  Tower,
  Bullet,
  GridCell,
  GemType,
  MahjongAttachment,
  MahjongHonor,
  MahjongNumberTile,
  MahjongRoundTile,
  MahjongPresentationEvent,
  DamageNumber,
  DamageNumberType,
  PlacementPreview,
  UIState
} from '../types/game'
import { createEnemy, ENEMY_TYPES } from '../config/enemies'
import { WAVES } from '../config/waves'
import { initializeGrid, gridToPixel } from '../config/map'
import { ECONOMY_CONFIG } from '../config/economy'
import {
  MAHJONG_SUIT_COMBAT_CONFIG,
  beginMahjongRound,
  canGambleForMahjongHonor,
  createMahjongRandomStats,
  createMahjongTilePool,
  resolveMahjongHonorGamble,
  toMahjongRoundTileViews
} from '../config/mahjong'
import { soundManager, type SoundType } from '../services/audio'
import {
  canStartConfiguredWave,
  getStateAfterMineDamageBatch,
  getStatusAfterPlacement,
  getStatusAfterWave
} from './gameFlow'
import {
  PIERCE_DAMAGE_MULTIPLIER,
  advanceBullet,
  advancePoisonEffects,
  advanceTimedEffects,
  applyEnemyDamage,
  calculateDamage,
  selectPierceTarget,
  selectTowerTargets
} from './combat'
import {
  createBatchPlacementPreview,
  evaluateBatchPlacement,
  getRemainingBatchPlacements,
  type GridPosition
} from './building'
import { renderGameScene } from '../rendering/canvasRenderer'
import { advanceDamageNumbers, createDamageNumber } from './damageNumbers'
import {
  createPathMetrics,
  distanceToPathCursor,
  pathCursorToDistance,
  resolveEnemyQueueMovement,
  takeNextEnemySpawn
} from './enemyMovement'
import type {
  EnemyMovementIntent,
  ScheduledEnemySpawn
} from './enemyMovement'
import {
  calculateMahjongFormationStats,
  createSingleMahjongTowerState
} from './mahjongStats'
import {
  applyAttachMahjongHonorAction,
  applyFinalizeMahjongBatchAction,
  applyRemoveMahjongWallAction,
  applySynthesizeMahjongAction
} from './mahjongEngineActions'
import type {
  AttachMahjongHonorActionResult,
  MahjongEngineActionState,
  RemoveMahjongWallActionResult,
  SynthesizeMahjongActionResult,
  SynthesizeMahjongRequest
} from './mahjongEngineActions'
import {
  createAttackPlan,
  createMahjongAttackProfile,
  EMPTY_MAHJONG_TARGET_EFFECTS,
  resolveHitEffects
} from './mahjongAttack'
import type {
  BambooFocusState,
  MahjongAttackHitPlan,
  MahjongTargetEffectState
} from './mahjongAttack'
import {
  advanceMahjongRuntimeEffects,
  hasMahjongRuntimeEffects
} from './mahjongRuntimeEffects'

interface EngineUiState extends UIState {
  selectedGem: GemType | null
  availableGems: GemType[]
}

interface MahjongRuntimeState {
  pool: MahjongNumberTile[]
  roundTiles: MahjongRoundTile[]
  heldTile: MahjongNumberTile | null
  functionTiles: MahjongHonor[]
  handResolutionMode: 'choosing' | 'keeping' | null
}

interface EngineState {
  enemies: Enemy[]
  towers: Tower[]
  bullets: Bullet[]
  damageNumbers: DamageNumber[]
  damageNumberSequence: number
  grid: GridCell[][]
  storedTowerIds: string[]
  currentPath: { row: number; col: number }[] | null
  placementPreview: PlacementPreview | null
  waveInProgress: boolean
  spawnQueue: ScheduledEnemySpawn[]
  nextEnemySpawnSequence: number
  waveElapsedTime: number
  gameTime: number
  currentBatchTowerIds: string[]
  currentHealthMultiplier: number
  obstacleOrder: GridPosition[]
  mahjong: MahjongRuntimeState
  mahjongBulletHits: Map<string, MahjongAttackHitPlan>
  mahjongTargetEffects: Map<string, MahjongTargetEffectRuntime>
  mahjongBambooFocus: Map<string, BambooFocusState>
  mahjongPresentationEvents: MahjongPresentationEvent[]
  mahjongAttackSequence: number
}

interface MahjongTargetEffectRuntime {
  effects: MahjongTargetEffectState
  pendingPoisonDamage: number
  pendingBurnDamage: number
  displayElapsedMs: number
}

export type SynthesizeMahjongResult =
  | { ok: true; towerId: string }
  | { ok: false; reason: Extract<SynthesizeMahjongActionResult, { ok: false }>['reason'] }

export type AttachMahjongHonorResult =
  | { ok: true }
  | { ok: false; reason: Extract<AttachMahjongHonorActionResult, { ok: false }>['reason'] }

export type RemoveMahjongWallResult =
  | { ok: true; returnedTileId: string | null }
  | { ok: false; reason: Extract<RemoveMahjongWallActionResult, { ok: false }>['reason'] }

function toMahjongEngineActionState(
  state: EngineState,
  gold: number
): MahjongEngineActionState {
  return {
    towers: state.towers,
    storedTowerIds: state.storedTowerIds,
    grid: state.grid,
    obstacleOrder: state.obstacleOrder,
    functionTiles: state.mahjong.functionTiles,
    gold,
    pool: state.mahjong.pool
  }
}

function commitMahjongEngineActionState(
  state: EngineState,
  actionState: MahjongEngineActionState
) {
  state.towers = actionState.towers
  state.storedTowerIds = actionState.storedTowerIds
  state.grid = actionState.grid
  state.obstacleOrder = actionState.obstacleOrder
  state.mahjong.functionTiles = actionState.functionTiles
  state.mahjong.pool = actionState.pool
}

function createInitialMahjongState(): MahjongRuntimeState {
  const firstRound = beginMahjongRound(createMahjongTilePool(), null)
  return {
    pool: firstRound.pool,
    roundTiles: firstRound.roundTiles,
    heldTile: null,
    functionTiles: [],
    handResolutionMode: null
  }
}

function createMahjongUiState(mahjong: MahjongRuntimeState): Pick<EngineUiState,
  | 'mahjongPoolCount'
  | 'roundTiles'
  | 'heldTileSuit'
  | 'functionTiles'
  | 'canGambleForHonor'
  | 'lastHonorGamble'
> {
  const revealDrawnSuits = mahjong.handResolutionMode === 'keeping'
  return {
    mahjongPoolCount: mahjong.pool.length,
    roundTiles: toMahjongRoundTileViews(mahjong.roundTiles, revealDrawnSuits),
    heldTileSuit: mahjong.heldTile?.suit ?? null,
    functionTiles: [...mahjong.functionTiles],
    canGambleForHonor: mahjong.handResolutionMode === 'choosing'
      && canGambleForMahjongHonor(mahjong.roundTiles),
    lastHonorGamble: null
  }
}

function createInitialUiState(mahjong: MahjongRuntimeState): EngineUiState {
  return {
    wood: ECONOMY_CONFIG.startingWood,
    gold: ECONOMY_CONFIG.startingGold,
    mineHealth: ECONOMY_CONFIG.startingMineHealth,
    maxMineHealth: ECONOMY_CONFIG.startingMineHealth,
    wave: 0,
    gameStatus: 'building',
    selectedGem: null,
    availableGems: [],
    canPlaceTowers: true,
    gameLevel: 1,
    ...createMahjongUiState(mahjong)
  }
}

/**
 * 游戏引擎核心Hook
 * 
 * 整合所有游戏系统,包括:
 * - 资源管理(建造次数、金币、矿坑生命)
 * - 麻将牌池、拖拽建造、激活与留牌
 * - 敌人生成和移动
 * - 战斗系统(攻击、伤害计算、子弹追踪)
 * - 波次管理
 * - Canvas渲染
 * 
 * 使用示例:
 * ```typescript
 * const {
 *   uiState,
 *   gameStateRef,
 *   placeTower,
 *   finalizeTowers,
 *   keepMahjongHand,
 *   startWave,
 *   pause, resume, resetGame
 * } = useGameEngine()
 * ```
 */
export function useGameEngine() {
  // 寻路相关功能
  const { calculatePath } = usePathfinding()
  
  // ==================== UI状态(触发重渲染) ====================
  const initialMahjongStateRef = useRef<MahjongRuntimeState | null>(null)
  if (!initialMahjongStateRef.current) {
    initialMahjongStateRef.current = createInitialMahjongState()
  }

  const [uiState, setUiState] = useState<EngineUiState>(() => (
    createInitialUiState(initialMahjongStateRef.current!)
  ))
  const [hasActiveDamageNumbers, setHasActiveDamageNumbers] = useState(false)
  
  // ==================== 游戏对象状态(不触发重渲染,高频更新) ====================
  const gameStateRef = useRef<EngineState>(null!)
  if (!gameStateRef.current) {
    const grid = initializeGrid()
    gameStateRef.current = {
      enemies: [],
      towers: [],
      bullets: [],
      damageNumbers: [],
      damageNumberSequence: 0,
      grid,
      storedTowerIds: [],
      currentPath: calculatePath(grid),
      placementPreview: null,
      waveInProgress: false,
      spawnQueue: [],
      nextEnemySpawnSequence: 0,
      waveElapsedTime: 0,
      gameTime: 0,
      currentBatchTowerIds: [],
      currentHealthMultiplier: 1,
      obstacleOrder: [],
      mahjong: initialMahjongStateRef.current,
      mahjongBulletHits: new Map(),
      mahjongTargetEffects: new Map(),
      mahjongBambooFocus: new Map(),
      mahjongPresentationEvents: [],
      mahjongAttackSequence: 0
    }
  }

  // ==================== 核心方法 ====================

  const clearPlacementPreview = useCallback(() => {
    gameStateRef.current.placementPreview = null
  }, [])

  const selectRoundTile = useCallback((tileId: string | null) => {
    if (
      tileId !== null
      && !gameStateRef.current.mahjong.roundTiles.some(resource => resource.id === tileId)
    ) {
      return false
    }
    setUiState(prev => ({ ...prev, selectedGem: null }))
    return true
  }, [])

  const previewTowerPlacement = useCallback((
    gridPos: GridPosition,
    tileId?: string
  ) => {
    const state = gameStateRef.current
    if (
      uiState.gameStatus !== 'building'
      || !uiState.canPlaceTowers
      || uiState.wood < ECONOMY_CONFIG.towerWoodCost
      || state.currentBatchTowerIds.length >= ECONOMY_CONFIG.towersPerRound
      || !tileId
      || !state.mahjong.roundTiles.some(resource => resource.id === tileId)
    ) {
      state.placementPreview = null
      return null
    }

    const remainingPlacements = getRemainingBatchPlacements(
      ECONOMY_CONFIG.towersPerRound,
      state.currentBatchTowerIds.length
    )
    const preview = createBatchPlacementPreview(
      state.grid,
      gridPos,
      remainingPlacements
    )
    state.placementPreview = preview
    return preview
  }, [uiState.canPlaceTowers, uiState.gameStatus, uiState.wood])
  
  /** 将牌槽中的指定实体牌放到合法格，并立即以准确牌面翻开。 */
  const placeTower = useCallback((
    gridPos: { row: number; col: number },
    tileId?: string
  ) => {
    gameStateRef.current.placementPreview = null

    if (uiState.gameStatus !== 'building' || !uiState.canPlaceTowers) {
      console.warn('当前不能放置塔')
      return null
    }
    
    if (uiState.wood < ECONOMY_CONFIG.towerWoodCost) {
      alert('本轮建造次数已用完!')
      return null
    }

    if (gameStateRef.current.currentBatchTowerIds.length >= ECONOMY_CONFIG.towersPerRound) {
      return null
    }

    const tileResource = gameStateRef.current.mahjong.roundTiles.find(
      resource => resource.id === tileId
    )
    if (!tileResource) {
      console.warn('请从牌槽拖动一张暗牌到地图')
      return null
    }
    
    const { grid } = gameStateRef.current

    if (!grid[gridPos.row]?.[gridPos.col]) {
      return null
    }
    
    if (grid[gridPos.row][gridPos.col].type !== 'empty') {
      console.warn('该位置已有建筑,无法放置')
      return null
    }
    
    const remainingPlacements = getRemainingBatchPlacements(
      ECONOMY_CONFIG.towersPerRound,
      gameStateRef.current.currentBatchTowerIds.length
    )
    const placementResult = evaluateBatchPlacement(
      grid,
      gridPos,
      remainingPlacements
    )

    if (!placementResult.canPlace) {
      alert(placementResult.failure === 'insufficient_capacity'
        ? '这里会让本轮剩余麻将牌没有足够的安全位置!'
        : '不能堵死路径!')
      return null
    }

    const originalStats = createMahjongRandomStats(tileResource.tile.suit)
    const mahjongState = createSingleMahjongTowerState(tileResource.tile, originalStats)
    const stats = calculateMahjongFormationStats(
      mahjongState.activeSources,
      mahjongState.formation,
      mahjongState.suit
    )
    const pixelPos = gridToPixel(gridPos.row, gridPos.col)
    
    const newTower: Tower = {
      id: `tower_${Date.now()}_${Math.random()}`,
      mahjongTile: tileResource.tile,
      mahjongState,
      level: 'chipped',
      gridPosition: gridPos,
      position: pixelPos,
      damage: stats.damage,
      range: stats.attackRange,
      attackSpeed: stats.attackIntervalMs,
      lastAttackTime: 0,
      damageType: MAHJONG_SUIT_COMBAT_CONFIG[tileResource.tile.suit].damageType,
    }
    
    // 添加到地图(标记为临时塔)
    gameStateRef.current.towers.push(newTower)
    
    gameStateRef.current.currentBatchTowerIds.push(newTower.id)
    gameStateRef.current.mahjong.roundTiles = gameStateRef.current.mahjong.roundTiles.filter(
      resource => resource.id !== tileResource.id
    )
    const nextBuildState = getStatusAfterPlacement(
      gameStateRef.current.currentBatchTowerIds.length,
      ECONOMY_CONFIG.towersPerRound
    )
    setUiState(prev => ({
      ...prev,
      wood: prev.wood - ECONOMY_CONFIG.towerWoodCost,
      ...createMahjongUiState(gameStateRef.current.mahjong),
      ...nextBuildState
    }))
    
    // 地图格只记录塔身份；准确牌面由塔实体统一提供。
    grid[gridPos.row][gridPos.col] = {
      ...grid[gridPos.row][gridPos.col],
      type: 'tower',
      towerId: newTower.id,
      mahjongTile: undefined
    }
    
    // 重新计算路径
    gameStateRef.current.currentPath = placementResult.path
    
    return newTower
  }, [uiState.canPlaceTowers, uiState.gameStatus, uiState.wood])

  /** 从本轮三张落地牌中激活一张，其余两张原地成为永久牌墙。 */
  const finalizeTowers = useCallback((keepTowerId: string) => {
    const state = gameStateRef.current

    if (uiState.gameStatus !== 'deciding') return false
    const result = applyFinalizeMahjongBatchAction(
      toMahjongEngineActionState(state, uiState.gold),
      state.currentBatchTowerIds,
      keepTowerId
    )
    if (!result.ok) return false

    commitMahjongEngineActionState(state, result.state)
    
    // 清空当前批次列表
    state.currentBatchTowerIds = []

    state.mahjong.handResolutionMode = canGambleForMahjongHonor(
      state.mahjong.roundTiles
    ) ? 'choosing' : 'keeping'
    
    setUiState(prev => ({
      ...prev,
      wood: 0,
      gameStatus: 'resolving_hand',
      canPlaceTowers: false,
      ...createMahjongUiState(state.mahjong)
    }))
    return true
  }, [uiState.gameStatus, uiState.gold])

  const keepMahjongHand = useCallback((tileId: string) => {
    if (uiState.gameStatus !== 'resolving_hand') return false

    const state = gameStateRef.current
    if (state.mahjong.handResolutionMode !== 'keeping') return false
    const selected = state.mahjong.roundTiles.find(resource => resource.id === tileId)
    if (!selected) return false

    state.mahjong.heldTile = selected.tile
    state.mahjong.pool.push(...state.mahjong.roundTiles
      .filter(resource => resource.id !== tileId)
      .map(resource => resource.tile))
    state.mahjong.roundTiles = []
    state.mahjong.handResolutionMode = null

    setUiState(prev => ({
      ...prev,
      gameStatus: 'ready',
      heldTileSuit: selected.tile.suit,
      roundTiles: [],
      mahjongPoolCount: state.mahjong.pool.length,
      canGambleForHonor: false,
      lastHonorGamble: null
    }))
    return true
  }, [uiState.gameStatus])

  const revealMahjongHandSuits = useCallback(() => {
    if (uiState.gameStatus !== 'resolving_hand') return false

    const state = gameStateRef.current
    if (
      state.mahjong.handResolutionMode !== 'choosing'
      || !canGambleForMahjongHonor(state.mahjong.roundTiles)
    ) {
      return false
    }

    state.mahjong.handResolutionMode = 'keeping'
    setUiState(prev => ({
      ...prev,
      ...createMahjongUiState(state.mahjong)
    }))
    return true
  }, [uiState.gameStatus])

  const gambleForMahjongHonor = useCallback(() => {
    if (uiState.gameStatus !== 'resolving_hand') return false

    const state = gameStateRef.current
    if (
      state.mahjong.handResolutionMode !== 'choosing'
      || !canGambleForMahjongHonor(state.mahjong.roundTiles)
    ) {
      return false
    }

    const result = resolveMahjongHonorGamble(state.mahjong.roundTiles)
    state.mahjong.pool.push(...state.mahjong.roundTiles.map(resource => resource.tile))
    state.mahjong.roundTiles = []
    state.mahjong.heldTile = null
    state.mahjong.handResolutionMode = null
    if (result.honor) state.mahjong.functionTiles.push(result.honor)

    setUiState(prev => ({
      ...prev,
      gameStatus: 'ready',
      heldTileSuit: null,
      roundTiles: [],
      functionTiles: [...state.mahjong.functionTiles],
      mahjongPoolCount: state.mahjong.pool.length,
      canGambleForHonor: false,
      lastHonorGamble: result.success ? 'success' : 'failure'
    }))
    return true
  }, [uiState.gameStatus])

  const synthesizeMahjong = useCallback((
    request: SynthesizeMahjongRequest
  ): SynthesizeMahjongResult => {
    const state = gameStateRef.current
    const result = applySynthesizeMahjongAction(
      toMahjongEngineActionState(state, uiState.gold),
      uiState.gameStatus,
      request
    )
    if (!result.ok) return { ok: false, reason: result.reason }

    commitMahjongEngineActionState(state, result.state)
    state.currentPath = calculatePath(state.grid)
    setUiState(prev => ({
      ...prev,
      gold: result.state.gold,
      functionTiles: [...result.state.functionTiles],
      mahjongPoolCount: result.state.pool.length
    }))
    return { ok: true, towerId: result.towerId }
  }, [calculatePath, uiState.gameStatus, uiState.gold])

  const attachMahjongHonor = useCallback((
    towerId: string,
    attachment: MahjongAttachment
  ): AttachMahjongHonorResult => {
    const state = gameStateRef.current
    const result = applyAttachMahjongHonorAction(
      toMahjongEngineActionState(state, uiState.gold),
      uiState.gameStatus,
      towerId,
      attachment
    )
    if (!result.ok) return { ok: false, reason: result.reason }

    commitMahjongEngineActionState(state, result.state)
    setUiState(prev => ({
      ...prev,
      functionTiles: [...result.state.functionTiles]
    }))
    return { ok: true }
  }, [uiState.gameStatus, uiState.gold])

  const removeMahjongWall = useCallback((
    position: GridPosition
  ): RemoveMahjongWallResult => {
    const state = gameStateRef.current
    const result = applyRemoveMahjongWallAction(
      toMahjongEngineActionState(state, uiState.gold),
      uiState.gameStatus,
      position
    )
    if (!result.ok) return { ok: false, reason: result.reason }

    commitMahjongEngineActionState(state, result.state)
    state.currentPath = calculatePath(state.grid)
    setUiState(prev => ({
      ...prev,
      gold: result.state.gold,
      mahjongPoolCount: result.state.pool.length
    }))
    return {
      ok: true,
      returnedTileId: result.returnedTileId
    }
  }, [calculatePath, uiState.gameStatus, uiState.gold])
  
  /**
   * 开始下一波敌人
   * 
   * 流程:
   * 1. 检查是否还有剩余波次
   * 2. 根据波次配置生成敌人生成队列(应用血量倍率)
   * 3. 锁定放置阶段(波次中不能放置塔)
   * 4. 清空可用宝石
   * 
   * 注意:此函数会自动递增波次数
   */
  const startWave = useCallback(() => {
    const { wave } = uiState

    if (!canStartConfiguredWave(
      uiState.gameStatus,
      wave,
      WAVES.length,
      Boolean(gameStateRef.current.currentPath)
    )) {
      return false
    }
    
    const waveConfig = WAVES[wave]
    const healthMultiplier = waveConfig.healthMultiplier || 1.0
    
    console.log(`🌊 开始第${wave + 1}波`)
    console.log(`  血量倍率: ${healthMultiplier}x`)
    
    // ✅ 保存当前波次的血量倍率
    gameStateRef.current.currentHealthMultiplier = healthMultiplier
    
    // 生成敌人生成队列
    const spawnQueue: ScheduledEnemySpawn[] = []
    let currentTime = 0
    
    waveConfig.enemies.forEach(enemyConfig => {
      for (let i = 0; i < enemyConfig.count; i++) {
        spawnQueue.push({
          type: enemyConfig.type,
          delay: currentTime
        })
        currentTime += enemyConfig.interval
      }
    })
    
    spawnQueue.sort((a, b) => a.delay - b.delay)
    
    console.log('生成队列:', spawnQueue) // 调试日志
    
    gameStateRef.current.spawnQueue = spawnQueue
    gameStateRef.current.waveElapsedTime = 0
    gameStateRef.current.waveInProgress = true
    gameStateRef.current.placementPreview = null
    
    // 锁定放置阶段,波次中不能放置塔
    setUiState(prev => ({
      ...prev,
      wood: 0,  // 波次中剩余建造次数为0
      wave: prev.wave + 1,
      gameStatus: 'playing',
      canPlaceTowers: false,
      availableGems: [],
      selectedGem: null
    }))
    return true
  }, [uiState.gameStatus, uiState.wave])
  
  // ==================== Update函数 ====================

  const queueDamageNumber = useCallback((
    enemy: Enemy,
    amount: number,
    damageType: DamageNumberType,
    critical = false
  ) => {
    if (
      enemy.isDead ||
      enemy.reachedEnd ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return false
    }

    const state = gameStateRef.current
    const sequence = state.damageNumberSequence
    const wasEmpty = state.damageNumbers.length === 0
    state.damageNumberSequence += 1
    state.damageNumbers.push(createDamageNumber({
      sequence,
      position: enemy.position,
      amount,
      damageType,
      critical
    }))

    if (wasEmpty) setHasActiveDamageNumbers(true)
    return true
  }, [])
  
  /**
   * 更新敌人位置和状态
   * 
   * 处理:
   * - 沿路径移动
   * - 减速效果计时
   * - 毒素持续伤害
   * - 眩晕状态更新
   * - 到达终点扣除矿坑生命
   * - 清理已到达终点的敌人
   * 
   * @param deltaTime - 距离上一帧的时间间隔(ms)
   */
  const updateEnemies = useCallback((deltaTime: number) => {
    const { enemies, currentPath } = gameStateRef.current
    
    if (!currentPath || currentPath.length === 0) return
    
    const pathMetrics = createPathMetrics(
      currentPath.map(point => gridToPixel(point.row, point.col))
    )
    const movementIntents: EnemyMovementIntent[] = []

    enemies.forEach(enemy => {
      if (enemy.reachedEnd || enemy.isDead) return

      if (enemy.mahjongVisualEffects) {
        enemy.mahjongVisualEffects.armorBreakTimer = Math.max(
          0,
          (enemy.mahjongVisualEffects.armorBreakTimer ?? 0) - deltaTime
        )
      }
      
      // ========== 更新毒素效果 ==========
      if (enemy.poisonEffects && enemy.poisonEffects.length > 0) {
        const poisonUpdate = advancePoisonEffects(enemy.poisonEffects, deltaTime)
        enemy.poisonEffects = poisonUpdate.effects

        if (poisonUpdate.damage > 0) {
          queueDamageNumber(enemy, poisonUpdate.damage, 'poison')
          if (applyEnemyDamage(enemy, poisonUpdate.damage)) {
            setUiState(prev => ({ ...prev, gold: prev.gold + enemy.reward }))
          }
        }
      }

      const state = gameStateRef.current
      if (enemy.isDead) {
        state.mahjongTargetEffects.delete(enemy.id)
        return
      }

      const mahjongRuntime = state.mahjongTargetEffects.get(enemy.id)
      if (mahjongRuntime) {
        const effectUpdate = advanceMahjongRuntimeEffects(
          mahjongRuntime.effects,
          state.gameTime,
          deltaTime
        )
        let pendingPoisonDamage = mahjongRuntime.pendingPoisonDamage
          + effectUpdate.poisonDamage
        let pendingBurnDamage = mahjongRuntime.pendingBurnDamage
          + effectUpdate.burnDamage
        const displayElapsedMs = mahjongRuntime.displayElapsedMs + deltaTime
        const totalDamage = effectUpdate.poisonDamage + effectUpdate.burnDamage
        const damageIsLethal = totalDamage >= enemy.health
        const shouldDisplayDamage = displayElapsedMs >= 1000
          || damageIsLethal
          || !hasMahjongRuntimeEffects(effectUpdate.effects)

        if (shouldDisplayDamage) {
          queueDamageNumber(enemy, pendingPoisonDamage, 'poison')
          queueDamageNumber(enemy, pendingBurnDamage, 'burn')
          pendingPoisonDamage = 0
          pendingBurnDamage = 0
        }

        if (totalDamage > 0 && applyEnemyDamage(enemy, totalDamage)) {
          setUiState(prev => ({ ...prev, gold: prev.gold + enemy.reward }))
        }

        const visualEffects = enemy.mahjongVisualEffects ?? {}
        visualEffects.poisonStacks = effectUpdate.effects.poisons.reduce(
          (total, poison) => total + poison.stacks,
          0
        )
        visualEffects.burnTimer = effectUpdate.effects.burn
          ? Math.max(0, effectUpdate.effects.burn.expiresAtMs - state.gameTime)
          : 0
        enemy.mahjongVisualEffects = visualEffects

        if (enemy.isDead) {
          state.mahjongTargetEffects.delete(enemy.id)
          return
        }

        if (
          hasMahjongRuntimeEffects(effectUpdate.effects)
          || pendingPoisonDamage > 0
          || pendingBurnDamage > 0
        ) {
          state.mahjongTargetEffects.set(enemy.id, {
            effects: effectUpdate.effects,
            pendingPoisonDamage,
            pendingBurnDamage,
            displayElapsedMs: shouldDisplayDamage ? 0 : displayElapsedMs
          })
        } else {
          state.mahjongTargetEffects.delete(enemy.id)
        }
      } else if (enemy.mahjongVisualEffects) {
        enemy.mahjongVisualEffects.poisonStacks = 0
        enemy.mahjongVisualEffects.burnTimer = 0
      }
      
      // ========== 更新眩晕和减速状态，收集自由移动意图 ==========
      const wasSlowed = (enemy.slowTimer ?? 0) > 0
      const wasStunned = Boolean(
        enemy.isStunned && (enemy.stunTimer ?? 0) > 0
      )
      const timedEffectUpdate = advanceTimedEffects(enemy, deltaTime)
      enemy.isStunned = timedEffectUpdate.isStunned
      enemy.stunTimer = timedEffectUpdate.stunTimer
      enemy.slowTimer = timedEffectUpdate.slowTimer
      enemy.slowEffect = timedEffectUpdate.slowEffect

      movementIntents.push({
        id: enemy.id,
        spawnSequence: enemy.spawnSequence,
        pathDistance: pathCursorToDistance(pathMetrics, enemy),
        radius: ENEMY_TYPES[enemy.type].radius,
        baseSpeed: enemy.speed,
        freeTravelDistance: timedEffectUpdate.travelDistance,
        isSlowed: wasSlowed,
        isStunned: wasStunned
      })
    })

    const movementById = new Map(
      resolveEnemyQueueMovement(
        movementIntents,
        pathMetrics.totalDistance,
        deltaTime
      ).map(movement => [movement.id, movement])
    )
    const escapedEnemies: Enemy[] = []

    enemies.forEach(enemy => {
      const movement = movementById.get(enemy.id)
      if (!movement || enemy.reachedEnd || enemy.isDead) return

      const cursor = distanceToPathCursor(pathMetrics, movement.pathDistance)
      enemy.pathIndex = cursor.pathIndex
      enemy.progress = cursor.progress
      enemy.position = { ...cursor.position }

      if (movement.reachedEnd) {
        enemy.reachedEnd = true
        escapedEnemies.push(enemy)
      }
    })

    if (escapedEnemies.length > 0) {
      escapedEnemies.forEach(enemy => {
        gameStateRef.current.mahjongTargetEffects.delete(enemy.id)
      })
      setUiState(prev => {
        const mineResult = getStateAfterMineDamageBatch(
          prev.mineHealth,
          escapedEnemies.map(enemy => enemy.mineDamage),
          prev.gameStatus
        )

        return { ...prev, ...mineResult }
      })
    }
    
    // 清理到达终点或死亡的敌人
    gameStateRef.current.enemies = enemies.filter(e => !e.reachedEnd && !e.isDead)
  }, [queueDamageNumber])
  
  /**
   * 根据生成队列生成敌人
   * 
   * 处理:
   * - 累计波次时间并检查队首是否到期
   * - 入口净空时生成敌人并分配稳定序号
   * - 入口被占用时保留队首，延迟到后续帧重试
   * 
   * @param deltaTime - 距离上一帧的时间间隔(ms)
   */
  const spawnEnemies = useCallback((deltaTime: number) => {
    const state = gameStateRef.current
    const { currentHealthMultiplier } = state
    
    if (!gameStateRef.current.waveInProgress) return
    if (state.spawnQueue.length === 0) return
    
    gameStateRef.current.waveElapsedTime += deltaTime
    const elapsedTime = gameStateRef.current.waveElapsedTime
    
    // 生成敌人
    while (state.spawnQueue.length > 0) {
      const path = state.currentPath
      
      if (!path || path.length === 0) {
        console.warn('没有路径可以生成敌人!')
        break
      }

      const pathMetrics = createPathMetrics(
        path.map(point => gridToPixel(point.row, point.col))
      )
      const occupants = state.enemies
        .filter(enemy => !enemy.isDead && !enemy.reachedEnd)
        .map(enemy => ({
          pathDistance: pathCursorToDistance(pathMetrics, enemy),
          radius: ENEMY_TYPES[enemy.type].radius
        }))
      const spawnResolution = takeNextEnemySpawn(
        state.spawnQueue,
        elapsedTime,
        occupants,
        state.nextEnemySpawnSequence
      )

      if (!spawnResolution.spawn) break

      state.spawnQueue = [...spawnResolution.queue]
      state.nextEnemySpawnSequence = spawnResolution.nextSpawnSequence
      
      const startPos = path[0]
      const pixelPos = gridToPixel(startPos.row, startPos.col)
      
      // ✅ 应用血量倍率创建敌人
      const newEnemy = createEnemy(
        spawnResolution.spawn.type,
        pixelPos,
        currentHealthMultiplier,
        spawnResolution.spawn.spawnSequence
      )
      
      state.enemies.push(newEnemy)
      console.log(`生成敌人: ${spawnResolution.spawn.type}, 血量=${newEnemy.health} (${currentHealthMultiplier}x)`) // 调试日志
    }
  }, [])
  
  /**
   * 处理塔的攻击逻辑
   * 
   * 处理:
   * - 查找范围内的敌人
   * - 选择最近的敌人作为目标
   * - 检查冷却时间
   * - 创建子弹
   * - 🎵 播放攻击音效
   * 
   * @param deltaTime - 距离上一帧的时间间隔(ms)
   */
  const processTowerAttacks = useCallback(() => {
    const state = gameStateRef.current
    const { towers, enemies } = state
    const now = state.gameTime
    
    towers.forEach(tower => {
      const mahjongState = tower.mahjongState
      const targetingTower = mahjongState?.formation === 'chow'
        ? { ...tower, multiTarget: 3 }
        : tower
      const targets = selectTowerTargets(targetingTower, enemies)
      if (targets.length === 0) return

      if (mahjongState) {
        const profile = createMahjongAttackProfile(
          tower.id,
          mahjongState,
          tower.damage
        )
        const previousFocus = state.mahjongBambooFocus.get(tower.id)
        if (
          previousFocus
          && (
            previousFocus.targetId !== targets[0].id
            || now - previousFocus.lastHitAtMs >= (profile.focusFire?.resetAfterMs ?? Infinity)
          )
        ) {
          state.mahjongBambooFocus.delete(tower.id)
        }
        const sequence = state.mahjongAttackSequence
        const cycleId = `${tower.id}:${sequence}`
        const attackPlan = createAttackPlan({
          cycleId,
          profile,
          targetIds: targets.map(target => target.id),
          nowMs: now,
          bambooFocus: state.mahjongBambooFocus.get(tower.id)
        })
        const attackInterval = tower.attackSpeed / attackPlan.attackFrequencyMultiplier
        if (now - tower.lastAttackTime < attackInterval) return

        state.mahjongAttackSequence += 1
        attackPlan.hits.forEach((hit, index) => {
          const bulletId = `mahjong_bullet_${sequence}_${index}`
          const bullet: Bullet = {
            id: bulletId,
            position: { ...tower.position },
            originPosition: { ...tower.position },
            attackRange: tower.range,
            targetId: hit.targetId,
            damage: hit.rawDamage,
            damageType: hit.damageType,
            speed: 300,
            mahjongVisual: {
              suit: mahjongState.suit,
              formation: mahjongState.formation,
              attachments: [...mahjongState.attachments],
              cycleId,
              projectileCount: hit.projectileCount,
              attackStartedAtMs: now
            }
          }
          state.mahjongBulletHits.set(bulletId, hit)
          state.bullets.push(bullet)
        })
        tower.lastAttackTime = now

        const soundType: SoundType = mahjongState.suit === 'characters'
          ? 'ruby'
          : mahjongState.suit === 'bamboo'
            ? 'emerald'
            : 'opal'
        soundManager.play(soundType)
        return
      }
      
      // 检查冷却时间
      if (now - tower.lastAttackTime >= tower.attackSpeed) {
        targets.forEach(target => {
          const bullet: Bullet = {
            id: `bullet_${Date.now()}_${Math.random()}`,
            position: { ...tower.position },
            originPosition: { ...tower.position },
            attackRange: tower.range,
            targetId: target.id,
            damage: tower.damage,
            damageType: tower.damageType,
            speed: 300,
            splashRadius: tower.splashRadius,
            slowEffect: tower.slowEffect,
            critChance: tower.critChance,
            critMultiplier: tower.critMultiplier,
            poisonDamage: tower.poisonDamage,
            poisonDuration: tower.poisonDuration,
            stunChance: tower.stunChance,
            stunDuration: tower.stunDuration,
            pierce: tower.pierce
          }

          state.bullets.push(bullet)
        })
        tower.lastAttackTime = now
        
        // 🎵 播放攻击音效
        const soundType: SoundType = tower.mahjongTile
          ? 'diamond'
          : tower.specialType || (tower.gemType as SoundType)
        soundManager.play(soundType)
      }
    })
  }, [])
  
  /**
   * 应用伤害到敌人
   * 
   * 伤害计算公式:
   * - 物理伤害: damage * (1 - armor / (armor + 10))
   * - 魔法伤害: damage * (1 - magicResist)
   * - 纯粹伤害: 无视减免
   * 
   * 额外效果:
   * - 溅射:对范围内其他敌人造成50%伤害
   * - 减速:施加3秒减速效果
   * - 暴击:根据概率造成倍率伤害
   * - 毒素:持续造成伤害
   * - 眩晕:随机概率使敌人停止移动
   * 
   * @param enemy - 目标敌人
   * @param bullet - 子弹
   */
  const applyDamage = useCallback((enemy: Enemy, bullet: Bullet) => {
    const damageTarget = (
      target: Enemy,
      damage: number,
      damageType: DamageNumberType,
      critical = false
    ) => {
      if (!queueDamageNumber(target, damage, damageType, critical)) return

      if (applyEnemyDamage(target, damage)) {
        setUiState(prev => ({ ...prev, gold: prev.gold + target.reward }))
      }
    }

    const state = gameStateRef.current
    const mahjongHit = state.mahjongBulletHits.get(bullet.id)
    if (mahjongHit) {
      state.mahjongBulletHits.delete(bullet.id)
      const currentRuntime = state.mahjongTargetEffects.get(enemy.id)
      const previousStunExpiry = currentRuntime?.effects.stun?.expiresAtMs
        ?? state.gameTime
      const resolved = resolveHitEffects({
        hit: mahjongHit,
        target: enemy,
        targetEffects: currentRuntime?.effects ?? EMPTY_MAHJONG_TARGET_EFFECTS,
        bambooFocus: state.mahjongBambooFocus.get(mahjongHit.sourceId),
        nowMs: state.gameTime,
        random: Math.random
      })

      if (bullet.mahjongVisual) {
        state.mahjongPresentationEvents.push({
          id: `mahjong-impact-${bullet.id}`,
          position: { ...enemy.position },
          suit: bullet.mahjongVisual.suit,
          formation: bullet.mahjongVisual.formation,
          attachments: [...bullet.mahjongVisual.attachments],
          projectileCount: bullet.mahjongVisual.projectileCount,
          startedAtGameTimeMs: state.gameTime,
          elapsedMs: 0,
          durationMs: 560,
          executed: resolved.executed,
          stunTriggered: (resolved.targetEffects.stun?.expiresAtMs ?? 0) > previousStunExpiry
        })
      }

      damageTarget(
        enemy,
        resolved.damage,
        resolved.executed ? 'pure' : mahjongHit.damageType,
        resolved.critical
      )
      if (resolved.bambooFocus) {
        state.mahjongBambooFocus.set(mahjongHit.sourceId, resolved.bambooFocus)
      }

      if (resolved.splash) {
        state.enemies.forEach(otherEnemy => {
          if (
            otherEnemy.id === enemy.id
            || otherEnemy.isDead
            || otherEnemy.reachedEnd
          ) return

          const distance = Math.hypot(
            otherEnemy.position.x - enemy.position.x,
            otherEnemy.position.y - enemy.position.y
          )
          if (distance > resolved.splash!.radius) return

          const splashDamage = calculateDamage(
            resolved.splash!.rawDamage,
            resolved.splash!.damageType,
            otherEnemy,
            0,
            1,
            1
          )
          damageTarget(
            otherEnemy,
            splashDamage.damage,
            resolved.splash!.damageType
          )
        })
      }

      if (!enemy.isDead) {
        const effects = resolved.targetEffects
        state.mahjongTargetEffects.set(enemy.id, {
          effects,
          pendingPoisonDamage: currentRuntime?.pendingPoisonDamage ?? 0,
          pendingBurnDamage: currentRuntime?.pendingBurnDamage ?? 0,
          displayElapsedMs: currentRuntime?.displayElapsedMs ?? 0
        })

        if (effects.slow) {
          enemy.slowTimer = Math.max(
            enemy.slowTimer ?? 0,
            effects.slow.expiresAtMs - state.gameTime
          )
          enemy.slowEffect = Math.max(
            enemy.slowEffect ?? 0,
            effects.slow.amount
          )
        }
        if (effects.stun) {
          enemy.isStunned = true
          enemy.stunTimer = Math.max(
            enemy.stunTimer ?? 0,
            effects.stun.expiresAtMs - state.gameTime
          )
        }

        const visualEffects = enemy.mahjongVisualEffects ?? {}
        if (resolved.armorIgnore > 0) visualEffects.armorBreakTimer = 350
        visualEffects.poisonStacks = effects.poisons.reduce(
          (total, poison) => total + poison.stacks,
          0
        )
        visualEffects.burnTimer = effects.burn
          ? Math.max(0, effects.burn.expiresAtMs - state.gameTime)
          : 0
        enemy.mahjongVisualEffects = visualEffects
      } else {
        state.mahjongTargetEffects.delete(enemy.id)
      }

      state.enemies = state.enemies.filter(candidate => !candidate.isDead)
      return
    }

    const damageResult = calculateDamage(
      bullet.damage,
      bullet.damageType,
      enemy,
      bullet.critChance,
      bullet.critMultiplier
    )
    damageTarget(
      enemy,
      damageResult.damage,
      bullet.damageType,
      damageResult.critical
    )

    const damageSecondaryTarget = (target: Enemy, multiplier: number) => {
      const result = calculateDamage(
        bullet.damage * multiplier,
        bullet.damageType,
        target,
        0,
        1,
        1
      )
      damageTarget(target, result.damage, bullet.damageType, result.critical)
    }
    
    // ========== 溅射效果 ==========
    if (bullet.splashRadius !== undefined) {
      const splashRadius = bullet.splashRadius
      const { enemies } = gameStateRef.current
      enemies.forEach(otherEnemy => {
        if (otherEnemy.id === enemy.id || otherEnemy.isDead) return
        
        const dx = otherEnemy.position.x - enemy.position.x
        const dy = otherEnemy.position.y - enemy.position.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance <= splashRadius) {
          damageSecondaryTarget(otherEnemy, 0.5)
        }
      })
    }

    // ========== 穿透效果 ==========
    if (bullet.pierce) {
      const nextTarget = selectPierceTarget(
        enemy,
        gameStateRef.current.enemies
      )

      if (nextTarget) {
        damageSecondaryTarget(nextTarget, PIERCE_DAMAGE_MULTIPLIER)
      }
    }

    if (!enemy.isDead) {
      // ========== 减速效果 ==========
      if (bullet.slowEffect) {
        enemy.slowTimer = 3000 // 减速3秒
        enemy.slowEffect = Math.max(enemy.slowEffect ?? 0, bullet.slowEffect)
      }

      // ========== 毒素效果 ==========
      if (bullet.poisonDamage && bullet.poisonDuration) {
        if (!enemy.poisonEffects) {
          enemy.poisonEffects = []
        }

        enemy.poisonEffects.push({
          damage: bullet.poisonDamage,
          duration: bullet.poisonDuration,
          tickAccumulator: 0
        })
      }
      
      // ========== 眩晕效果 ==========
      if (bullet.stunChance && Math.random() < bullet.stunChance) {
        enemy.isStunned = true
        enemy.stunTimer = Math.max(enemy.stunTimer ?? 0, bullet.stunDuration || 1000)
      }
    }

    if (enemy.isDead) {
      gameStateRef.current.enemies = gameStateRef.current.enemies.filter(
        e => e.id !== enemy.id
      )
    }
  }, [queueDamageNumber])
  
  /**
   * 更新子弹位置和碰撞检测
   * 
   * 处理:
   * - 子弹向目标移动
   * - 检测是否命中目标
   * - 命中后应用伤害
   * - 清理无效子弹(目标已死亡)
   * 
   * @param deltaTime - 距离上一帧的时间间隔(ms)
   */
  const updateBullets = useCallback((deltaTime: number) => {
    const { bullets, enemies } = gameStateRef.current
    
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i]
      const target = enemies.find(
        enemy => enemy.id === bullet.targetId && !enemy.isDead && !enemy.reachedEnd
      )
      
      if (!target) {
        // 目标已死亡,移除子弹
        gameStateRef.current.mahjongBulletHits.delete(bullet.id)
        bullets.splice(i, 1)
        continue
      }
      
      const movement = advanceBullet(bullet, target, deltaTime)

      if (movement.status === 'out_of_range') {
        gameStateRef.current.mahjongBulletHits.delete(bullet.id)
        bullets.splice(i, 1)
      } else if (movement.status === 'hit') {
        // 命中目标
        applyDamage(target, bullet)
        bullets.splice(i, 1)
      } else {
        // 继续移动
        bullet.position = movement.position
      }
    }
  }, [applyDamage])
  
  /**
   * 主更新函数
   * 
   * 按顺序执行:
   * 1. 生成敌人
   * 2. 更新敌人位置
   * 3. 处理塔攻击
   * 4. 更新子弹
   * 5. 检查波次是否完成
   * 
   * @param deltaTime - 距离上一帧的时间间隔(ms)
   */
  const update = useCallback((deltaTime: number) => {
    const state = gameStateRef.current
    const hadActiveDamageNumbers = state.damageNumbers.length > 0
    state.damageNumbers = advanceDamageNumbers(state.damageNumbers, deltaTime)
    state.mahjongPresentationEvents = state.mahjongPresentationEvents
      .map(event => ({
        ...event,
        elapsedMs: Math.min(event.durationMs, event.elapsedMs + Math.max(0, deltaTime))
      }))
      .filter(event => event.elapsedMs < event.durationMs)
    if (hadActiveDamageNumbers && state.damageNumbers.length === 0) {
      setHasActiveDamageNumbers(false)
    }

    if (uiState.gameStatus !== 'playing') return
    
    gameStateRef.current.gameTime += deltaTime
    spawnEnemies(deltaTime)
    updateEnemies(deltaTime)
    processTowerAttacks()
    updateBullets(deltaTime)
    
    // 检查波次是否完成
    if (gameStateRef.current.waveInProgress) {
      const allEnemiesDead = gameStateRef.current.enemies.every(e => e.isDead)
      const noMoreSpawns = gameStateRef.current.spawnQueue.length === 0
      
      if (allEnemiesDead && noMoreSpawns) {
        // 波次完成
        gameStateRef.current.waveInProgress = false
        gameStateRef.current.bullets = []
        gameStateRef.current.mahjongBulletHits.clear()
        gameStateRef.current.mahjongTargetEffects.clear()
        gameStateRef.current.mahjongBambooFocus.clear()

        const nextStatus = getStatusAfterWave(uiState.wave, WAVES.length)
        if (nextStatus === 'building') {
          const state = gameStateRef.current
          const nextRound = beginMahjongRound(
            state.mahjong.pool,
            state.mahjong.heldTile
          )
          state.mahjong.pool = nextRound.pool
          state.mahjong.roundTiles = nextRound.roundTiles
          state.mahjong.heldTile = null
          state.mahjong.handResolutionMode = null
        }
        
        setUiState(prev => {
          if (prev.gameStatus === 'game_over') return prev

          const nextStatus = getStatusAfterWave(prev.wave, WAVES.length)
          const canBuild = nextStatus === 'building'
          return {
            ...prev,
            wood: canBuild ? ECONOMY_CONFIG.woodPerRound : 0,
            gameStatus: nextStatus,
            canPlaceTowers: canBuild,
            ...(canBuild ? createMahjongUiState(gameStateRef.current.mahjong) : {})
          }
        })
        
        console.log(`第${uiState.wave}波完成!`)
      }
    }
  }, [uiState.gameStatus, uiState.wave, spawnEnemies, updateEnemies, processTowerAttacks, updateBullets])
  
  // ==================== Render函数 ====================

  const render = useCallback(() => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    renderGameScene(ctx, gameStateRef.current)
  }, [])
  
  // ==================== 整合游戏循环 ====================
  
  useGameLoop(
    update,
    render,
    uiState.gameStatus !== 'paused' && (
      uiState.gameStatus === 'building' ||
        uiState.gameStatus === 'deciding' ||
        uiState.gameStatus === 'resolving_hand' ||
        uiState.gameStatus === 'ready' ||
        uiState.gameStatus === 'playing' ||
        hasActiveDamageNumbers
    )
  )

  const pause = useCallback(() => {
    setUiState(prev => prev.gameStatus === 'playing'
      ? { ...prev, gameStatus: 'paused' }
      : prev)
  }, [])

  const resume = useCallback(() => {
    setUiState(prev => prev.gameStatus === 'paused'
      ? { ...prev, gameStatus: 'playing' }
      : prev)
  }, [])

  const resetGame = useCallback(() => {
    const grid = initializeGrid()
    const mahjong = createInitialMahjongState()
    gameStateRef.current = {
      enemies: [],
      towers: [],
      bullets: [],
      damageNumbers: [],
      damageNumberSequence: 0,
      grid,
      storedTowerIds: [],
      currentPath: calculatePath(grid),
      placementPreview: null,
      waveInProgress: false,
      spawnQueue: [],
      nextEnemySpawnSequence: 0,
      waveElapsedTime: 0,
      gameTime: 0,
      currentBatchTowerIds: [],
      currentHealthMultiplier: 1,
      obstacleOrder: [],
      mahjong,
      mahjongBulletHits: new Map(),
      mahjongTargetEffects: new Map(),
      mahjongBambooFocus: new Map(),
      mahjongPresentationEvents: [],
      mahjongAttackSequence: 0
    }
    setHasActiveDamageNumbers(false)
    setUiState(createInitialUiState(mahjong))
  }, [calculatePath])
  
  return {
    uiState,
    gameStateRef,
    selectRoundTile,
    previewTowerPlacement,
    clearPlacementPreview,
    placeTower,
    finalizeTowers,
    revealMahjongHandSuits,
    keepMahjongHand,
    gambleForMahjongHonor,
    synthesizeMahjong,
    attachMahjongHonor,
    removeMahjongWall,
    startWave,
    pause,
    resume,
    resetGame
  }
}
