import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  calculateUpgradeCost,
  canCraftSpecialTower,
  getTowerLevelProbabilities,
  randomizeTowerLevel
} from './towers'

describe('special tower crafting', () => {
  it('accepts the two required gems in any storage order', () => {
    expect(canCraftSpecialTower([
      { gemType: 'topaz' },
      { gemType: 'diamond' }
    ], 'silver')).toBe(true)
  })

  it('rejects a recipe when a required gem is missing', () => {
    expect(canCraftSpecialTower([
      { gemType: 'diamond' },
      { gemType: 'ruby' }
    ], 'silver')).toBe(false)
  })

  it('does not treat an existing special tower as a recipe gem', () => {
    expect(canCraftSpecialTower([
      { specialType: 'silver' },
      { gemType: 'topaz' }
    ], 'silver')).toBe(false)
  })
})

describe('tower level probabilities', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    [1, { chipped: 0.70, flawed: 0.25, normal: 0.05 }],
    [5, { chipped: 0.70, flawed: 0.25, normal: 0.05 }],
    [6, { chipped: 0.60, flawed: 0.30, normal: 0.10 }],
    [21, { chipped: 0.30, flawed: 0.45, normal: 0.25 }]
  ])('returns the configured probabilities for level %i', (level, expected) => {
    expect(getTowerLevelProbabilities(level)).toEqual(expected)
  })

  it('falls back to the starting probabilities outside configured ranges', () => {
    expect(getTowerLevelProbabilities(0)).toEqual({
      chipped: 0.70,
      flawed: 0.25,
      normal: 0.05
    })
  })

  it.each([
    [0.6999, 'chipped'],
    [0.7, 'flawed'],
    [0.9499, 'flawed'],
    [0.95, 'normal']
  ] as const)('maps a random value of %f to %s at level 1', (randomValue, expected) => {
    vi.spyOn(Math, 'random').mockReturnValue(randomValue)

    expect(randomizeTowerLevel(1)).toBe(expected)
  })
})

describe('calculateUpgradeCost', () => {
  it.each([
    [1, 100],
    [2, 200],
    [3, 400],
    [5, 1600]
  ])('calculates the cost for level %i', (level, expected) => {
    expect(calculateUpgradeCost(level)).toBe(expected)
  })
})
