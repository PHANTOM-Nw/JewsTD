import {
  MAHJONG_FORMATION_MECHANICS,
  MAHJONG_FORMATION_MULTIPLIERS
} from '../config/mahjong'
import type {
  MahjongActiveSource,
  MahjongCombatMechanics,
  MahjongFormation,
  MahjongNumberTile,
  MahjongRandomStats,
  MahjongSuit,
  MahjongTowerState
} from '../types/game'

function assertValidSources(sources: readonly MahjongActiveSource[]): void {
  if (sources.length === 0) {
    throw new Error('A Mahjong tower requires at least one active stat source')
  }

  for (const source of sources) {
    const { damage, attackIntervalMs, attackRange } = source.originalStats
    if (
      !Number.isFinite(damage)
      || !Number.isFinite(attackIntervalMs)
      || !Number.isFinite(attackRange)
      || damage < 0
      || attackIntervalMs <= 0
      || attackRange < 0
    ) {
      throw new Error('Mahjong active sources must contain finite, usable stats')
    }
  }
}

/**
 * Recomputes from immutable original rolls. Passing a pair/pung's already-scaled
 * runtime values is intentionally impossible, preventing multiplier stacking.
 */
export function calculateMahjongFormationStats(
  sources: readonly MahjongActiveSource[],
  formation: MahjongFormation,
  suit: MahjongSuit
): MahjongRandomStats {
  assertValidSources(sources)

  const sourceCount = sources.length
  const baseDamage = sources.reduce(
    (total, source) => total + source.originalStats.damage,
    0
  ) / sourceCount
  const baseRange = sources.reduce(
    (total, source) => total + source.originalStats.attackRange,
    0
  ) / sourceCount
  const baseAttackFrequency = sources.reduce(
    (total, source) => total + 1000 / source.originalStats.attackIntervalMs,
    0
  ) / sourceCount

  const multipliers = MAHJONG_FORMATION_MULTIPLIERS[formation]
  const mechanicFrequencyMultiplier = (
    MAHJONG_FORMATION_MECHANICS[suit][formation].attackFrequencyMultiplier ?? 1
  )

  return {
    damage: baseDamage * multipliers.damage,
    attackIntervalMs: 1000 / (
      baseAttackFrequency
      * multipliers.attackFrequency
      * mechanicFrequencyMultiplier
    ),
    attackRange: baseRange * multipliers.attackRange
  }
}

export function getMahjongFormationMechanics(
  suit: MahjongSuit,
  formation: MahjongFormation
): MahjongCombatMechanics {
  return MAHJONG_FORMATION_MECHANICS[suit][formation]
}

export function createSingleMahjongTowerState(
  tile: MahjongNumberTile,
  originalStats: MahjongRandomStats
): MahjongTowerState {
  return {
    formation: 'single',
    suit: tile.suit,
    ranks: [tile.rank],
    containedTileIds: [tile.id],
    activeSources: [{ tileId: tile.id, originalStats }],
    attachments: []
  }
}
