import { describe, expect, it } from 'vitest'
import { advanceDamageNumbers, createDamageNumber } from './damageNumbers'

describe('damage number lifecycle', () => {
  it('captures the impact position and rounds final calculated damage', () => {
    const position = { x: 42, y: 68 }
    const damageNumber = createDamageNumber({
      sequence: 2,
      position,
      amount: 16.67,
      damageType: 'physical',
      critical: true
    })

    position.x = 100

    expect(damageNumber).toMatchObject({
      id: 'damage_2',
      position: { x: 42, y: 68 },
      amount: 17,
      damageType: 'physical',
      critical: true,
      elapsedMs: 0,
      horizontalOffset: 5
    })
    expect(damageNumber.durationMs).toBeGreaterThan(720)
  })

  it('advances without mutating inputs and removes only expired numbers', () => {
    const active = createDamageNumber({
      sequence: 1,
      position: { x: 20, y: 20 },
      amount: 5,
      damageType: 'poison'
    })

    const advanced = advanceDamageNumbers([active], 300)

    expect(active.elapsedMs).toBe(0)
    expect(advanced[0].elapsedMs).toBe(300)
    expect(advanceDamageNumbers(advanced, 500)).toEqual([])
  })

  it('does not advance while no elapsed frame time is supplied', () => {
    const active = createDamageNumber({
      sequence: 0,
      position: { x: 20, y: 20 },
      amount: 5,
      damageType: 'magic'
    })

    expect(advanceDamageNumbers([active], 0)[0].elapsedMs).toBe(0)
  })
})
