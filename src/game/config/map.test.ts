import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import {
  gridToPixel,
  initializeGrid,
  MAP_CONFIG,
  pixelToGrid,
  WAYPOINTS
} from './map'

describe('map configuration', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes the configured grid without a special center cell', () => {
    const grid = initializeGrid()
    const centerRow = Math.floor(MAP_CONFIG.rows / 2)
    const centerCol = Math.floor(MAP_CONFIG.cols / 2)

    expect(MAP_CONFIG.rows).toBe(10)
    expect(MAP_CONFIG.cols).toBe(8)
    expect(MAP_CONFIG.cellSize).toBe(40)
    expect(grid).toHaveLength(MAP_CONFIG.rows)
    expect(grid.every(row => row.length === MAP_CONFIG.cols)).toBe(true)
    expect(grid[MAP_CONFIG.startPos.row][MAP_CONFIG.startPos.col].type).toBe('start')
    expect(grid[centerRow][centerCol].type).toBe('empty')
    expect(grid[MAP_CONFIG.endPos.row][MAP_CONFIG.endPos.col].type).toBe('end')
  })

  it('keeps unique route waypoints in bounds and derives both endpoints', () => {
    const waypointKeys = WAYPOINTS.map(waypoint => `${waypoint.row},${waypoint.col}`)

    expect(new Set(waypointKeys).size).toBe(WAYPOINTS.length)
    expect(WAYPOINTS[0]).toMatchObject(MAP_CONFIG.startPos)
    expect(WAYPOINTS.at(-1)).toMatchObject(MAP_CONFIG.endPos)
    for (const waypoint of WAYPOINTS) {
      expect(waypoint.row).toBeGreaterThanOrEqual(0)
      expect(waypoint.row).toBeLessThan(MAP_CONFIG.rows)
      expect(waypoint.col).toBeGreaterThanOrEqual(0)
      expect(waypoint.col).toBeLessThan(MAP_CONFIG.cols)
    }
  })

  it('converts grid coordinates to cell-center pixels', () => {
    expect(gridToPixel(0, 0)).toEqual({ x: 20, y: 20 })
    expect(gridToPixel(2, 3)).toEqual({ x: 140, y: 100 })
  })

  it('converts pixels to their containing grid cell', () => {
    expect(pixelToGrid(0, 0)).toEqual({ row: 0, col: 0 })
    expect(pixelToGrid(39, 39)).toEqual({ row: 0, col: 0 })
    expect(pixelToGrid(40, 80)).toEqual({ row: 2, col: 1 })
  })

  it('round-trips cell centers through both conversions', () => {
    const position = { row: 8, col: 7 }
    const pixel = gridToPixel(position.row, position.col)

    expect(pixelToGrid(pixel.x, pixel.y)).toEqual(position)
  })
})
