/**
 * 检查两个圆形是否碰撞
 * @param obj1 - 第一个圆形对象
 * @param obj2 - 第二个圆形对象
 * @returns 是否碰撞
 */
export function checkCircleCollision(
  obj1: { x: number; y: number; radius?: number },
  obj2: { x: number; y: number; radius?: number }
): boolean {
  const dx = obj1.x - obj2.x
  const dy = obj1.y - obj2.y
  const distanceSquared = dx * dx + dy * dy
  
  // 默认半径为10
  const radius1 = obj1.radius || 10
  const radius2 = obj2.radius || 10
  const radiusSum = radius1 + radius2
  
  // 比较距离平方,避免开方运算
  return distanceSquared <= radiusSum * radiusSum
}

/**
 * 计算两点之间的距离
 * @param p1 - 第一个点
 * @param p2 - 第二个点
 * @returns 距离
 */
export function getDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  const dx = p1.x - p2.x
  const dy = p1.y - p2.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * 计算两点之间的距离平方(性能优化,避免开方)
 * @param p1 - 第一个点
 * @param p2 - 第二个点
 * @returns 距离平方
 */
export function getDistanceSquared(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  const dx = p1.x - p2.x
  const dy = p1.y - p2.y
  return dx * dx + dy * dy
}
