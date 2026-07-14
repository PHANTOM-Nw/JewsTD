import type { GridCell } from '../types/game'

/**
 * 敌人按顺序经过的路线锚点。起点与终点坐标只在这里声明，
 * MAP_CONFIG 从首尾锚点派生，避免两份坐标配置发生漂移。
 */
export const WAYPOINTS: ReadonlyArray<{
  row: number
  col: number
  label?: string
}> = [
  { row: 0, col: 0, label: '起点' },
  { row: 3, col: 1, label: '转折点1' },
  { row: 3, col: 6, label: '转折点2' },
  { row: 7, col: 6, label: '转折点3' },
  { row: 9, col: 7, label: '终点' }
] as const

const startWaypoint = WAYPOINTS[0]!
const endWaypoint = WAYPOINTS[WAYPOINTS.length - 1]!

export const MAP_CONFIG = {
  rows: 10,
  cols: 8,
  cellSize: 40, // 每个格子的像素大小
  startPos: { row: startWaypoint.row, col: startWaypoint.col },
  endPos: { row: endWaypoint.row, col: endWaypoint.col }
} as const

/**
 * 宝石TD必经点机制
 * 
 * 核心玩法:
 * 1. 敌人必须按顺序经过所有必经点(起点→转折点1→...→终点)
 * 2. 玩家通过放置塔/障碍物引导敌人走更长的路径
 * 3. BFS在相邻必经点之间独立计算最短路径
 * 
 * 10×8 竖向地图使用5个点形成S形基础路线:
 * 起点(0,0) → (3,1) → (3,6) → (7,6) → 终点(9,7)
 * 
 * 注意: 地图中央不设置特殊格,与其他空格一样可用于建造
 */

// 初始化空地图(无预定义障碍物)
export function initializeGrid(): GridCell[][] {
  const { rows, cols, startPos, endPos } = MAP_CONFIG
  const grid: GridCell[][] = []
  
  for (let row = 0; row < rows; row++) {
    grid[row] = []
    for (let col = 0; col < cols; col++) {
      if (row === startPos.row && col === startPos.col) {
        grid[row][col] = { row, col, type: 'start' }
      } else if (row === endPos.row && col === endPos.col) {
        grid[row][col] = { row, col, type: 'end' }
      } else {
        // 其他位置都是空的,玩家可以自由放置塔或障碍物
        grid[row][col] = { row, col, type: 'empty' }
      }
    }
  }
  
  console.log('✅ 地图初始化完成:', {
    起点: startPos,
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
