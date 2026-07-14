import type { Enemy, EnemyType } from '../types/game'

export const ENEMY_TYPES = {
  basic: {
    health: 50,
    speed: 60,
    armor: 0,
    magicResist: 0,
    reward: 5,
    mineDamage: 1,
    color: '#FF6B6B',
    radius: 12,
    description: '普通敌人'
  },
  fast: {
    health: 35,
    speed: 100,
    armor: 0,
    magicResist: 0,
    reward: 7,
    mineDamage: 1,
    color: '#FFA500',
    radius: 10,
    description: '快速敌人'
  },
  tank: {
    health: 150,
    speed: 40,
    armor: 5,
    magicResist: 0.2,
    reward: 15,
    mineDamage: 1,
    color: '#8B0000',
    radius: 14,
    description: '坦克敌人'
  },
  boss: {
    health: 500,
    speed: 32,
    armor: 10,
    magicResist: 0.3,
    reward: 75,
    mineDamage: 5,
    color: '#4A148C',
    radius: 18,
    description: '矿坑领主'
  }
}

// 创建敌人的辅助函数
export function createEnemy(
  type: EnemyType,
  startPosition: { x: number; y: number },
  healthMultiplier: number = 1.0  // 血量倍率(默认1.0)
): Enemy {
  const config = ENEMY_TYPES[type]
  
  // ✅ 应用血量倍率
  const actualHealth = Math.floor(config.health * healthMultiplier)
  
  return {
    id: `enemy_${Date.now()}_${Math.random()}`,
    type,
    position: startPosition,
    health: actualHealth,
    maxHealth: actualHealth,
    speed: config.speed,
    armor: config.armor,
    magicResist: config.magicResist,
    pathIndex: 0,
    progress: 0,
    reward: config.reward,
    mineDamage: config.mineDamage
  }
}
