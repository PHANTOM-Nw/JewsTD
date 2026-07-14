import { describe, expect, it } from 'vitest'
import { gridToPixel, MAP_CONFIG } from '../config/map'
import { screenPointToGrid } from './canvasPointer'

const logicalWidth = MAP_CONFIG.cols * MAP_CONFIG.cellSize
const logicalHeight = MAP_CONFIG.rows * MAP_CONFIG.cellSize

describe('screenPointToGrid', () => {
  it('maps an unscaled canvas point to its grid cell', () => {
    expect(screenPointToGrid(
      100,
      60,
      { left: 0, top: 0, width: logicalWidth, height: logicalHeight },
      logicalWidth,
      logicalHeight
    )).toEqual({ row: 1, col: 2 })
  })

  it('restores logical coordinates after responsive canvas scaling', () => {
    const position = { row: 9, col: 7 }
    const pixel = gridToPixel(position.row, position.col)
    const scale = 0.5
    const rect = {
      left: 10,
      top: 20,
      width: logicalWidth * scale,
      height: logicalHeight * scale
    }

    expect(screenPointToGrid(
      rect.left + pixel.x * scale,
      rect.top + pixel.y * scale,
      rect,
      logicalWidth,
      logicalHeight
    )).toEqual(position)
  })

  it('ignores points while the canvas has no display size', () => {
    expect(screenPointToGrid(
      0,
      0,
      { left: 0, top: 0, width: 0, height: 0 },
      logicalWidth,
      logicalHeight
    )).toBeNull()
  })
})
