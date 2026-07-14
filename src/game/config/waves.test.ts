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
