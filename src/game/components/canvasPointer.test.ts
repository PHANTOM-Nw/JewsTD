import { describe, expect, it } from 'vitest'
import { gridToPixel, MAP_CONFIG } from '../config/map'
import {
  beginPlacementPointer,
  createPlacementPointerState,
  finishPlacementPointer,
  isPrimaryPlacementPointer,
  selectPlacementPreviewCell,
  screenPointToGrid
} from './canvasPointer'

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

  it.each([
    [-1, 20],
    [20, -1],
    [logicalWidth, 20],
    [20, logicalHeight]
  ])('ignores points outside the logical canvas at (%s, %s)', (x, y) => {
    expect(screenPointToGrid(
      x,
      y,
      { left: 0, top: 0, width: logicalWidth, height: logicalHeight },
      logicalWidth,
      logicalHeight
    )).toBeNull()
  })

  it('includes the top-left edge and excludes the bottom-right edge', () => {
    const rect = { left: 10, top: 20, width: 160, height: 200 }

    expect(screenPointToGrid(
      rect.left,
      rect.top,
      rect,
      logicalWidth,
      logicalHeight
    )).toEqual({ row: 0, col: 0 })
    expect(screenPointToGrid(
      rect.left + rect.width,
      rect.top + rect.height,
      rect,
      logicalWidth,
      logicalHeight
    )).toBeNull()
  })
})

describe('isPrimaryPlacementPointer', () => {
  it('accepts only the primary pointer with its main button', () => {
    expect(isPrimaryPlacementPointer(true, 0)).toBe(true)
    expect(isPrimaryPlacementPointer(false, 0)).toBe(false)
    expect(isPrimaryPlacementPointer(true, 1)).toBe(false)
    expect(isPrimaryPlacementPointer(true, 2)).toBe(false)
  })
})

describe('placement preview pointer state', () => {
  it('updates only when the active pointer crosses into another cell', () => {
    let state = beginPlacementPointer(7)
    const first = selectPlacementPreviewCell(state, 7, { row: 1, col: 2 })
    state = first.state
    const repeated = selectPlacementPreviewCell(state, 7, { row: 1, col: 2 })
    const moved = selectPlacementPreviewCell(state, 7, { row: 1, col: 3 })
    const unrelated = selectPlacementPreviewCell(state, 8, { row: 2, col: 3 })

    expect(first.changed).toBe(true)
    expect(repeated.changed).toBe(false)
    expect(moved.changed).toBe(true)
    expect(unrelated.changed).toBe(false)
  })

  it('commits exactly once after pointer up and never commits a canceled gesture', () => {
    const active = beginPlacementPointer(7)
    const completed = finishPlacementPointer(active, 7, false)
    const canceled = finishPlacementPointer(active, null, true)
    const repeatedFinish = finishPlacementPointer(completed.state, 7, false)

    expect(completed.ended).toBe(true)
    expect(completed.shouldCommit).toBe(true)
    expect(repeatedFinish.shouldCommit).toBe(false)
    expect(canceled.ended).toBe(true)
    expect(canceled.shouldCommit).toBe(false)
  })

  it('does not carry cancellation into the next pointer gesture', () => {
    const canceled = finishPlacementPointer(beginPlacementPointer(7), 7, true)
    const nextGesture = beginPlacementPointer(8)
    const completed = finishPlacementPointer(nextGesture, 8, false)

    expect(canceled.state).toEqual(createPlacementPointerState())
    expect(completed.shouldCommit).toBe(true)
  })

  it('ignores finish signals for an unrelated or idle pointer', () => {
    const active = beginPlacementPointer(7)
    const unrelated = finishPlacementPointer(active, 8, true)
    const idle = finishPlacementPointer(createPlacementPointerState(), null, true)

    expect(unrelated).toEqual({
      state: active,
      ended: false,
      shouldCommit: false
    })
    expect(idle.ended).toBe(false)
    expect(idle.shouldCommit).toBe(false)
  })
})
