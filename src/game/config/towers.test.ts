import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BASE_TOWER_STATS,
  calculateUpgradeCost,
  canCraftSpecialTower,
  findSynthesizableTowerPairs,
  getTowerLevelProbabilities,
  randomizeTowerLevel,
  SPECIAL_TOWER_RECIPES
} from './towers'

describe('special tower crafting', () => {
  it('accepts the two required gems in any field order', () => {
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

  it('uses the configured materials for every special tower recipe', () => {
    const specialTypes = Object.keys(SPECIAL_TOWER_RECIPES) as Array<keyof typeof SPECIAL_TOWER_RECIPES>

    expect(specialTypes).toHaveLength(6)

    specialTypes.forEach(specialType => {
      const [firstGem, secondGem] = SPECIAL_TOWER_RECIPES[specialType].requiredGems

      expect(canCraftSpecialTower([
        { gemType: secondGem },
        { gemType: firstGem }
      ], specialType)).toBe(true)
    })
  })
})

describe('mobile board spatial balance', () => {
  it('keeps every base tower within the configured 100 to 150 pixel range', () => {
    const ranges = Object.values(BASE_TOWER_STATS).flatMap(levels => (
      Object.values(levels).map(stats => stats.range)
    ))

    expect(Math.min(...ranges)).toBe(100)
    expect(Math.max(...ranges)).toBe(150)
    ranges.forEach(range => {
      expect(range).toBeGreaterThanOrEqual(100)
      expect(range).toBeLessThanOrEqual(150)
    })
  })

  it('caps special tower range and every configured splash radius', () => {
    const specialStats = Object.values(SPECIAL_TOWER_RECIPES).map(recipe => recipe.stats)
    const splashRadii = [
      ...Object.values(BASE_TOWER_STATS).flatMap(levels => (
        Object.values(levels).flatMap(stats => (
          stats.splashRadius === undefined ? [] : [stats.splashRadius]
        ))
      )),
      ...specialStats.flatMap(stats => (
        stats.splashRadius === undefined ? [] : [stats.splashRadius]
      ))
    ]

    specialStats.forEach(stats => {
      expect(stats.range).toBeLessThanOrEqual(145)
    })
    expect(Math.min(...splashRadii)).toBe(40)
    expect(Math.max(...splashRadii)).toBe(60)
  })
})

describe('regular tower synthesis pairs', () => {
  it('finds pairs for every configured base gem at each upgradeable level', () => {
    const gemTypes = Object.keys(BASE_TOWER_STATS) as Array<keyof typeof BASE_TOWER_STATS>
    const levels = ['chipped', 'flawed', 'normal'] as const
    const storedTowers = gemTypes.flatMap(gemType => levels.flatMap(level => [
      { id: `${gemType}-${level}-1`, gemType, level },
      { id: `${gemType}-${level}-2`, gemType, level }
    ]))

    const pairs = findSynthesizableTowerPairs(storedTowers)

    expect(pairs).toHaveLength(gemTypes.length * levels.length)
    expect(pairs.map(([firstTower]) => `${firstTower.gemType}:${firstTower.level}`)).toEqual(
      gemTypes.flatMap(gemType => levels.map(level => `${gemType}:${level}`))
    )
  })

  it('excludes flawless, special, mismatched and single towers', () => {
    const storedTowers = [
      { id: 'flawless-1', gemType: 'ruby', level: 'flawless' },
      { id: 'flawless-2', gemType: 'ruby', level: 'flawless' },
      { id: 'special-1', specialType: 'silver', level: 'normal' },
      { id: 'special-2', specialType: 'silver', level: 'normal' },
      { id: 'single', gemType: 'emerald', level: 'normal' },
      { id: 'mismatch-1', gemType: 'diamond', level: 'chipped' },
      { id: 'mismatch-2', gemType: 'diamond', level: 'flawed' }
    ] as const

    expect(findSynthesizableTowerPairs(storedTowers)).toEqual([])
  })

  it('returns each unique combination when more than two matching towers exist', () => {
    const storedTowers = [
      { id: '1', gemType: 'sapphire', level: 'normal' },
      { id: '2', gemType: 'sapphire', level: 'normal' },
      { id: '3', gemType: 'sapphire', level: 'normal' }
    ] as const

    expect(findSynthesizableTowerPairs(storedTowers).map(pair => pair.map(tower => tower.id))).toEqual([
      ['1', '2'],
      ['1', '3'],
      ['2', '3']
    ])
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
