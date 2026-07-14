import { MAP_CONFIG } from '../config/map'
import { findPath } from '../pathfinding/pathfinding'
import type { GridCell, PlacementPreview } from '../types/game'

export interface GridPosition {
  row: number
  col: number
}

export type BatchPlacementFailure =
  | 'invalid_cell'
  | 'path_blocked'
  | 'insufficient_capacity'

export interface BatchPlacementResult {
  canPlace: boolean
  failure?: BatchPlacementFailure
  path: GridPosition[] | null
  safeBuildCells: GridPosition[]
}

export interface ObstacleRecycleResult {
  grid: GridCell[][]
  obstacleOrder: GridPosition[]
  path: GridPosition[] | null
  removedPositions: GridPosition[]
  hasCapacity: boolean
}

function positionKey(position: GridPosition): string {
  return `${position.row},${position.col}`
}

function cloneGrid(grid: GridCell[][]): GridCell[][] {
  return grid.map(row => row.map(cell => ({ ...cell })))
}

function calculateConfiguredPath(grid: GridCell[][]): GridPosition[] | null {
  return findPath(grid, MAP_CONFIG.startPos, MAP_CONFIG.endPos)
}

export function getRemainingBatchPlacements(
  batchSize: number,
  placedCount: number
): number {
  return Math.max(0, batchSize - placedCount - 1)
}

/**
 * 返回不在当前敌人路径上的空格。把这些格全部阻塞也会保留当前路径，
 * 因而它们可以作为本轮剩余建造次数的保守容量保证。
 */
export function listSafeBuildCells(
  grid: GridCell[][],
  path: GridPosition[] | null
): GridPosition[] {
  if (!path) return []

  const pathPositions = new Set(path.map(positionKey))
  const safeCells: GridPosition[] = []

  grid.forEach(row => {
    row.forEach(cell => {
      if (cell.type === 'empty' && !pathPositions.has(positionKey(cell))) {
        safeCells.push({ row: cell.row, col: cell.col })
      }
    })
  })

  return safeCells
}

/**
 * 在副本中评估一次落塔，并确保落塔后仍有足够的安全空格完成本轮批次。
 * 传入的网格不会被修改。
 */
export function evaluateBatchPlacement(
  grid: GridCell[][],
  position: GridPosition,
  remainingPlacements: number
): BatchPlacementResult {
  const cell = grid[position.row]?.[position.col]
  if (!cell || cell.type !== 'empty') {
    return {
      canPlace: false,
      failure: 'invalid_cell',
      path: null,
      safeBuildCells: []
    }
  }

  const nextGrid = cloneGrid(grid)
  nextGrid[position.row][position.col] = {
    ...nextGrid[position.row][position.col],
    type: 'tower'
  }

  const path = calculateConfiguredPath(nextGrid)
  if (!path) {
    return {
      canPlace: false,
      failure: 'path_blocked',
      path: null,
      safeBuildCells: []
    }
  }

  const safeBuildCells = listSafeBuildCells(nextGrid, path)
  if (safeBuildCells.length < Math.max(0, remainingPlacements)) {
    return {
      canPlace: false,
      failure: 'insufficient_capacity',
      path,
      safeBuildCells
    }
  }

  return {
    canPlace: true,
    path,
    safeBuildCells
  }
}

/**
 * 将放置评估转换为 Canvas 可渲染的瞬时预览，不修改输入网格。
 * 非空格不属于落塔预览范围，直接返回 null。
 */
export function createBatchPlacementPreview(
  grid: GridCell[][],
  position: GridPosition,
  remainingPlacements: number
): PlacementPreview | null {
  const result = evaluateBatchPlacement(grid, position, remainingPlacements)
  if (result.failure === 'invalid_cell') return null

  const status = result.canPlace
    ? 'valid'
    : result.failure === 'insufficient_capacity'
      ? 'insufficient_capacity'
      : 'path_blocked'

  return {
    position: { ...position },
    path: result.path,
    status
  }
}

function normalizeObstacleOrder(
  grid: GridCell[][],
  obstacleOrder: GridPosition[]
): GridPosition[] {
  const normalized: GridPosition[] = []
  const seen = new Set<string>()

  const addObstacle = (position: GridPosition) => {
    const key = positionKey(position)
    if (seen.has(key) || grid[position.row]?.[position.col]?.type !== 'obstacle') {
      return
    }

    seen.add(key)
    normalized.push({ row: position.row, col: position.col })
  }

  obstacleOrder.forEach(addObstacle)
  grid.forEach(row => row.forEach(cell => {
    if (cell.type === 'obstacle') addObstacle(cell)
  }))

  return normalized
}

/**
 * 按创建顺序移除最老的障碍，直到满足障碍上限且为下一批建造保留足够安全位。
 * 该函数返回新的网格与队列，不修改输入。
 */
export function recycleOldestObstacles(
  grid: GridCell[][],
  obstacleOrder: GridPosition[],
  maxObstacles: number,
  requiredSafeBuildCells: number
): ObstacleRecycleResult {
  const nextGrid = cloneGrid(grid)
  const nextOrder = normalizeObstacleOrder(nextGrid, obstacleOrder)
  const removedPositions: GridPosition[] = []
  const obstacleLimit = Math.max(0, Math.floor(maxObstacles))
  const requiredCapacity = Math.max(0, Math.floor(requiredSafeBuildCells))

  let path = calculateConfiguredPath(nextGrid)
  let safeBuildCellCount = listSafeBuildCells(nextGrid, path).length

  while (
    nextOrder.length > 0
    && (
      nextOrder.length > obstacleLimit
      || !path
      || safeBuildCellCount < requiredCapacity
    )
  ) {
    const oldestObstacle = nextOrder.shift()!
    const cell = nextGrid[oldestObstacle.row]?.[oldestObstacle.col]
    if (!cell || cell.type !== 'obstacle') continue

    nextGrid[oldestObstacle.row][oldestObstacle.col] = {
      ...cell,
      type: 'empty',
      towerId: undefined
    }
    removedPositions.push(oldestObstacle)
    path = calculateConfiguredPath(nextGrid)
    safeBuildCellCount = listSafeBuildCells(nextGrid, path).length
  }

  return {
    grid: nextGrid,
    obstacleOrder: nextOrder,
    path,
    removedPositions,
    hasCapacity: Boolean(path)
      && nextOrder.length <= obstacleLimit
      && safeBuildCellCount >= requiredCapacity
  }
}
