import type { GridCell } from '../types/game'

export const MAP_CONFIG = {
  rows: 15,
  cols: 20,
  cellSize: 40, // 每个格子的像素大小
  startPos: { row: 0, col: 2 },      // 起点(顶部绿色区域)
  minePos: { row: 7, col: 10 },       // 矿坑(中心黄色区域)
  endPos: { row: 14, col: 19 }        // 终点(右下角红色区域)
}

/**
 * 宝石TD必经点机制
 * 
 * 核心玩法:
 * 1. 敌人必须按顺序经过所有必经点(起点→转折点1→...→终点)
 * 2. 玩家通过放置塔/障碍物引导敌人走更长的路径
 * 3. BFS在相邻必经点之间独立计算最短路径
 * 
 * 必经点坐标配置(7个点):
 * - 0: 起点(绿色,顶部) (0,2)
 * - 1: 转折点1(蓝色,左侧) (7,2)
 * - 2: 转折点2(蓝色,右侧) (7,18)
 * - 3: 转折点3(蓝色,右上) (2,18)
 * - 4: 转折点4(蓝色,左侧中部) (2,10)
 * - 5: 转折点5(蓝色,右下) (12,10)
 * - 6: 终点(红色,右下) (14,19)
 * 
 * 注意: 矿坑(7,10)不再是必经点,但仍在地图上显示(MAP_CONFIG.minePos)
 */
export const WAYPOINTS: Array<{ row: number; col: number; label?: string }> = [
  { row: 0, col: 2, label: '起点' },           // 0: 起点(顶部绿色区域)
  { row: 7, col: 2, label: '转折点1' },        // 1: 向下到第7行(蓝色)
  { row: 7, col: 18, label: '转折点2' },       // 2: 向右到第18列(蓝色)
  { row: 2, col: 18, label: '转折点3' },       // 3: 向上到第2行(蓝色)
  { row: 2, col: 10, label: '转折点4' },        // 4: 向左到左侧中部(蓝色)
  { row: 12, col: 10, label: '转折点5' },      // 5: 向下到右下(蓝色)
  { row: 14, col: 19, label: '终点' }          // 6: 终点(右下角红色区域)
]

// 初始化空地图(无预定义障碍物)
export function initializeGrid(): GridCell[][] {
  const { rows, cols, startPos, endPos, minePos } = MAP_CONFIG
  const grid: GridCell[][] = []
  
  for (let row = 0; row < rows; row++) {
    grid[row] = []
    for (let col = 0; col < cols; col++) {
      if (row === startPos.row && col === startPos.col) {
        grid[row][col] = { row, col, type: 'start' }
      } else if (row === endPos.row && col === endPos.col) {
        grid[row][col] = { row, col, type: 'end' }
      } else if (row === minePos.row && col === minePos.col) {
        // 矿坑位置(地图中央)
        grid[row][col] = { row, col, type: 'mine' }
      } else {
        // 其他位置都是空的,玩家可以自由放置塔或障碍物
        grid[row][col] = { row, col, type: 'empty' }
      }
    }
  }
  
  console.log('✅ 地图初始化完成:', {
    起点: startPos,
    矿坑: minePos,
    终点: endPos,
    必经点数量: WAYPOINTS.length,
    说明: '初始为空网格,玩家可自由设计路径'
  })
  
  // 输出每个必经点的详细坐标
  console.log('📍 必经点坐标详情:')
  WAYPOINTS.forEach((wp, index) => {
    console.log(`  [${index}] ${wp.label || '未命名'} at (row:${wp.row}, col:${wp.col})`)
  })
  
  // 输出路径流程
  console.log('🛤️ 路径流程:')
  const pathFlow = WAYPOINTS.map(wp => `${wp.label}(${wp.row},${wp.col})`).join(' → ')
  console.log(`  ${pathFlow}`)
  
  return grid
}

// 将格子坐标转换为像素坐标
export function gridToPixel(row: number, col: number): { x: number; y: number } {
  const { cellSize } = MAP_CONFIG
  return {
    x: col * cellSize + cellSize / 2,
    y: row * cellSize + cellSize / 2
  }
}

// 将像素坐标转换为格子坐标
export function pixelToGrid(x: number, y: number): { row: number; col: number } {
  const { cellSize } = MAP_CONFIG
  return {
    row: Math.floor(y / cellSize),
    col: Math.floor(x / cellSize)
  }
}
