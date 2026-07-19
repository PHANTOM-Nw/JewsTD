import { describe, expect, it } from 'vitest'
import type { MahjongActiveSource, MahjongNumberTile } from '../types/game'
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

    expect(stats.damage).toBeCloseTo(31)
    expect(stats.attackRange).toBeCloseTo(126)
    expect(stats.attackIntervalMs).toBeCloseTo(1000 / (1.5 * 1.2))
  })

  it('recomputes the final formation from original rolls without stacking', () => {
    const pair = calculateMahjongFormationStats(activeSources, 'pair', 'characters')
    const pung = calculateMahjongFormationStats(activeSources, 'pung', 'characters')

    expect(pair.damage).toBeCloseTo(20 * 1.55)
    expect(pung.damage).toBeCloseTo(20 * 1.8)
    expect(pung.damage).not.toBeCloseTo(pair.damage * 1.8)
    expect(pung.attackIntervalMs).toBeCloseTo(1000 / (1.5 * 1.2))
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

    expect(stats.damage).toBeCloseTo(20 * 1.8)
    expect(stats.attackRange).toBeCloseTo(120 * 1.1)
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
