import { describe, expect, it } from 'vitest'
import type { EnemyType, ScoredMahjongFormation } from '../types/game'
import {
  KILL_SCORE_BY_ENEMY_TYPE,
  SCORING_CONFIG,
  SCORING_VERSION,
  SYNTHESIS_SCORE_BY_FORMATION,
  addKillScore,
  addSynthesisScore,
  createInitialScoreState,
  getStateAfterEnemyKill
} from './scoring'

describe('scoring configuration', () => {
  it('uses versioned scores that are independent from enemy gold rewards', () => {
    expect(SCORING_VERSION).toBe('v1')
    expect(SCORING_CONFIG.scoringVersion).toBe('v1')
    expect(KILL_SCORE_BY_ENEMY_TYPE).toEqual({
      basic: 10,
      fast: 20,
      tank: 50,
      boss: 500
    })
    expect(SYNTHESIS_SCORE_BY_FORMATION).toEqual({
      pair: 100,
      chow: 200,
      pung: 300,
      kong: 400
    })
  })

  it('creates an isolated zeroed score ledger for a new or restarted game', () => {
    const first = createInitialScoreState()
    const second = createInitialScoreState()

    expect(first).toEqual({
      total: 0,
      killScore: 0,
      synthesisScore: 0,
      killsByEnemyType: { basic: 0, fast: 0, tank: 0, boss: 0 },
      synthesesByFormation: { pair: 0, chow: 0, pung: 0, kong: 0 }
    })
    expect(first).not.toBe(second)
    expect(first.killsByEnemyType).not.toBe(second.killsByEnemyType)
    expect(first.synthesesByFormation).not.toBe(second.synthesesByFormation)
  })
})

describe('score ledger updates', () => {
  it('awards every first-kill category and tracks its count without mutating input', () => {
    const initial = createInitialScoreState()
    const enemyTypes: EnemyType[] = ['basic', 'fast', 'tank', 'boss']
    const result = enemyTypes.reduce(addKillScore, initial)

    expect(result).toMatchObject({
      total: 580,
      killScore: 580,
      synthesisScore: 0,
      killsByEnemyType: { basic: 1, fast: 1, tank: 1, boss: 1 }
    })
    expect(initial).toEqual(createInitialScoreState())
  })

  it('accumulates each committed synthesis result, including successive upgrades', () => {
    const upgradeRoute: ScoredMahjongFormation[] = ['pair', 'pung', 'kong']
    const upgraded = upgradeRoute.reduce(addSynthesisScore, createInitialScoreState())
    const withChow = addSynthesisScore(upgraded, 'chow')

    expect(upgraded).toMatchObject({
      total: 800,
      killScore: 0,
      synthesisScore: 800,
      synthesesByFormation: { pair: 1, chow: 0, pung: 1, kong: 1 }
    })
    expect(withChow).toMatchObject({
      total: 1000,
      synthesisScore: 1000,
      synthesesByFormation: { pair: 1, chow: 1, pung: 1, kong: 1 }
    })
  })

  it('keeps the total equal to kill and synthesis subtotals', () => {
    const afterKill = addKillScore(createInitialScoreState(), 'tank')
    const result = addSynthesisScore(afterKill, 'pung')

    expect(result).toMatchObject({
      total: 350,
      killScore: 50,
      synthesisScore: 300
    })
  })

  it.each([
    ['basic', 5, 10],
    ['fast', 7, 20],
    ['tank', 15, 50],
    ['boss', 75, 500]
  ] as const)(
    'atomically awards %s kill gold and score while playing',
    (type, goldReward, scoreReward) => {
      const initial = {
        gameStatus: 'playing' as const,
        gold: 50,
        score: createInitialScoreState(),
        retainedField: 'unchanged'
      }

      const result = getStateAfterEnemyKill(initial, {
        type,
        reward: goldReward
      })

      expect(result).toMatchObject({
        gameStatus: 'playing',
        gold: 50 + goldReward,
        retainedField: 'unchanged',
        score: {
          total: scoreReward,
          killScore: scoreReward,
          synthesisScore: 0,
          killsByEnemyType: { [type]: 1 }
        }
      })
      expect(initial).toMatchObject({
        gold: 50,
        score: { total: 0, killScore: 0 }
      })
    }
  )

  it.each(['game_over', 'victory'] as const)(
    'freezes gold and score during %s',
    gameStatus => {
      const terminal = {
        gameStatus,
        gold: 125,
        score: addKillScore(createInitialScoreState(), 'fast')
      }

      const result = getStateAfterEnemyKill(terminal, {
        type: 'boss',
        reward: 75
      })

      expect(result).toBe(terminal)
      expect(result).toEqual(terminal)
    }
  )

  it('accumulates consecutive confirmed kills without reusing nested state', () => {
    const initial = {
      gameStatus: 'playing' as const,
      gold: 0,
      score: createInitialScoreState()
    }
    const first = getStateAfterEnemyKill(initial, {
      type: 'basic',
      reward: 5
    })
    const second = getStateAfterEnemyKill(first, {
      type: 'basic',
      reward: 5
    })

    expect(second).toMatchObject({
      gold: 10,
      score: {
        total: 20,
        killScore: 20,
        killsByEnemyType: { basic: 2 }
      }
    })
    expect(first.score.killsByEnemyType.basic).toBe(1)
    expect(second.score).not.toBe(first.score)
    expect(second.score.killsByEnemyType).not.toBe(first.score.killsByEnemyType)
  })
})
