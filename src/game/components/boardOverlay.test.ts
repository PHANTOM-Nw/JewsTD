import { describe, expect, it } from 'vitest'
import { MAP_CONFIG } from '../config/map'
import {
  getBoardCellOverlayStyle,
  getBoardRangeOverlayStyle
} from './boardOverlay'

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

describe('getBoardRangeOverlayStyle', () => {
  it('maps a logical center and radius to the board percentage rectangle', () => {
    expect(getBoardRangeOverlayStyle({ x: 100, y: 120 }, 40)).toEqual({
      left: '18.7500%',
      top: '20.0000%',
      width: '25.0000%',
      height: '20.0000%'
    })
  })

  it('keeps equal logical diameters on the 4:5 responsive board', () => {
    const style = getBoardRangeOverlayStyle({ x: 20, y: 20 }, 125)

    expect(style).toEqual({
      left: '-32.8125%',
      top: '-26.2500%',
      width: '78.1250%',
      height: '62.5000%'
    })
    expect(Number.parseFloat(style.width) / 100 * boardWidth).toBe(250)
    expect(Number.parseFloat(style.height) / 100 * boardHeight).toBe(250)
  })

  it('clamps an invalid or negative range to a zero-radius marker', () => {
    expect(getBoardRangeOverlayStyle({ x: 160, y: 200 }, -10)).toEqual({
      left: '50.0000%',
      top: '50.0000%',
      width: '0.0000%',
      height: '0.0000%'
    })
    expect(getBoardRangeOverlayStyle({ x: 160, y: 200 }, Number.NaN)).toEqual({
      left: '50.0000%',
      top: '50.0000%',
      width: '0.0000%',
      height: '0.0000%'
    })
  })
})
