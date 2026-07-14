import { useCallback } from 'react'
import type { GridCell } from '../types/game'
import { findPath, canPlaceTower } from './pathfinding'
import { MAP_CONFIG } from '../config/map'

/**
 * 寻路Hook
 * 
 * 提供寻路相关的功能封装:
 * - 计算当前地图的最短路径
 * - 检查塔是否可以放置在指定位置
 * - 验证放置操作的有效性
 * 
 * 使用示例:
 * ```typescript
 * const { calculatePath, checkPlacement, validatePlacement, startPos, endPos } = usePathfinding()
 * 
 * // 计算路径
 * const path = calculatePath(grid)
 * 
 * // 检查是否可以放置塔
 * const canPlace = checkPlacement(grid, { row: 5, col: 5 })
 * ```
 */
export function usePathfinding() {
  // 从配置中获取起点和终点
  const { startPos, endPos } = MAP_CONFIG
  
  /**
   * 计算当前地图的最短路径
   * 
   * 基于当前grid状态,使用BFS算法找到从起点到终点的最短路径
   * 每次调用都会重新计算,确保路径反映最新的地图状态
   * 
   * @param grid - 当前地图网格
   * @returns 路径点数组,如果无法到达则返回null
   */
  const calculatePath = useCallback((grid: GridCell[][]) => {
    return findPath(grid, startPos, endPos)
  }, [startPos, endPos])
  
  /**
   * 检查是否可以在指定位置放置塔
   * 
   * 这是一个"只读"检查,不会修改grid
   * 内部会在网格副本标记该位置为塔,然后执行BFS验证
   * 
   * 适用场景:
   * - 鼠标悬停时预览是否可以放置
   * - UI显示放置可行性提示
   * 
   * @param grid - 当前地图网格
   * @param position - 要检查的位置 {row, col}
   * @returns true表示可以放置,false表示不能放置(会堵死路径或位置无效)
   */
  const checkPlacement = useCallback((
    grid: GridCell[][],
    position: { row: number; col: number }
  ) => {
    return canPlaceTower(grid, position, startPos, endPos)
  }, [startPos, endPos])
  
  /**
   * 验证放置操作(不会修改grid)
   * 
   * 与checkPlacement功能相同,但语义上更强调"验证"动作
   * 在实际放置塔之前调用此函数进行最终确认
   * 
   * 注意:此函数在网格副本上完成验证
   * 
   * @param grid - 当前地图网格
   * @param position - 要验证的位置 {row, col}
   * @returns true表示验证通过,false表示验证失败
   */
  const validatePlacement = useCallback((
    grid: GridCell[][],
    position: { row: number; col: number }
  ): boolean => {
    return canPlaceTower(grid, position, startPos, endPos)
  }, [startPos, endPos])
  
  /**
   * 批量检查多个位置的放置可行性
   * 
   * 用于一次性检查多个候选位置,提高性能
   * 
   * @param grid - 当前地图网格
   * @param positions - 要检查的位置数组
   * @returns 每个位置的检查结果数组
   */
  const batchCheckPlacement = useCallback((
    grid: GridCell[][],
    positions: Array<{ row: number; col: number }>
  ): boolean[] => {
    return positions.map(position => 
      canPlaceTower(grid, position, startPos, endPos)
    )
  }, [startPos, endPos])
  
  return {
    calculatePath,
    checkPlacement,
    validatePlacement,
    batchCheckPlacement,
    startPos,
    endPos
  }
}
