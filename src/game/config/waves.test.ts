import { describe, expect, it } from 'vitest'
import { ENEMY_TYPES } from './enemies'
import { WAVES } from './waves'

describe('wave configuration', () => {
  it('defines exactly twelve consecutively numbered waves', () => {
    expect(WAVES).toHaveLength(12)
    expect(WAVES.map(wave => wave.waveNumber)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1)
    )
  })

  it('matches the tuned twelve-wave enemy table and preserves spawn intervals', () => {
    expect(WAVES.map(wave => ({
      enemies: wave.enemies,
      healthMultiplier: wave.healthMultiplier
    }))).toEqual([
      { enemies: [{ type: 'basic', count: 5, interval: 2000 }], healthMultiplier: 1.0 },
      { enemies: [{ type: 'basic', count: 7, interval: 1800 }], healthMultiplier: 1.1 },
      {
        enemies: [
          { type: 'basic', count: 5, interval: 1500 },
          { type: 'fast', count: 3, interval: 1200 }
        ],
        healthMultiplier: 1.3
      },
      {
        enemies: [
          { type: 'basic', count: 8, interval: 1500 },
          { type: 'fast', count: 4, interval: 1000 }
        ],
        healthMultiplier: 1.55
      },
      {
        enemies: [
          { type: 'basic', count: 7, interval: 1200 },
          { type: 'fast', count: 5, interval: 800 },
          { type: 'tank', count: 2, interval: 3000 }
        ],
        healthMultiplier: 1.85
      },
      {
        enemies: [
          { type: 'basic', count: 10, interval: 1000 },
          { type: 'fast', count: 6, interval: 700 },
          { type: 'tank', count: 3, interval: 2500 }
        ],
        healthMultiplier: 2.25
      },
      {
        enemies: [
          { type: 'basic', count: 10, interval: 1000 },
          { type: 'fast', count: 8, interval: 700 },
          { type: 'tank', count: 4, interval: 2200 }
        ],
        healthMultiplier: 2.75
      },
      {
        enemies: [
          { type: 'basic', count: 12, interval: 900 },
          { type: 'fast', count: 10, interval: 600 },
          { type: 'tank', count: 4, interval: 2000 }
        ],
        healthMultiplier: 3.3
      },
      {
        enemies: [
          { type: 'basic', count: 12, interval: 800 },
          { type: 'fast', count: 12, interval: 600 },
          { type: 'tank', count: 5, interval: 1800 }
        ],
        healthMultiplier: 4.0
      },
      {
        enemies: [
          { type: 'basic', count: 16, interval: 800 },
          { type: 'fast', count: 12, interval: 600 },
          { type: 'tank', count: 6, interval: 1600 }
        ],
        healthMultiplier: 4.8
      },
      {
        enemies: [
          { type: 'basic', count: 16, interval: 700 },
          { type: 'fast', count: 14, interval: 500 },
          { type: 'tank', count: 8, interval: 1400 }
        ],
        healthMultiplier: 5.8
      },
      {
        enemies: [
          { type: 'basic', count: 20, interval: 600 },
          { type: 'fast', count: 16, interval: 500 },
          { type: 'tank', count: 9, interval: 1200 },
          { type: 'boss', count: 1, interval: 1000 }
        ],
        healthMultiplier: 7.0
      }
    ])
  })

  it('gives every wave enemies and a non-decreasing health multiplier', () => {
    let previousMultiplier = 0

    for (const wave of WAVES) {
      const totalEnemies = wave.enemies.reduce(
        (total, group) => total + group.count,
        0
      )
      const multiplier = wave.healthMultiplier ?? 1

      expect(totalEnemies).toBeGreaterThan(0)
      expect(multiplier).toBeGreaterThan(0)
      expect(multiplier).toBeGreaterThanOrEqual(previousMultiplier)

      for (const group of wave.enemies) {
        expect(group.count).toBeGreaterThan(0)
        expect(Number.isInteger(group.count)).toBe(true)
        expect(group.interval).toBeGreaterThan(0)
        expect(ENEMY_TYPES[group.type]).toBeDefined()
      }

      previousMultiplier = multiplier
    }
  })

  it('ends with a valid boss wave', () => {
    const finalWave = WAVES.at(-1)
    const bossGroup = finalWave?.enemies.find(group => group.type === 'boss')

    expect(finalWave?.waveNumber).toBe(12)
    expect(finalWave?.isBossWave).toBe(true)
    expect(bossGroup?.count).toBeGreaterThan(0)
    expect(ENEMY_TYPES.boss.health).toBeGreaterThan(0)
    expect(ENEMY_TYPES.boss.reward).toBeGreaterThan(0)
    expect(ENEMY_TYPES.boss.mineDamage).toBeGreaterThan(0)
  })
})
