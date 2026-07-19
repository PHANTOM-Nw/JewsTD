// Server-side mirror of src/game/config/scoring.ts. The API artifact is built
// independently from the browser bundle, so scoring.contract.test.ts enforces
// that every versioned value remains identical to the game configuration.
export const SCORING_VERSION = 'v1'

export const KILL_POINTS = {
  basic: 10,
  fast: 20,
  tank: 50,
  boss: 500
} as const

export const SYNTHESIS_POINTS = {
  pair: 100,
  chow: 200,
  pung: 300,
  kong: 400
} as const

export const WAVE_COUNT = 12

export type EnemyType = keyof typeof KILL_POINTS
export type SynthesisFormation = keyof typeof SYNTHESIS_POINTS

export interface ScoreBreakdown {
  killScore: number
  synthesisScore: number
  killsByType: Record<EnemyType, number>
  synthesesByFormation: Record<SynthesisFormation, number>
}

// Cumulative spawn ceilings through each wave. These are intentionally kept
// server-side so a client cannot raise its own admissible score ceiling.
export const MAX_KILLS_THROUGH_WAVE: Record<EnemyType, readonly number[]> = {
  basic: [5, 12, 17, 25, 32, 42, 52, 64, 76, 92, 108, 128],
  fast: [0, 0, 3, 7, 12, 18, 26, 36, 48, 60, 74, 90],
  tank: [0, 0, 0, 0, 2, 5, 9, 13, 18, 24, 32, 41],
  boss: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]
}

export function calculateScore(breakdown: ScoreBreakdown): {
  killScore: number
  synthesisScore: number
  totalScore: number
} {
  const killScore = sumWeighted(breakdown.killsByType, KILL_POINTS)
  const synthesisScore = sumWeighted(
    breakdown.synthesesByFormation,
    SYNTHESIS_POINTS
  )

  return {
    killScore,
    synthesisScore,
    totalScore: killScore + synthesisScore
  }
}

export function validatePlausibleCounts(
  breakdown: ScoreBreakdown,
  wave: number
): string[] {
  const errors: string[] = []
  const waveIndex = wave - 1

  for (const enemyType of Object.keys(KILL_POINTS) as EnemyType[]) {
    if (breakdown.killsByType[enemyType] > MAX_KILLS_THROUGH_WAVE[enemyType][waveIndex]) {
      errors.push(
        `breakdown.killsByType.${enemyType} exceeds the wave ${wave} spawn ceiling`
      )
    }
  }

  const synthesisCount = Object.values(breakdown.synthesesByFormation)
    .reduce((sum, count) => sum + count, 0)
  // A synthesis normally consumes another activated tower or a white catalyst.
  // A pair can additionally become a pung with one matching tile-wall, without
  // consuming either. There is one activation per wave, at most one function
  // draw on each even round, and every pair itself consumes two activations.
  // Adding those three resource ceilings is deliberately generous, but cannot
  // reject a legal chain such as pair -> wall-assisted pung -> white kong.
  const maximumPairCount = Math.floor(wave / 2)
  const maximumWhiteCount = Math.floor(wave / 2)
  const maxSynthesisCount = Math.max(0, wave - 1)
    + maximumPairCount
    + maximumWhiteCount
  if (synthesisCount > maxSynthesisCount) {
    errors.push(
      `breakdown.synthesesByFormation exceeds the wave ${wave} synthesis ceiling`
    )
  }

  return errors
}

function sumWeighted<Key extends string>(
  counts: Record<Key, number>,
  points: Record<Key, number>
): number {
  return (Object.keys(points) as Key[]).reduce(
    (total, key) => total + counts[key] * points[key],
    0
  )
}
