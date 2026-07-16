import { describe, expect, it } from 'vitest'
import type { MahjongTargetEffectState } from './mahjongAttack'
import {
  advanceMahjongRuntimeEffects,
  hasMahjongRuntimeEffects
} from './mahjongRuntimeEffects'

function createEffects(): MahjongTargetEffectState {
  return {
    poisons: [{
      sourceId: 'bamboo',
      damagePerSecond: 7,
      stacks: 3,
      maxStacks: 3,
      expiresAtMs: 2500
    }],
    burn: {
      sourceId: 'red',
      damagePerSecond: 6,
      expiresAtMs: 2200
    },
    slow: { amount: .4, expiresAtMs: 2100 },
    stun: { expiresAtMs: 1900 }
  }
}

describe('advanceMahjongRuntimeEffects', () => {
  it('deals continuous stacked poison and burn damage over an active frame', () => {
    const result = advanceMahjongRuntimeEffects(createEffects(), 2000, 500)

    expect(result.poisonDamage).toBeCloseTo(10.5)
    expect(result.burnDamage).toBeCloseTo(3)
    expect(result.effects.poisons).toHaveLength(1)
    expect(result.effects.burn).not.toBeNull()
    expect(result.effects.slow).not.toBeNull()
    expect(result.effects.stun).toBeNull()
  })

  it('only charges the part of a frame before an effect expires', () => {
    const result = advanceMahjongRuntimeEffects(createEffects(), 2600, 500)

    expect(result.poisonDamage).toBeCloseTo(8.4)
    expect(result.burnDamage).toBeCloseTo(.6)
    expect(hasMahjongRuntimeEffects(result.effects)).toBe(false)
  })

  it('does not advance effects when game time does not advance', () => {
    const result = advanceMahjongRuntimeEffects(createEffects(), 2000, 0)

    expect(result.poisonDamage).toBe(0)
    expect(result.burnDamage).toBe(0)
  })
})
