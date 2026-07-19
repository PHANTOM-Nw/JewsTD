import { describe, expect, it } from 'vitest'
import {
  MAHJONG_FORMATION_MULTIPLIERS,
  MAHJONG_FORMATION_TILE_COUNTS,
  MAHJONG_SUITS
} from '../config/mahjong'
import type {
  MahjongActiveSource,
  MahjongFormation,
  MahjongNumberTile,
  MahjongRandomStats
} from '../types/game'
import {
  calculateMahjongFormationStats,
  createSingleMahjongTowerState,
  getMahjongFormationMechanics
} from './mahjongStats'

const activeSources: MahjongActiveSource[] = [
  {
    tileId: 'opaque-a',
    originalStats: { damage: 10, attackIntervalMs: 1000, attackRange: 100 }
  },
  {
    tileId: 'opaque-b',
    originalStats: { damage: 30, attackIntervalMs: 500, attackRange: 140 }
  }
]

describe('Mahjong formation stat inheritance', () => {
  it('averages attack frequency before applying final formation mechanics', () => {
    const stats = calculateMahjongFormationStats(activeSources, 'pair', 'bamboo')

    expect(stats.damage).toBeCloseTo(20 * MAHJONG_FORMATION_MULTIPLIERS.pair.damage)
    expect(stats.attackRange).toBeCloseTo(
      120 * MAHJONG_FORMATION_MULTIPLIERS.pair.attackRange
    )
    expect(stats.attackIntervalMs).toBeCloseTo(
      1000 / (1.5 * MAHJONG_FORMATION_MULTIPLIERS.pair.attackFrequency * 1.2)
    )
  })

  it('recomputes the final formation from original rolls without stacking', () => {
    const pair = calculateMahjongFormationStats(activeSources, 'pair', 'characters')
    const pung = calculateMahjongFormationStats(activeSources, 'pung', 'characters')

    expect(pair.damage).toBeCloseTo(20 * MAHJONG_FORMATION_MULTIPLIERS.pair.damage)
    expect(pung.damage).toBeCloseTo(20 * MAHJONG_FORMATION_MULTIPLIERS.pung.damage)
    expect(pung.damage).not.toBeCloseTo(
      pair.damage * MAHJONG_FORMATION_MULTIPLIERS.pung.damage
    )
    expect(pung.attackIntervalMs).toBeCloseTo(
      1000 / (1.5 * MAHJONG_FORMATION_MULTIPLIERS.pung.attackFrequency)
    )
  })

  it('only uses active sources, so a contained wall identity adds no weight', () => {
    const stateWithWallMaterial = {
      activeSources,
      containedTileIds: ['opaque-a', 'opaque-b', 'wall-tile']
    }
    const stats = calculateMahjongFormationStats(
      stateWithWallMaterial.activeSources,
      'pung',
      'dots'
    )

    expect(stats.damage).toBeCloseTo(20 * MAHJONG_FORMATION_MULTIPLIERS.pung.damage)
    expect(stats.attackRange).toBeCloseTo(
      120 * MAHJONG_FORMATION_MULTIPLIERS.pung.attackRange
    )
  })

  it('creates a single state with one stable entity and original roll', () => {
    const tile: MahjongNumberTile = {
      id: 'opaque-tile',
      suit: 'dots',
      rank: 7,
      copy: 2
    }
    const originalStats = { damage: 24, attackIntervalMs: 950, attackRange: 121 }

    expect(createSingleMahjongTowerState(tile, originalStats)).toEqual({
      formation: 'single',
      suit: 'dots',
      ranks: [7],
      containedTileIds: ['opaque-tile'],
      activeSources: [{ tileId: 'opaque-tile', originalStats }],
      attachments: []
    })
  })

  it('exposes the complete final mechanics for a formation', () => {
    expect(getMahjongFormationMechanics('characters', 'kong')).toEqual({
      crit: { chance: .4, multiplier: 3 },
      armorIgnoreRatio: .65
    })
  })

  it('rejects missing or invalid active stat sources', () => {
    expect(() => calculateMahjongFormationStats([], 'single', 'characters')).toThrow()
    expect(() => calculateMahjongFormationStats([{
      tileId: 'bad',
      originalStats: { damage: 1, attackIntervalMs: 0, attackRange: 1 }
    }], 'single', 'characters')).toThrow()
  })
})

const MULTI_TILE_FORMATIONS: readonly MahjongFormation[] = [
  'pair',
  'chow',
  'pung',
  'kong'
]

const breakEvenCases = MAHJONG_SUITS.flatMap(suit => (
  MULTI_TILE_FORMATIONS.map(formation => ({ suit, formation }))
))

/**
 * `calculateMahjongFormationStats` averages its sources, so consuming N tiles only
 * pays off when the formation multipliers give back at least N times a single tile's
 * DPS. This guards the invariant that synthesis is never a downgrade: anyone lowering
 * MAHJONG_FORMATION_MULTIPLIERS past the break-even line fails here immediately.
 */
describe('Mahjong synthesis break-even invariant', () => {
  const originalStats: MahjongRandomStats = {
    damage: 20,
    attackIntervalMs: 1000,
    attackRange: 120
  }
  const dps = (stats: MahjongRandomStats) => stats.damage / stats.attackIntervalMs

  it.each(breakEvenCases)(
    'gives a $suit $formation at least the combined DPS of the tiles it consumes',
    ({ suit, formation }) => {
      const tileCount = MAHJONG_FORMATION_TILE_COUNTS[formation]
      const sources: MahjongActiveSource[] = Array.from(
        { length: tileCount },
        (_, index) => ({ tileId: `break-even-${index}`, originalStats })
      )

      const single = calculateMahjongFormationStats([sources[0]], 'single', suit)
      const combined = calculateMahjongFormationStats(sources, formation, suit)

      expect(dps(combined)).toBeGreaterThanOrEqual(tileCount * dps(single) - 1e-9)
    }
  )
})
