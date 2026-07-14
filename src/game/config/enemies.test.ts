import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAP_CONFIG, initializeGrid } from './map'
import { findPath, getPathLength } from '../pathfinding/pathfinding'
import { createEnemy, ENEMY_TYPES } from './enemies'

describe('enemy configuration', () => {
  it('gives every enemy valid combat and economy values', () => {
    for (const config of Object.values(ENEMY_TYPES)) {
      expect(config.health).toBeGreaterThan(0)
      expect(config.speed).toBeGreaterThan(0)
      expect(config.reward).toBeGreaterThan(0)
      expect(config.mineDamage).toBeGreaterThan(0)
      expect(config.radius).toBeGreaterThan(0)
      expect(config.armor).toBeGreaterThanOrEqual(0)
      expect(config.magicResist).toBeGreaterThanOrEqual(0)
      expect(config.magicResist).toBeLessThan(1)
    }
  })

  it('uses the tuned mobile-board speeds and 18-step empty-route travel times', () => {
    const path = findPath(initializeGrid(), MAP_CONFIG.startPos, MAP_CONFIG.endPos)
    const pathDistance = getPathLength(path ?? []) * MAP_CONFIG.cellSize

    expect(getPathLength(path ?? [])).toBe(18)
    expect({
      basic: ENEMY_TYPES.basic.speed,
      fast: ENEMY_TYPES.fast.speed,
      tank: ENEMY_TYPES.tank.speed,
      boss: ENEMY_TYPES.boss.speed
    }).toEqual({ basic: 50, fast: 85, tank: 34, boss: 27 })
    expect(pathDistance / ENEMY_TYPES.basic.speed).toBeCloseTo(14.4)
    expect(pathDistance / ENEMY_TYPES.fast.speed).toBeCloseTo(8.47, 2)
    expect(pathDistance / ENEMY_TYPES.tank.speed).toBeCloseTo(21.18, 2)
    expect(pathDistance / ENEMY_TYPES.boss.speed).toBeCloseTo(26.67, 2)
  })
})

describe('createEnemy', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1_234_567)
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('applies the health multiplier and initializes a deterministic enemy', () => {
    const startPosition = { x: 40, y: 80 }
    const enemy = createEnemy('basic', startPosition, 1.5)

    expect(enemy).toMatchObject({
      id: 'enemy_1234567_0.25',
      type: 'basic',
      position: startPosition,
      health: 75,
      maxHealth: 75,
      speed: ENEMY_TYPES.basic.speed,
      reward: ENEMY_TYPES.basic.reward,
      mineDamage: ENEMY_TYPES.basic.mineDamage,
      pathIndex: 0,
      progress: 0
    })
  })

  it('uses the boss mine damage while applying the wave health multiplier', () => {
    const enemy = createEnemy('boss', { x: 0, y: 0 }, 2)

    expect(enemy.health).toBe(ENEMY_TYPES.boss.health * 2)
    expect(enemy.maxHealth).toBe(ENEMY_TYPES.boss.health * 2)
    expect(enemy.mineDamage).toBe(ENEMY_TYPES.boss.mineDamage)
    expect(enemy.mineDamage).toBeGreaterThan(ENEMY_TYPES.basic.mineDamage)
  })
})
