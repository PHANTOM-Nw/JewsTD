import { MAP_CONFIG } from '../config/map'

/**
 * 画布逻辑尺寸由 MAP_CONFIG 派生（cols/rows × cellSize，即 320×400），
 * 与 canvasRenderer 绘制塔所用的 grid→pixel 换算共用同一套常量。
 */
const BOARD_WIDTH = MAP_CONFIG.cols * MAP_CONFIG.cellSize
const BOARD_HEIGHT = MAP_CONFIG.rows * MAP_CONFIG.cellSize

interface BoardOverlayRectangleStyle {
  left: string
  top: string
  width: string
  height: string
}

function toPercentage(value: number, total: number): string {
  return `${((value / total) * 100).toFixed(4)}%`
}

/**
 * 返回以 .game-board（canvas 的定位祖先）为参照的百分比定位样式，
 * 供绝对定位叠加层正好套住某个网格格子。格子左上角像素 =
 * col/row × cellSize，除以画布逻辑宽高换算为百分比，因此高亮环与
 * canvasRenderer 画塔的格子位置一致。
 */
export function getBoardCellOverlayStyle(position: { row: number; col: number }): {
  left: string
  top: string
  width: string
  height: string
} {
  const { cellSize } = MAP_CONFIG
  const cellPixelX = position.col * cellSize
  const cellPixelY = position.row * cellSize
  return {
    left: toPercentage(cellPixelX, BOARD_WIDTH),
    top: toPercentage(cellPixelY, BOARD_HEIGHT),
    width: toPercentage(cellSize, BOARD_WIDTH),
    height: toPercentage(cellSize, BOARD_HEIGHT)
  }
}

/**
 * 将战斗使用的逻辑像素圆转换成地图覆盖层中的百分比矩形。
 * 横纵方向分别按 320×400 逻辑尺寸换算；由于画布始终等比缩放，
 * 最终 CSS 矩形的宽高像素相等，可以用 border-radius: 50% 画出真实射程圈。
 * 边缘塔允许得到负 left/top，由地图覆盖容器负责裁剪。
 */
export function getBoardRangeOverlayStyle(
  center: { x: number; y: number },
  range: number
): BoardOverlayRectangleStyle {
  const radius = Number.isFinite(range) ? Math.max(0, range) : 0
  return {
    left: toPercentage(center.x - radius, BOARD_WIDTH),
    top: toPercentage(center.y - radius, BOARD_HEIGHT),
    width: toPercentage(radius * 2, BOARD_WIDTH),
    height: toPercentage(radius * 2, BOARD_HEIGHT)
  }
}
