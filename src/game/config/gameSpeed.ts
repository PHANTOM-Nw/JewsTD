export const COMBAT_SPEED_OPTIONS = [1, 1.5, 3] as const

export type CombatSpeed = (typeof COMBAT_SPEED_OPTIONS)[number]

export const DEFAULT_COMBAT_SPEED: CombatSpeed = 1

export function getNextCombatSpeed(currentSpeed: CombatSpeed): CombatSpeed {
  const currentIndex = COMBAT_SPEED_OPTIONS.indexOf(currentSpeed)
  return COMBAT_SPEED_OPTIONS[
    (currentIndex + 1) % COMBAT_SPEED_OPTIONS.length
  ] ?? DEFAULT_COMBAT_SPEED
}

/** Scales elapsed time for an active battle frame without allowing time reversal. */
export function scaleCombatDeltaTime(
  deltaTimeMs: number,
  combatSpeed: CombatSpeed
): number {
  return Math.max(0, deltaTimeMs) * combatSpeed
}
