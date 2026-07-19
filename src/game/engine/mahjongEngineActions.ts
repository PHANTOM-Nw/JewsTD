import {
  MAHJONG_ATTACHMENT_CAPACITY,
  MAHJONG_SUIT_COMBAT_CONFIG
} from '../config/mahjong'
import { ECONOMY_CONFIG } from '../config/economy'
import type {
  GameStatus,
  GridCell,
  MahjongAttachment,
  MahjongHonor,
  MahjongNumberTile,
  ScoredMahjongFormation,
  Tower
} from '../types/game'
import { calculateMahjongFormationStats } from './mahjongStats'
import { canFinalizeTowerBatch } from './gameFlow'
import {
  getWhiteCount,
  planMahjongSynthesis,
  type MahjongGridPosition,
  type MahjongSynthesisFailure,
  type MahjongSynthesisMaterial,
  type MahjongSynthesisRecipe
} from './mahjongSynthesis'
import {
  planMahjongWallRemoval,
  type MahjongWallRemovalFailure
} from './mahjongWalls'

export interface MahjongEngineActionState {
  towers: Tower[]
  storedTowerIds: string[]
  grid: GridCell[][]
  obstacleOrder: MahjongGridPosition[]
  functionTiles: MahjongHonor[]
  gold: number
  pool: MahjongNumberTile[]
}

export interface SynthesizeMahjongRequest {
  anchorTowerId: string
  materialTowerIds?: string[]
  wallPositions?: MahjongGridPosition[]
  recipe: MahjongSynthesisRecipe
  whiteCount?: number
}

export type SynthesizeMahjongActionResult =
  | {
      ok: true
      towerId: string
      formation: ScoredMahjongFormation
      state: MahjongEngineActionState
    }
  | { ok: false; reason: MahjongSynthesisFailure; state: MahjongEngineActionState }

export type AttachMahjongHonorFailure =
  | 'invalid_phase'
  | 'tower_not_found'
  | 'honor_unavailable'
  | 'already_attached'
  | 'attachment_capacity'

export type AttachMahjongHonorActionResult =
  | { ok: true; state: MahjongEngineActionState }
  | { ok: false; reason: AttachMahjongHonorFailure; state: MahjongEngineActionState }

export type RemoveMahjongWallActionResult =
  | { ok: true; returnedTileId: string | null; state: MahjongEngineActionState }
  | { ok: false; reason: MahjongWallRemovalFailure; state: MahjongEngineActionState }

export type FinalizeMahjongBatchFailure =
  | 'invalid_batch'
  | 'invalid_entity_state'

export type FinalizeMahjongBatchActionResult =
  | { ok: true; keptTowerId: string; state: MahjongEngineActionState }
  | { ok: false; reason: FinalizeMahjongBatchFailure; state: MahjongEngineActionState }

function positionKey(position: MahjongGridPosition): string {
  return `${position.row},${position.col}`
}

function cloneGrid(grid: GridCell[][]): GridCell[][] {
  return grid.map(row => row.map(cell => ({ ...cell })))
}

function gridContainsTower(grid: GridCell[][], tower: Tower): boolean {
  const cell = grid[tower.gridPosition.row]?.[tower.gridPosition.col]
  return cell?.type === 'tower' && cell.towerId === tower.id
}

function addObstaclePositions(
  obstacleOrder: readonly MahjongGridPosition[],
  positions: readonly MahjongGridPosition[]
): MahjongGridPosition[] {
  const seen = new Set<string>()
  return [...obstacleOrder, ...positions].filter(position => {
    const key = positionKey(position)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).map(position => ({ ...position }))
}

function isValidTemporarySingle(state: MahjongEngineActionState, tower: Tower): boolean {
  const mahjong = tower.mahjongState
  const tile = tower.mahjongTile
  const matchingTowerCount = state.towers.filter(candidate => candidate.id === tower.id).length
  return matchingTowerCount === 1
    && !state.storedTowerIds.includes(tower.id)
    && gridContainsTower(state.grid, tower)
    && Boolean(tile)
    && mahjong?.formation === 'single'
    && mahjong.suit === tile?.suit
    && mahjong.ranks.length === 1
    && mahjong.ranks[0] === tile?.rank
    && mahjong.containedTileIds.length === 1
    && mahjong.containedTileIds[0] === tile?.id
    && mahjong.activeSources.length === 1
    && mahjong.activeSources[0].tileId === tile?.id
    && getWhiteCount(mahjong) === 0
}

/** Atomically keeps one placed single and converts the other batch tiles to walls. */
export function applyFinalizeMahjongBatchAction(
  state: MahjongEngineActionState,
  currentBatchTowerIds: readonly string[],
  keepTowerId: string
): FinalizeMahjongBatchActionResult {
  const batchIds = [...currentBatchTowerIds]
  if (
    !canFinalizeTowerBatch(batchIds, keepTowerId, ECONOMY_CONFIG.towersPerRound)
    || new Set(batchIds).size !== batchIds.length
  ) {
    return { ok: false, reason: 'invalid_batch', state }
  }

  const batchTowers = batchIds.map(towerId => (
    state.towers.find(tower => tower.id === towerId)
  ))
  if (
    batchTowers.some((tower): tower is undefined => !tower)
    || batchTowers.some(tower => !isValidTemporarySingle(state, tower!))
    || new Set(batchTowers.map(tower => tower!.mahjongTile!.id)).size !== batchTowers.length
  ) {
    return { ok: false, reason: 'invalid_entity_state', state }
  }

  const resolvedTowers = batchTowers as Tower[]
  const removedTowerIds = new Set(batchIds.filter(towerId => towerId !== keepTowerId))
  const nextGrid = cloneGrid(state.grid)
  const wallPositions: MahjongGridPosition[] = []
  resolvedTowers.forEach(tower => {
    if (tower.id === keepTowerId) return
    const { row, col } = tower.gridPosition
    nextGrid[row][col] = {
      row,
      col,
      type: 'obstacle',
      mahjongTile: tower.mahjongTile,
      mahjongWallKind: 'tile'
    }
    wallPositions.push({ row, col })
  })

  return {
    ok: true,
    keptTowerId: keepTowerId,
    state: {
      ...state,
      towers: state.towers.filter(tower => !removedTowerIds.has(tower.id)),
      storedTowerIds: [...state.storedTowerIds, keepTowerId],
      grid: nextGrid,
      obstacleOrder: addObstaclePositions(state.obstacleOrder, wallPositions),
      functionTiles: [...state.functionTiles],
      pool: [...state.pool]
    }
  }
}

export function applySynthesizeMahjongAction(
  state: MahjongEngineActionState,
  gameStatus: GameStatus,
  request: SynthesizeMahjongRequest
): SynthesizeMahjongActionResult {
  const activeTowerIds = new Set(state.storedTowerIds)
  const anchor = state.towers.find(tower => (
    tower.id === request.anchorTowerId && activeTowerIds.has(tower.id)
  ))
  if (!anchor || !gridContainsTower(state.grid, anchor)) {
    return { ok: false, reason: 'invalid_anchor', state }
  }

  const materials: MahjongSynthesisMaterial[] = []
  for (const towerId of request.materialTowerIds ?? []) {
    const tower = state.towers.find(candidate => (
      candidate.id === towerId && activeTowerIds.has(candidate.id)
    ))
    if (!tower || !gridContainsTower(state.grid, tower)) {
      return { ok: false, reason: 'invalid_entity_state', state }
    }
    materials.push({ kind: 'tower', tower })
  }
  for (const position of request.wallPositions ?? []) {
    const wall = state.grid[position.row]?.[position.col]
    if (!wall) return { ok: false, reason: 'invalid_wall', state }
    materials.push({ kind: 'wall', wall })
  }

  const whiteCount = request.whiteCount ?? 0
  const result = planMahjongSynthesis({
    gameStatus,
    anchor,
    materials,
    recipe: request.recipe,
    whiteCount,
    availableWhiteCount: state.functionTiles.filter(tile => tile === 'white').length
  })
  if (!result.ok) return { ...result, state }

  const plan = result.plan
  const stats = calculateMahjongFormationStats(
    plan.resultState.activeSources,
    plan.resultState.formation,
    plan.resultState.suit
  )
  const consumedTowerIds = new Set(plan.consumedTowerIds)
  const nextTowers = state.towers
    .filter(tower => !consumedTowerIds.has(tower.id))
    .map(tower => tower.id === plan.anchorTowerId
      ? {
          ...tower,
          mahjongState: plan.resultState,
          damage: stats.damage,
          range: stats.attackRange,
          attackSpeed: stats.attackIntervalMs,
          damageType: MAHJONG_SUIT_COMBAT_CONFIG[plan.resultState.suit].damageType
        }
      : tower)
  const nextGrid = cloneGrid(state.grid)
  plan.pureWallPositions.forEach(position => {
    const cell = nextGrid[position.row]?.[position.col]
    if (!cell) return
    nextGrid[position.row][position.col] = {
      row: cell.row,
      col: cell.col,
      type: 'obstacle',
      mahjongWallKind: 'pure'
    }
  })
  const nextFunctionTiles = [...state.functionTiles]
  for (let consumed = 0; consumed < plan.consumedWhiteCount; consumed += 1) {
    const whiteIndex = nextFunctionTiles.indexOf('white')
    if (whiteIndex === -1) break
    nextFunctionTiles.splice(whiteIndex, 1)
  }
  const nextState: MahjongEngineActionState = {
    ...state,
    towers: nextTowers,
    storedTowerIds: state.storedTowerIds.filter(id => !consumedTowerIds.has(id)),
    grid: nextGrid,
    obstacleOrder: addObstaclePositions(state.obstacleOrder, plan.pureWallPositions),
    functionTiles: nextFunctionTiles,
    pool: [...state.pool]
  }

  return {
    ok: true,
    towerId: plan.anchorTowerId,
    formation: plan.resultState.formation,
    state: nextState
  }
}

export function applyAttachMahjongHonorAction(
  state: MahjongEngineActionState,
  gameStatus: GameStatus,
  towerId: string,
  attachment: MahjongAttachment
): AttachMahjongHonorActionResult {
  if (gameStatus !== 'building' && gameStatus !== 'ready') {
    return { ok: false, reason: 'invalid_phase', state }
  }
  const towerIndex = state.towers.findIndex(tower => (
    tower.id === towerId && state.storedTowerIds.includes(tower.id)
  ))
  const tower = state.towers[towerIndex]
  if (!tower?.mahjongState || !gridContainsTower(state.grid, tower)) {
    return { ok: false, reason: 'tower_not_found', state }
  }
  const honorIndex = state.functionTiles.indexOf(attachment)
  if (honorIndex === -1) {
    return { ok: false, reason: 'honor_unavailable', state }
  }
  if (tower.mahjongState.attachments.includes(attachment)) {
    return { ok: false, reason: 'already_attached', state }
  }
  if (
    tower.mahjongState.attachments.length
    >= MAHJONG_ATTACHMENT_CAPACITY[tower.mahjongState.formation]
  ) {
    return { ok: false, reason: 'attachment_capacity', state }
  }

  const nextFunctionTiles = [...state.functionTiles]
  nextFunctionTiles.splice(honorIndex, 1)
  const nextTowers = [...state.towers]
  nextTowers[towerIndex] = {
    ...tower,
    mahjongState: {
      ...tower.mahjongState,
      attachments: [...tower.mahjongState.attachments, attachment]
    }
  }
  return {
    ok: true,
    state: {
      ...state,
      towers: nextTowers,
      storedTowerIds: [...state.storedTowerIds],
      grid: cloneGrid(state.grid),
      obstacleOrder: state.obstacleOrder.map(position => ({ ...position })),
      functionTiles: nextFunctionTiles,
      pool: [...state.pool]
    }
  }
}

export function applyRemoveMahjongWallAction(
  state: MahjongEngineActionState,
  gameStatus: GameStatus,
  position: MahjongGridPosition
): RemoveMahjongWallActionResult {
  const wall = state.grid[position.row]?.[position.col]
  if (!wall) return { ok: false, reason: 'invalid_wall', state }

  const result = planMahjongWallRemoval({
    gameStatus,
    wall,
    gold: state.gold,
    pool: state.pool
  })
  if (!result.ok) return { ...result, state }

  const nextGrid = cloneGrid(state.grid)
  nextGrid[position.row][position.col] = result.plan.clearedCell
  return {
    ok: true,
    returnedTileId: result.plan.returnedTile?.id ?? null,
    state: {
      ...state,
      towers: [...state.towers],
      storedTowerIds: [...state.storedTowerIds],
      grid: nextGrid,
      obstacleOrder: state.obstacleOrder
        .filter(candidate => positionKey(candidate) !== positionKey(position))
        .map(candidate => ({ ...candidate })),
      functionTiles: [...state.functionTiles],
      gold: result.plan.nextGold,
      pool: result.plan.nextPool
    }
  }
}
