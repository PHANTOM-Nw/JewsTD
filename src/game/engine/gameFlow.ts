import type { GameStatus } from '../types/game'

export interface MineDamageResult {
  mineHealth: number
  gameStatus: GameStatus
}

export function getStatusAfterPlacement(
  batchTowerCount: number,
  towersPerRound: number
): Pick<{ gameStatus: GameStatus; canPlaceTowers: boolean }, 'gameStatus' | 'canPlaceTowers'> {
  if (batchTowerCount >= towersPerRound) {
    return {
      gameStatus: 'deciding',
      canPlaceTowers: false
    }
  }

  return {
    gameStatus: 'building',
    canPlaceTowers: true
  }
}

export function canFinalizeTowerBatch(
  batchTowerIds: string[],
  keepTowerId: string,
  towersPerRound: number
): boolean {
  return batchTowerIds.length === towersPerRound && batchTowerIds.includes(keepTowerId)
}

export function canStartConfiguredWave(
  gameStatus: GameStatus,
  currentWave: number,
  totalWaves: number,
  hasPath: boolean
): boolean {
  return gameStatus === 'ready' && currentWave < totalWaves && hasPath
}

export function canInspectSynthesisFromTower(gameStatus: GameStatus): boolean {
  return gameStatus === 'building'
    || gameStatus === 'ready'
    || gameStatus === 'playing'
    || gameStatus === 'paused'
}

export function canSynthesizeTowers(gameStatus: GameStatus): boolean {
  return gameStatus === 'building' || gameStatus === 'ready'
}

export function getStatusAfterWave(currentWave: number, totalWaves: number): GameStatus {
  return currentWave >= totalWaves ? 'victory' : 'building'
}

export function getCompletedWaveForNotice(
  gameStatus: GameStatus,
  currentWave: number,
  totalWaves: number
): number | null {
  const isPreparationPhase = gameStatus === 'building'
    || gameStatus === 'deciding'
    || gameStatus === 'resolving_hand'
    || gameStatus === 'ready'

  if (
    !isPreparationPhase
    || currentWave <= 0
    || currentWave >= totalWaves
  ) {
    return null
  }

  return currentWave
}

export function getStateAfterMineDamage(
  currentHealth: number,
  mineDamage: number,
  currentStatus: GameStatus
): MineDamageResult {
  const nextHealth = Math.max(0, currentHealth - Math.max(0, mineDamage))

  return {
    mineHealth: nextHealth,
    gameStatus: nextHealth === 0 ? 'game_over' : currentStatus
  }
}

export function getStateAfterMineDamageBatch(
  currentHealth: number,
  mineDamages: ReadonlyArray<number>,
  currentStatus: GameStatus
): MineDamageResult {
  return mineDamages.reduce<MineDamageResult>((state, mineDamage) => (
    getStateAfterMineDamage(
      state.mineHealth,
      mineDamage,
      state.gameStatus
    )
  ), {
    mineHealth: currentHealth,
    gameStatus: currentStatus
  })
}
