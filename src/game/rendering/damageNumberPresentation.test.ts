import { describe, expect, it } from 'vitest'
import type { DamageNumber } from '../types/game'
import { getDamageNumberPresentation } from './damageNumberPresentation'

function createDamageNumber(overrides: Partial<DamageNumber> = {}): DamageNumber {
  return {
    id: 'damage_1',
    position: { x: 20, y: 20 },
    amount: 12,
    damageType: 'physical',
    critical: false,
    elapsedMs: 0,
    durationMs: 720,
    horizontalOffset: 0,
    ...overrides
  }
}

describe('damage number presentation', () => {
  it('keeps top-edge text inside the canvas while it rises', () => {
    const presentation = getDamageNumberPresentation(createDamageNumber({
      elapsedMs: 600
    }))

    expect(presentation.y).toBeGreaterThanOrEqual(presentation.fontSize + 4)
    expect(presentation.x).toBeGreaterThanOrEqual(16)
    expect(presentation.opacity).toBeLessThan(1)
  })

  it('emphasizes critical hits without losing the damage amount', () => {
    const presentation = getDamageNumberPresentation(createDamageNumber({
      amount: 48,
      critical: true,
      durationMs: 820
    }))

    expect(presentation.text).toBe('✦48')
    expect(presentation.fontSize).toBe(15)
    expect(presentation.lineWidth).toBeGreaterThan(2)
  })

  it('uses distinct styling for poison ticks', () => {
    const poison = getDamageNumberPresentation(createDamageNumber({
      damageType: 'poison'
    }))
    const physical = getDamageNumberPresentation(createDamageNumber())

    expect(poison.fill).not.toBe(physical.fill)
    expect(poison.fontSize).toBeLessThan(physical.fontSize)
  })

  it('uses a distinct ember style for burn ticks', () => {
    const burn = getDamageNumberPresentation(createDamageNumber({
      damageType: 'burn'
    }))
    const poison = getDamageNumberPresentation(createDamageNumber({
      damageType: 'poison'
    }))

    expect(burn.fill).not.toBe(poison.fill)
    expect(burn.shadow).toContain('255, 91, 37')
    expect(burn.fontSize).toBe(poison.fontSize)
  })
})
