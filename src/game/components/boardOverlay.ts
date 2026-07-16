import { MAP_CONFIG } from '../config/map'

/**
 * 画布逻辑尺寸由 MAP_CONFIG 派生（cols/rows × cellSize，即 320×400），
 * 与 canvasRenderer 绘制塔所用的 grid→pixel 换算共用同一套常量。
 */
const BOARD_WIDTH = MAP_CONFIG.cols * MAP_CONFIG.cellSize
const BOARD_HEIGHT = MAP_CONFIG.rows * MAP_CONFIG.cellSize

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
    left: `${((cellPixelX / BOARD_WIDTH) * 100).toFixed(4)}%`,
    top: `${((cellPixelY / BOARD_HEIGHT) * 100).toFixed(4)}%`,
    width: `${((cellSize / BOARD_WIDTH) * 100).toFixed(4)}%`,
    height: `${((cellSize / BOARD_HEIGHT) * 100).toFixed(4)}%`
  }
}
