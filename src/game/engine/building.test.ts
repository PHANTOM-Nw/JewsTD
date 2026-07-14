import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ECONOMY_CONFIG } from '../config/economy'
import { initializeGrid, MAP_CONFIG } from '../config/map'
import { findPath } from '../pathfinding/pathfinding'
import type { GridCell } from '../types/game'
import {
  evaluateBatchPlacement,
  listSafeBuildCells,
  recycleOldestObstacles,
  type GridPosition
} from './building'

function positionKey(position: GridPosition): string {
  return `${position.row},${position.col}`
}

function placeBatch(
  grid: GridCell[][],
  batchSize: number
): { grid: GridCell[][]; positions: GridPosition[] } {
  const nextGrid = grid.map(row => row.map(cell => ({ ...cell })))
  const positions: GridPosition[] = []

  for (let placementIndex = 0; placementIndex < batchSize; placementIndex++) {
    const remainingPlacements = batchSize - placementIndex - 1
    const path = findPath(nextGrid, MAP_CONFIG.startPos, MAP_CONFIG.endPos)
    const candidates = listSafeBuildCells(nextGrid, path)
    const position = candidates.find(candidate => (
      evaluateBatchPlacement(nextGrid, candidate, remainingPlacements).canPlace
    ))

    expect(position).toBeDefined()
    nextGrid[position!.row][position!.col] = {
      ...nextGrid[position!.row][position!.col],
      type: 'tower'
    }
    positions.push(position!)
  }

  return { grid: nextGrid, positions }
}

describe('building capacity rules', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('evaluates a batch placement without modifying the input grid', () => {
    const grid = initializeGrid()
    const originalGrid = structuredClone(grid)
    const result = evaluateBatchPlacement(
      grid,
      { row: 0, col: 0 },
      ECONOMY_CONFIG.towersPerRound - 1
    )

    expect(result.canPlace).toBe(true)
    expect(result.safeBuildCells.length).toBeGreaterThanOrEqual(
      ECONOMY_CONFIG.towersPerRound - 1
    )
    expect(grid).toEqual(originalGrid)
  })

  it('rejects a placement that keeps a route but strands the rest of the batch', () => {
    const grid = initializeGrid()
    const path = findPath(grid, MAP_CONFIG.startPos, MAP_CONFIG.endPos)!
    const safeCells = listSafeBuildCells(grid, path)
    const candidate = safeCells[0]

    for (const position of safeCells.slice(1)) {
      grid[position.row][position.col].type = 'obstacle'
    }

    const result = evaluateBatchPlacement(grid, candidate, 1)

    expect(result.path).not.toBeNull()
    expect(result.canPlace).toBe(false)
    expect(result.failure).toBe('insufficient_capacity')
  })

  it('recycles oldest obstacles without modifying its inputs', () => {
    const grid = initializeGrid()
    const path = findPath(grid, MAP_CONFIG.startPos, MAP_CONFIG.endPos)!
    const obstacleOrder = listSafeBuildCells(grid, path).slice(0, 26)
    for (const position of obstacleOrder) {
      grid[position.row][position.col].type = 'obstacle'
    }
    const originalGrid = structuredClone(grid)
    const originalOrder = structuredClone(obstacleOrder)

    const result = recycleOldestObstacles(
      grid,
      obstacleOrder,
      ECONOMY_CONFIG.maxObstacles,
      0
    )

    expect(result.hasCapacity).toBe(true)
    expect(result.removedPositions).toEqual(obstacleOrder.slice(0, 2))
    expect(result.obstacleOrder).toEqual(obstacleOrder.slice(2))
    expect(grid).toEqual(originalGrid)
    expect(obstacleOrder).toEqual(originalOrder)
  })

  it('drops stale manual-removal entries and tracks unqueued synthesis obstacles', () => {
    const grid = initializeGrid()
    const path = findPath(grid, MAP_CONFIG.startPos, MAP_CONFIG.endPos)!
    const [manuallyRemoved, trackedObstacle, synthesisObstacle] = listSafeBuildCells(grid, path)
    grid[trackedObstacle.row][trackedObstacle.col].type = 'obstacle'
    grid[synthesisObstacle.row][synthesisObstacle.col].type = 'obstacle'

    const result = recycleOldestObstacles(
      grid,
      [manuallyRemoved, trackedObstacle, trackedObstacle],
      ECONOMY_CONFIG.maxObstacles,
      0
    )

    expect(result.obstacleOrder).toEqual([trackedObstacle, synthesisObstacle])
    expect(result.removedPositions).toEqual([])
  })

  it('ages additional obstacles when the next batch lacks safe cells', () => {
    const grid = initializeGrid()
    const path = findPath(grid, MAP_CONFIG.startPos, MAP_CONFIG.endPos)!
    const obstacleOrder = listSafeBuildCells(grid, path)
    for (const position of obstacleOrder) {
      grid[position.row][position.col].type = 'obstacle'
    }

    const result = recycleOldestObstacles(
      grid,
      obstacleOrder,
      80,
      ECONOMY_CONFIG.towersPerRound
    )

    expect(result.hasCapacity).toBe(true)
    expect(result.removedPositions).toHaveLength(ECONOMY_CONFIG.towersPerRound)
    expect(listSafeBuildCells(result.grid, result.path)).toHaveLength(
      ECONOMY_CONFIG.towersPerRound
    )
  })

  it('keeps all twelve three-tower rounds buildable without early obstacle aging', () => {
    let grid = initializeGrid()
    let obstacleOrder: GridPosition[] = []
    const obstaclesPerRound = ECONOMY_CONFIG.towersPerRound - 1

    for (let round = 1; round <= 12; round++) {
      const prepared = recycleOldestObstacles(
        grid,
        obstacleOrder,
        ECONOMY_CONFIG.maxObstacles,
        ECONOMY_CONFIG.towersPerRound
      )
      expect(prepared.hasCapacity, `round ${round} preparation`).toBe(true)
      expect(prepared.removedPositions, `round ${round} preparation aging`).toEqual([])
      grid = prepared.grid
      obstacleOrder = prepared.obstacleOrder

      const batch = placeBatch(grid, ECONOMY_CONFIG.towersPerRound)
      grid = batch.grid

      batch.positions.slice(1).forEach(position => {
        grid[position.row][position.col] = {
          ...grid[position.row][position.col],
          type: 'obstacle',
          towerId: undefined
        }
        obstacleOrder.push(position)
      })

      const aged = recycleOldestObstacles(
        grid,
        obstacleOrder,
        ECONOMY_CONFIG.maxObstacles,
        0
      )
      grid = aged.grid
      obstacleOrder = aged.obstacleOrder

      expect(aged.hasCapacity, `round ${round} finalization`).toBe(true)
      expect(aged.removedPositions, `round ${round} finalization aging`).toEqual([])
      expect(obstacleOrder).toHaveLength(round * obstaclesPerRound)
      expect(findPath(grid, MAP_CONFIG.startPos, MAP_CONFIG.endPos)).not.toBeNull()
      expect(new Set(obstacleOrder.map(positionKey)).size).toBe(obstacleOrder.length)
    }

    const towerCount = grid.flat().filter(cell => cell.type === 'tower').length
    expect(towerCount).toBe(12)
    expect(obstacleOrder).toHaveLength(ECONOMY_CONFIG.maxObstacles)
  })
})
