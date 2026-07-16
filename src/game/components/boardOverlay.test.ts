import { describe, expect, it } from 'vitest'
import { MAP_CONFIG } from '../config/map'
import { getBoardCellOverlayStyle } from './boardOverlay'

const boardWidth = MAP_CONFIG.cols * MAP_CONFIG.cellSize
const boardHeight = MAP_CONFIG.rows * MAP_CONFIG.cellSize

function expectedStyle(row: number, col: number) {
  const { cellSize } = MAP_CONFIG
  return {
    left: `${(((col * cellSize) / boardWidth) * 100).toFixed(4)}%`,
    top: `${(((row * cellSize) / boardHeight) * 100).toFixed(4)}%`,
    width: `${((cellSize / boardWidth) * 100).toFixed(4)}%`,
    height: `${((cellSize / boardHeight) * 100).toFixed(4)}%`
  }
}

describe('getBoardCellOverlayStyle', () => {
  it('maps the origin cell to the board top-left with one grid step of extent', () => {
    expect(getBoardCellOverlayStyle({ row: 0, col: 0 })).toEqual(expectedStyle(0, 0))
  })

  it('maps a non-zero cell with the same grid→pixel conversion as the canvas', () => {
    const cell = { row: 3, col: 5 }
    expect(getBoardCellOverlayStyle(cell)).toEqual(expectedStyle(cell.row, cell.col))
  })

  it('keeps a cell width/height equal to a single grid fraction of the board', () => {
    const style = getBoardCellOverlayStyle({ row: MAP_CONFIG.rows - 1, col: MAP_CONFIG.cols - 1 })
    expect(style.width).toBe(`${(100 / MAP_CONFIG.cols).toFixed(4)}%`)
    expect(style.height).toBe(`${(100 / MAP_CONFIG.rows).toFixed(4)}%`)
  })
})
