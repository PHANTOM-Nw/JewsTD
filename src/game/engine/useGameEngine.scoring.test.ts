import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./useGameEngine.ts', import.meta.url), 'utf8')

describe('useGameEngine kill reward wiring', () => {
  it('keeps every damage path behind the single first-death reward gateway', () => {
    expect(source.match(/applyEnemyDamage\(/g)).toHaveLength(1)
    expect(source).toContain(
      'applyEnemyDamageWithReward(enemy, poisonUpdate.damage)'
    )
    expect(source).toContain(
      'applyEnemyDamageWithReward(enemy, totalDamage)'
    )
    expect(source).toContain(
      'applyEnemyDamageWithReward(target, damage)'
    )
  })

  it('routes direct, splash and pierce damage through the shared damage target', () => {
    expect(source).toContain(
      'damageTarget(target, result.damage, bullet.damageType, result.critical)'
    )
    expect(source).toContain('damageSecondaryTarget(otherEnemy, 0.5)')
    expect(source).toContain(
      'damageSecondaryTarget(nextTarget, PIERCE_DAMAGE_MULTIPLIER)'
    )
  })
})
