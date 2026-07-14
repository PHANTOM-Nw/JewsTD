import type { GridCell } from '../types/game'
import { WAYPOINTS } from '../config/map'

/**
 * 查找从起点经过所有必经点到终点的路径
 * 
 * 宝石TD核心玩法:
 * - 敌人必须按顺序经过所有必经点
 * - 每两个相邻必经点之间使用BFS计算最短路径
 * - 玩家放置的塔/障碍物会影响路径长度
 * 
 * @param grid - 地图网格
 * @returns 完整路径(经过所有必经点),如果无法到达返回null
 */
export function findPath(
  grid: GridCell[][],
  start: { row: number; col: number },
  end: { row: number; col: number }
): { row: number; col: number }[] | null {
  const rows = grid.length
  
  // 边界检查:确保grid非空
  if (rows === 0) {
    return null
  }

  const routePoints = [
    { ...start, label: WAYPOINTS[0]?.label ?? '起点' },
    ...WAYPOINTS.slice(1, -1),
    { ...end, label: WAYPOINTS.at(-1)?.label ?? '终点' }
  ]
  
  console.log('🗺️ 计算必经点路径:', { 
    必经点数量: routePoints.length,
    必经点列表: routePoints.map(wp => `(${wp.row},${wp.col})${wp.label ? '-' + wp.label : ''}`)
  })
  
  // 多段BFS:在相邻必经点之间计算最短路径
  const fullPath: { row: number; col: number }[] = []
  
  console.log(`🛤️ 开始计算${routePoints.length - 1}段路径`)
  
  for (let i = 0; i < routePoints.length - 1; i++) {
    const currentWaypoint = routePoints[i]
    const nextWaypoint = routePoints[i + 1]
    
    console.log(`\n🛤️ 第${i + 1}段: ${currentWaypoint.label || '必经点'}(${currentWaypoint.row},${currentWaypoint.col}) → ${nextWaypoint.label || '必经点'}(${nextWaypoint.row},${nextWaypoint.col})`)
    
    // BFS查找两点之间的最短路径
    const segmentPath = findPathSegment(grid, currentWaypoint, nextWaypoint)
    
    if (!segmentPath) {
      console.warn(`❌ 无法找到第${i + 1}段路径!`)
      console.log(`可能原因: 障碍物阻挡或路径被完全封锁`)
      return null
    }
    
    console.log(`✅ 找到第${i + 1}段路径,长度: ${segmentPath.length}`)
    
    // 合并路径(避免重复添加连接点)
    if (fullPath.length === 0) {
      fullPath.push(...segmentPath)
    } else {
      fullPath.push(...segmentPath.slice(1))  // 跳过第一个点(已在上段末尾)
    }
  }
  
  console.log(`\n✅ 完整路径总长度: ${fullPath.length}`)
  console.log('路径关键点:', [
    fullPath[0],           // 起点
    fullPath[Math.floor(fullPath.length / 4)],      // 1/4处
    fullPath[Math.floor(fullPath.length / 2)],      // 中点
    fullPath[Math.floor(fullPath.length * 3 / 4)],  // 3/4处
    fullPath[fullPath.length - 1]                   // 终点
  ])
  
  return fullPath
}

/**
 * BFS查找两点之间的最短路径
 * 
 * @param grid - 地图网格
 * @param start - 起点坐标
 * @param end - 终点坐标
 * @returns 路径点数组,如果无法到达则返回null
 */
function findPathSegment(
  grid: GridCell[][],
  start: { row: number; col: number },
  end: { row: number; col: number }
): { row: number; col: number }[] | null {
  const rows = grid.length
  const cols = grid[0].length
  
  // 边界检查
  if (
    start.row < 0 || start.row >= rows ||
    start.col < 0 || start.col >= cols ||
    end.row < 0 || end.row >= rows ||
    end.col < 0 || end.col >= cols
  ) {
    console.warn('起点或终点超出地图边界')
    return null
  }
  
  // 检查起点和终点本身是否可通行
  const startCell = grid[start.row][start.col]
  const endCell = grid[end.row][end.col]
  
  if (startCell.type === 'tower' || startCell.type === 'obstacle') {
    console.warn('起点位置被阻挡')
    return null
  }
  
  if (endCell.type === 'tower' || endCell.type === 'obstacle') {
    console.warn('终点位置被阻挡')
    return null
  }
  
  // 特殊情况:起点就是终点
  if (start.row === end.row && start.col === end.col) {
    return [{ row: start.row, col: start.col }]
  }
  
  // 使用Set记录已访问的格子
  const visited = new Set<string>()
  
  // BFS队列
  const queue: Array<{
    row: number
    col: number
    path: { row: number; col: number }[]
  }> = []
  
  // 初始化队列
  queue.push({
    row: start.row,
    col: start.col,
    path: [{ row: start.row, col: start.col }]
  })
  visited.add(`${start.row},${start.col}`)
  
  // 四个移动方向
  const directions = [
    { dr: -1, dc: 0 },  // 上
    { dr: 1, dc: 0 },   // 下
    { dr: 0, dc: -1 },  // 左
    { dr: 0, dc: 1 }    // 右
  ]
  
  // BFS主循环
  while (queue.length > 0) {
    const current = queue.shift()!
    
    // 检查是否到达终点
    if (current.row === end.row && current.col === end.col) {
      return current.path
    }
    
    // 探索四个方向
    for (const { dr, dc } of directions) {
      const newRow = current.row + dr
      const newCol = current.col + dc
      const key = `${newRow},${newCol}`
      
      // 边界检查
      if (newRow < 0 || newRow >= rows || newCol < 0 || newCol >= cols) {
        continue
      }
      
      // 检查是否已经访问过
      if (visited.has(key)) {
        continue
      }
      
      // 检查该位置是否可通行
      const cell = grid[newRow][newCol]
      if (cell.type === 'tower' || cell.type === 'obstacle') {
        continue
      }
      
      // 标记为已访问并加入队列
      visited.add(key)
      
      queue.push({
        row: newRow,
        col: newCol,
        path: [...current.path, { row: newRow, col: newCol }]
      })
    }
  }
  
  return null
}

/**
 * 检查在指定位置放置塔是否会堵死路径
 * 
 * 实现原理:
 * 1. 临时将该位置标记为'tower'
 * 2. 执行BFS寻路(经过配置的必经点)
 * 3. 如果能找到路径,说明不会堵死
 * 4. 恢复原状并返回结果
 * 
 * 注意:此函数会临时修改grid,但会在返回前恢复
 * 
 * @param grid - 当前地图网格
 * @param testPosition - 测试放置塔的位置 {row, col}
 * @param startPos - 敌人起点坐标
 * @param endPos - 敌人终点坐标
 * @returns 是否可以放置(true表示不会堵死路径,false表示会堵死)
 */
export function canPlaceTower(
  grid: GridCell[][],
  testPosition: { row: number; col: number },
  startPos: { row: number; col: number },
  endPos: { row: number; col: number }
): boolean {
  const { row, col } = testPosition
  
  // 边界检查
  if (row < 0 || row >= grid.length || col < 0 || col >= grid[0].length) {
    return false
  }
  
  // 保存原始类型,用于后续恢复
  const originalType = grid[row][col].type
  
  // 如果该位置已经有塔或障碍物,不能放置
  if (originalType === 'tower' || originalType === 'obstacle') {
    return false
  }
  
  // 临时将该位置标记为塔
  grid[row][col].type = 'tower'
  
  // 尝试寻路,检查是否还能从起点经过必经点到达终点
  const path = findPath(grid, startPos, endPos)
  
  // 恢复原状(重要:必须恢复,否则会影响游戏状态)
  grid[row][col].type = originalType
  
  // 如果能找到路径,则可以放置;否则不能放置
  return path !== null
}

/**
 * 计算路径的总长度(格子数)
 * 
 * 路径长度定义为:从起点到终点需要经过的步数
 * 例如:路径包含5个点,则长度为4(需要走4步)
 * 
 * @param path - 路径点数组(由findPath返回)
 * @returns 路径长度(步数),如果path为空或null则返回0
 */
export function getPathLength(path: { row: number; col: number }[]): number {
  // 空路径或无效路径
  if (!path || path.length === 0) {
    return 0
  }
  
  // 路径长度 = 点数 - 1
  // 例如:A -> B -> C 有3个点,但只需要走2步
  return path.length - 1
}

/**
 * 获取路径上的下一个移动方向
 * 
 * 用于敌人沿路径移动时确定下一步的方向
 * 
 * @param currentPos - 当前位置
 * @param nextPos - 下一个位置
 * @returns 移动方向 'up' | 'down' | 'left' | 'right'
 */
export function getMoveDirection(
  currentPos: { row: number; col: number },
  nextPos: { row: number; col: number }
): 'up' | 'down' | 'left' | 'right' {
  const dr = nextPos.row - currentPos.row
  const dc = nextPos.col - currentPos.col
  
  if (dr === -1 && dc === 0) return 'up'
  if (dr === 1 && dc === 0) return 'down'
  if (dr === 0 && dc === -1) return 'left'
  if (dr === 0 && dc === 1) return 'right'
  
  // 异常情况,默认返回'right'
  console.warn('无效的移动方向', { currentPos, nextPos })
  return 'right'
}

/**
 * 检查某个位置是否在路径上
 * 
 * @param position - 要检查的位置
 * @param path - 路径点数组
 * @returns 是否在路径上
 */
export function isPositionOnPath(
  position: { row: number; col: number },
  path: { row: number; col: number }[] | null
): boolean {
  if (!path || path.length === 0) {
    return false
  }
  
  return path.some(p => p.row === position.row && p.col === position.col)
}
