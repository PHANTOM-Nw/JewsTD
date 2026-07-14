/**
 * BFS寻路系统测试
 * 
 * 这个文件包含了一些基本的测试用例,用于验证寻路算法的正确性
 * 可以在浏览器控制台中运行这些测试
 */

import { findPath, canPlaceTower, getPathLength, getMoveDirection, isPositionOnPath } from '../game/pathfinding/pathfinding'
import type { GridCell } from '../game/types/game'
import { MAP_CONFIG } from '../game/config/map'

/**
 * 创建测试用的空地图
 */
function createTestGrid(rows: number = 5, cols: number = 5): GridCell[][] {
  const grid: GridCell[][] = []
  for (let row = 0; row < rows; row++) {
    grid[row] = []
    for (let col = 0; col < cols; col++) {
      grid[row][col] = { row, col, type: 'empty' }
    }
  }
  return grid
}

/**
 * 测试1: 基本路径查找
 */
export function testBasicPathfinding() {
  console.log('=== 测试1: 基本路径查找 ===')
  
  const grid = createTestGrid(5, 5)
  const start = { row: 0, col: 0 }
  const end = { row: 4, col: 4 }
  
  const path = findPath(grid, start, end)
  
  if (path) {
    console.log('✓ 找到路径,长度:', getPathLength(path))
    console.log('路径点:', path)
    console.log('预期步数: 8 (曼哈顿距离)')
    console.log('实际步数:', getPathLength(path))
    
    // 验证路径的连续性
    let isValid = true
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1]
      const curr = path[i]
      const dr = Math.abs(curr.row - prev.row)
      const dc = Math.abs(curr.col - prev.col)
      
      if (dr + dc !== 1) {
        console.error('✗ 路径不连续:', prev, '->', curr)
        isValid = false
      }
    }
    
    if (isValid) {
      console.log('✓ 路径连续性验证通过')
    }
  } else {
    console.error('✗ 未找到路径')
  }
  
  console.log('')
}

/**
 * 测试2: 障碍物阻挡
 */
export function testObstacleBlocking() {
  console.log('=== 测试2: 障碍物阻挡 ===')
  
  const grid = createTestGrid(5, 5)
  
  // 在中间放置一堵墙
  for (let col = 0; col < 5; col++) {
    grid[2][col].type = 'obstacle'
  }
  
  const start = { row: 0, col: 0 }
  const end = { row: 4, col: 4 }
  
  const path = findPath(grid, start, end)
  
  if (path === null) {
    console.log('✓ 正确识别无法到达的情况')
  } else {
    console.error('✗ 应该无法到达,但找到了路径:', path)
  }
  
  console.log('')
}

/**
 * 测试3: 塔的阻挡检测
 */
export function testTowerBlocking() {
  console.log('=== 测试3: 塔的阻挡检测 ===')
  
  const grid = createTestGrid(5, 5)
  
  // 放置一些塔
  grid[1][1].type = 'tower'
  grid[1][2].type = 'tower'
  grid[2][1].type = 'tower'
  
  const start = { row: 0, col: 0 }
  const end = { row: 4, col: 4 }
  
  const path = findPath(grid, start, end)
  
  if (path) {
    console.log('✓ 绕过塔找到路径,长度:', getPathLength(path))
    console.log('路径:', path)
  } else {
    console.error('✗ 应该能找到绕过塔的路径')
  }
  
  console.log('')
}

/**
 * 测试4: 放置可行性检查
 */
export function testPlacementValidation() {
  console.log('=== 测试4: 放置可行性检查 ===')
  
  const grid = createTestGrid(5, 5)
  const start = { row: 0, col: 0 }
  const end = { row: 4, col: 4 }
  
  // 测试1: 空位置应该可以放置
  const canPlace1 = canPlaceTower(grid, { row: 2, col: 2 }, start, end)
  console.log('空位置放置:', canPlace1 ? '✓ 可以放置' : '✗ 不能放置')
  
  // 测试2: 放置后会堵死路径的位置
  // 创建一个狭窄通道
  const narrowGrid = createTestGrid(3, 5)
  for (let col = 0; col < 5; col++) {
    if (col !== 2) {
      narrowGrid[1][col].type = 'obstacle'
    }
  }
  
  const canPlace2 = canPlaceTower(narrowGrid, { row: 1, col: 2 }, { row: 0, col: 0 }, { row: 2, col: 4 })
  console.log('狭窄通道放置:', !canPlace2 ? '✓ 正确阻止放置' : '✗ 应该阻止放置')
  
  console.log('')
}

/**
 * 测试5: 边界情况
 */
export function testEdgeCases() {
  console.log('=== 测试5: 边界情况 ===')
  
  const grid = createTestGrid(5, 5)
  
  // 测试1: 起点超出边界
  const path1 = findPath(grid, { row: -1, col: 0 }, { row: 4, col: 4 })
  console.log('起点越界:', path1 === null ? '✓ 返回null' : '✗ 应该返回null')
  
  // 测试2: 终点超出边界
  const path2 = findPath(grid, { row: 0, col: 0 }, { row: 10, col: 10 })
  console.log('终点越界:', path2 === null ? '✓ 返回null' : '✗ 应该返回null')
  
  // 测试3: 起点等于终点
  const path3 = findPath(grid, { row: 2, col: 2 }, { row: 2, col: 2 })
  console.log('起点=终点:', path3 && path3.length === 1 ? '✓ 返回单点路径' : '✗ 应该返回单点路径')
  
  // 测试4: 空地图
  const emptyGrid: GridCell[][] = []
  const path4 = findPath(emptyGrid, { row: 0, col: 0 }, { row: 0, col: 0 })
  console.log('空地图:', path4 === null ? '✓ 返回null' : '✗ 应该返回null')
  
  console.log('')
}

/**
 * 测试6: 移动方向计算
 */
export function testMoveDirection() {
  console.log('=== 测试6: 移动方向计算 ===')
  
  const tests = [
    { from: { row: 2, col: 2 }, to: { row: 1, col: 2 }, expected: 'up' },
    { from: { row: 2, col: 2 }, to: { row: 3, col: 2 }, expected: 'down' },
    { from: { row: 2, col: 2 }, to: { row: 2, col: 1 }, expected: 'left' },
    { from: { row: 2, col: 2 }, to: { row: 2, col: 3 }, expected: 'right' }
  ]
  
  let allPassed = true
  for (const test of tests) {
    const direction = getMoveDirection(test.from, test.to)
    if (direction === test.expected) {
      console.log(`✓ ${test.expected}: 正确`)
    } else {
      console.error(`✗ ${test.expected}: 期望${test.expected},得到${direction}`)
      allPassed = false
    }
  }
  
  if (allPassed) {
    console.log('✓ 所有方向测试通过')
  }
  
  console.log('')
}

/**
 * 测试7: 路径位置检查
 */
export function testPositionOnPath() {
  console.log('=== 测试7: 路径位置检查 ===')
  
  const grid = createTestGrid(5, 5)
  const path = findPath(grid, { row: 0, col: 0 }, { row: 4, col: 4 })
  
  if (path) {
    // 测试路径上的点
    const onPath = isPositionOnPath(path[0], path)
    console.log('路径起点:', onPath ? '✓ 在路径上' : '✗ 应该在路径上')
    
    // 测试不在路径上的点
    const notOnPath = isPositionOnPath({ row: 0, col: 4 }, path)
    console.log('非路径点:', !notOnPath ? '✓ 不在路径上' : '✗ 应该不在路径上')
    
    // 测试null路径
    const nullPath = isPositionOnPath({ row: 0, col: 0 }, null)
    console.log('null路径:', !nullPath ? '✓ 返回false' : '✗ 应该返回false')
  }
  
  console.log('')
}

/**
 * 测试8: 实际地图配置测试
 */
export function testActualMapConfig() {
  console.log('=== 测试8: 实际地图配置测试 ===')
  
  const { rows, cols, startPos, endPos } = MAP_CONFIG
  
  // 创建实际大小的地图
  const grid: GridCell[][] = []
  for (let row = 0; row < rows; row++) {
    grid[row] = []
    for (let col = 0; col < cols; col++) {
      if (row === startPos.row && col === startPos.col) {
        grid[row][col] = { row, col, type: 'start' }
      } else if (row === endPos.row && col === endPos.col) {
        grid[row][col] = { row, col, type: 'end' }
      } else if (row === 7 && col === 10) {
        grid[row][col] = { row, col, type: 'mine' }
      } else {
        grid[row][col] = { row, col, type: 'empty' }
      }
    }
  }
  
  const path = findPath(grid, startPos, endPos)
  
  if (path) {
    console.log('✓ 在实际地图上找到路径')
    console.log('地图大小:', `${rows}x${cols}`)
    console.log('起点:', startPos)
    console.log('终点:', endPos)
    console.log('路径长度:', getPathLength(path), '步')
    console.log('路径点数:', path.length)
  } else {
    console.error('✗ 在实际地图上未找到路径')
  }
  
  console.log('')
}

/**
 * 运行所有测试
 */
export function runAllTests() {
  console.log('🚀 开始运行BFS寻路系统测试\n')
  
  try {
    testBasicPathfinding()
    testObstacleBlocking()
    testTowerBlocking()
    testPlacementValidation()
    testEdgeCases()
    testMoveDirection()
    testPositionOnPath()
    testActualMapConfig()
    
    console.log('✅ 所有测试完成!')
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error)
  }
}

// 导出所有测试函数,方便单独运行
export default {
  testBasicPathfinding,
  testObstacleBlocking,
  testTowerBlocking,
  testPlacementValidation,
  testEdgeCases,
  testMoveDirection,
  testPositionOnPath,
  testActualMapConfig,
  runAllTests
}
