import type {
  Enemy,
  EnemyType,
  GameStatus,
  ScoreState,
  ScoredMahjongFormation
} from '../types/game'

export interface KillRewardState {
  gameStatus: GameStatus
  gold: number
  score: ScoreState
}

export const SCORING_VERSION = 'v1'

export const KILL_SCORE_BY_ENEMY_TYPE = {
  basic: 10,
  fast: 20,
  tank: 50,
  boss: 500
} as const satisfies Record<EnemyType, number>

export const SYNTHESIS_SCORE_BY_FORMATION = {
  pair: 100,
  chow: 200,
  pung: 300,
  kong: 400
} as const satisfies Record<ScoredMahjongFormation, number>

export const SCORING_CONFIG = {
  scoringVersion: SCORING_VERSION,
  killScores: KILL_SCORE_BY_ENEMY_TYPE,
  synthesisScores: SYNTHESIS_SCORE_BY_FORMATION
} as const

export function createInitialScoreState(): ScoreState {
  return {
    total: 0,
    killScore: 0,
    synthesisScore: 0,
    killsByEnemyType: {
      basic: 0,
      fast: 0,
      tank: 0,
      boss: 0
    },
    synthesesByFormation: {
      pair: 0,
      chow: 0,
      pung: 0,
      kong: 0
    }
  }
}

export function addKillScore(
  score: ScoreState,
  enemyType: EnemyType
): ScoreState {
  const killScore = score.killScore + KILL_SCORE_BY_ENEMY_TYPE[enemyType]
  return {
    ...score,
    total: killScore + score.synthesisScore,
    killScore,
    killsByEnemyType: {
      ...score.killsByEnemyType,
      [enemyType]: score.killsByEnemyType[enemyType] + 1
    }
  }
}

/** Returns the atomic UI ledger update for one already-confirmed first kill. */
export function getStateAfterEnemyKill<T extends KillRewardState>(
  state: T,
  enemy: Pick<Enemy, 'type' | 'reward'>
): T {
  if (state.gameStatus !== 'playing') return state

  return {
    ...state,
    gold: state.gold + enemy.reward,
    score: addKillScore(state.score, enemy.type)
  }
}

export function addSynthesisScore(
  score: ScoreState,
  formation: ScoredMahjongFormation
): ScoreState {
  const synthesisScore = score.synthesisScore
    + SYNTHESIS_SCORE_BY_FORMATION[formation]
  return {
    ...score,
    total: score.killScore + synthesisScore,
    synthesisScore,
    synthesesByFormation: {
      ...score.synthesesByFormation,
      [formation]: score.synthesesByFormation[formation] + 1
    }
  }
}
