import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import {
  gridToPixel,
  initializeGrid,
  MAP_CONFIG,
  pixelToGrid
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

    expect(grid).toHaveLength(MAP_CONFIG.rows)
    expect(grid.every(row => row.length === MAP_CONFIG.cols)).toBe(true)
    expect(grid[MAP_CONFIG.startPos.row][MAP_CONFIG.startPos.col].type).toBe('start')
    expect(grid[centerRow][centerCol].type).toBe('empty')
    expect(grid[MAP_CONFIG.endPos.row][MAP_CONFIG.endPos.col].type).toBe('end')
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
    const position = { row: 8, col: 13 }
    const pixel = gridToPixel(position.row, position.col)

    expect(pixelToGrid(pixel.x, pixel.y)).toEqual(position)
  })
})
