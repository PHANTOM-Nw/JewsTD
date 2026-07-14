import { pixelToGrid } from '../config/map'

interface CanvasDisplayRect {
  left: number
  top: number
  width: number
  height: number
}

export function screenPointToGrid(
  clientX: number,
  clientY: number,
  rect: CanvasDisplayRect,
  logicalWidth: number,
  logicalHeight: number
): { row: number; col: number } | null {
  if (rect.width <= 0 || rect.height <= 0) {
    return null
  }

  const logicalX = (clientX - rect.left) * (logicalWidth / rect.width)
  const logicalY = (clientY - rect.top) * (logicalHeight / rect.height)

  return pixelToGrid(logicalX, logicalY)
}
