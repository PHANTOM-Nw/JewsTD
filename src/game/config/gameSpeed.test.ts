import { describe, expect, it } from 'vitest'
import {
  COMBAT_SPEED_OPTIONS,
  DEFAULT_COMBAT_SPEED,
  getNextCombatSpeed,
  scaleCombatDeltaTime
} from './gameSpeed'

describe('combat speed configuration', () => {
  it('offers the configured battle speed gears and starts at normal speed', () => {
    expect(COMBAT_SPEED_OPTIONS).toEqual([1, 1.5, 3])
    expect(DEFAULT_COMBAT_SPEED).toBe(1)
  })

  it('cycles through every gear and wraps back to normal speed', () => {
    expect(getNextCombatSpeed(1)).toBe(1.5)
    expect(getNextCombatSpeed(1.5)).toBe(3)
    expect(getNextCombatSpeed(3)).toBe(1)
  })

  it.each([
    [1, 100],
    [1.5, 150],
    [3, 300]
  ] as const)('scales a playing frame at %sx', (combatSpeed, expectedDeltaTime) => {
    expect(scaleCombatDeltaTime(100, combatSpeed)).toBe(expectedDeltaTime)
  })

  it('does not let a negative frame delta move combat time backwards', () => {
    expect(scaleCombatDeltaTime(-100, 3)).toBe(0)
  })
})
