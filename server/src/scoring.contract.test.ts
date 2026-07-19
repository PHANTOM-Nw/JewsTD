import { describe, expect, it } from 'vitest'
import {
  KILL_SCORE_BY_ENEMY_TYPE,
  SCORING_VERSION as GAME_SCORING_VERSION,
  SYNTHESIS_SCORE_BY_FORMATION
} from '../../src/game/config/scoring.js'
import { WAVES } from '../../src/game/config/waves.js'
import {
  KILL_POINTS,
  MAX_KILLS_THROUGH_WAVE,
  SCORING_VERSION as SERVER_SCORING_VERSION,
  SYNTHESIS_POINTS,
  WAVE_COUNT
} from './scoring.js'
import type { EnemyType } from './scoring.js'

describe('leaderboard scoring contract', () => {
  it('mirrors the version and point tables from the game configuration', () => {
    expect(SERVER_SCORING_VERSION).toBe(GAME_SCORING_VERSION)
    expect(KILL_POINTS).toEqual(KILL_SCORE_BY_ENEMY_TYPE)
    expect(SYNTHESIS_POINTS).toEqual(SYNTHESIS_SCORE_BY_FORMATION)
  })

  it('mirrors the configured wave count and cumulative enemy ceilings', () => {
    const cumulative = {
      basic: 0,
      fast: 0,
      tank: 0,
      boss: 0
    }
    const ceilings = {
      basic: [],
      fast: [],
      tank: [],
      boss: []
    } as Record<EnemyType, number[]>

    for (const wave of WAVES) {
      for (const enemy of wave.enemies) {
        cumulative[enemy.type] += enemy.count
      }
      for (const enemyType of Object.keys(cumulative) as EnemyType[]) {
        ceilings[enemyType].push(cumulative[enemyType])
      }
    }

    expect(WAVE_COUNT).toBe(WAVES.length)
    expect(MAX_KILLS_THROUGH_WAVE).toEqual(ceilings)
  })
})
