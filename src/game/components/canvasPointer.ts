import { pixelToGrid } from '../config/map'

interface CanvasDisplayRect {
  left: number
  top: number
  width: number
  height: number
}

export interface PlacementPointerState {
  activePointerId: number | null
  lastCellKey: string | null
  suppressNextClick: boolean
}

export function createPlacementPointerState(): PlacementPointerState {
  return {
    activePointerId: null,
    lastCellKey: null,
    suppressNextClick: false
  }
}

export function beginPlacementPointer(
  pointerId: number
): PlacementPointerState {
  return {
    activePointerId: pointerId,
    lastCellKey: null,
    suppressNextClick: false
  }
}

export function selectPlacementPreviewCell(
  state: PlacementPointerState,
  pointerId: number,
  position: { row: number; col: number }
): { state: PlacementPointerState; changed: boolean } {
  if (state.activePointerId !== pointerId) {
    return { state, changed: false }
  }

  const cellKey = `${position.row},${position.col}`
  if (state.lastCellKey === cellKey) {
    return { state, changed: false }
  }

  return {
    state: { ...state, lastCellKey: cellKey },
    changed: true
  }
}

export function finishPlacementPointer(
  state: PlacementPointerState,
  pointerId: number | null,
  suppressNextClick: boolean
): { state: PlacementPointerState; ended: boolean } {
  if (
    state.activePointerId === null
    || (pointerId !== null && state.activePointerId !== pointerId)
  ) {
    return { state, ended: false }
  }

  return {
    state: {
      activePointerId: null,
      lastCellKey: null,
      suppressNextClick: state.suppressNextClick || suppressNextClick
    },
    ended: true
  }
}

export function consumePlacementClick(
  state: PlacementPointerState
): { state: PlacementPointerState; shouldCommit: boolean } {
  if (!state.suppressNextClick) {
    return { state, shouldCommit: true }
  }

  return {
    state: { ...state, suppressNextClick: false },
    shouldCommit: false
  }
}

export function screenPointToGrid(
  clientX: number,
  clientY: number,
  rect: CanvasDisplayRect,
  logicalWidth: number,
  logicalHeight: number
): { row: number; col: number } | null {
  if (
    rect.width <= 0
    || rect.height <= 0
    || logicalWidth <= 0
    || logicalHeight <= 0
    || clientX < rect.left
    || clientX >= rect.left + rect.width
    || clientY < rect.top
    || clientY >= rect.top + rect.height
  ) {
    return null
  }

  const logicalX = (clientX - rect.left) * (logicalWidth / rect.width)
  const logicalY = (clientY - rect.top) * (logicalHeight / rect.height)

  return pixelToGrid(logicalX, logicalY)
}

export function isPrimaryPlacementPointer(
  isPrimary: boolean,
  button: number
): boolean {
  return isPrimary && button === 0
}
