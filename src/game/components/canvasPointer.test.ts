import { describe, expect, it } from 'vitest'
import { screenPointToGrid } from './canvasPointer'

describe('screenPointToGrid', () => {
  it('maps an unscaled canvas point to its grid cell', () => {
    expect(screenPointToGrid(
      100,
      60,
      { left: 0, top: 0, width: 800, height: 600 },
      800,
      600
    )).toEqual({ row: 1, col: 2 })
  })

  it('restores logical coordinates after responsive canvas scaling', () => {
    expect(screenPointToGrid(
      390,
      300,
      { left: 10, top: 20, width: 400, height: 300 },
      800,
      600
    )).toEqual({ row: 14, col: 19 })
  })

  it('ignores points while the canvas has no display size', () => {
    expect(screenPointToGrid(
      0,
      0,
      { left: 0, top: 0, width: 0, height: 0 },
      800,
      600
    )).toBeNull()
  })
})
