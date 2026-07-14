import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeGrid, MAP_CONFIG, WAYPOINTS } from '../config/map'
import {
  canPlaceTower,
  findPath,
  getMoveDirection,
  getPathLength,
  isPositionOnPath
} from './pathfinding'

describe('pathfinding', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('finds the shortest complete route through configured waypoints', () => {
    const path = findPath(
      initializeGrid(),
      MAP_CONFIG.startPos,
      MAP_CONFIG.endPos
    )

    expect(path).not.toBeNull()
    expect(path?.[0]).toEqual(MAP_CONFIG.startPos)
    expect(path?.at(-1)).toEqual(MAP_CONFIG.endPos)
    expect(getPathLength(path ?? [])).toBe(16)

    let previousIndex = -1
    for (const waypoint of WAYPOINTS) {
      const waypointIndex = path?.findIndex((position, index) => (
        index > previousIndex &&
        position.row === waypoint.row &&
        position.col === waypoint.col
      )) ?? -1

      expect(waypointIndex).toBeGreaterThan(previousIndex)
      previousIndex = waypointIndex
    }
  })

  it('returns null when a required waypoint is blocked', () => {
    const grid = initializeGrid()
    const blockedWaypoint = WAYPOINTS[2]
    grid[blockedWaypoint.row][blockedWaypoint.col].type = 'obstacle'

    expect(findPath(grid, MAP_CONFIG.startPos, MAP_CONFIG.endPos)).toBeNull()
  })

  it('rejects placement on a required waypoint and restores the grid', () => {
    const grid = initializeGrid()
    const originalGrid = structuredClone(grid)
    const waypoint = WAYPOINTS[1]

    expect(canPlaceTower(
      grid,
      waypoint,
      MAP_CONFIG.startPos,
      MAP_CONFIG.endPos
    )).toBe(false)
    expect(grid).toEqual(originalGrid)
  })

  it('accepts a placement that preserves the route and restores the grid', () => {
    const grid = initializeGrid()
    const position = { row: 9, col: 0 }
    const originalGrid = structuredClone(grid)

    expect(canPlaceTower(
      grid,
      position,
      MAP_CONFIG.startPos,
      MAP_CONFIG.endPos
    )).toBe(true)
    expect(grid).toEqual(originalGrid)
  })
})

describe('path helpers', () => {
  it.each([
    [{ row: 2, col: 2 }, { row: 1, col: 2 }, 'up'],
    [{ row: 2, col: 2 }, { row: 3, col: 2 }, 'down'],
    [{ row: 2, col: 2 }, { row: 2, col: 1 }, 'left'],
    [{ row: 2, col: 2 }, { row: 2, col: 3 }, 'right']
  ] as const)('gets the movement direction between adjacent cells', (from, to, expected) => {
    expect(getMoveDirection(from, to)).toBe(expected)
  })

  it('calculates path length in movement steps', () => {
    expect(getPathLength([])).toBe(0)
    expect(getPathLength([{ row: 0, col: 0 }])).toBe(0)
    expect(getPathLength([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 }
    ])).toBe(2)
  })

  it('checks whether a position belongs to a path', () => {
    const path = [
      { row: 0, col: 0 },
      { row: 0, col: 1 }
    ]

    expect(isPositionOnPath({ row: 0, col: 1 }, path)).toBe(true)
    expect(isPositionOnPath({ row: 1, col: 1 }, path)).toBe(false)
    expect(isPositionOnPath({ row: 0, col: 0 }, null)).toBe(false)
  })
})
