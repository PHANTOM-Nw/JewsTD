import type {
  DamageNumber,
  DamageNumberType,
  Position
} from '../types/game'

const NORMAL_DURATION_MS = 720
const CRITICAL_DURATION_MS = 820
const HORIZONTAL_LANES = [-5, 0, 5] as const

interface CreateDamageNumberOptions {
  sequence: number
  position: Position
  amount: number
  damageType: DamageNumberType
  critical?: boolean
}

export function createDamageNumber({
  sequence,
  position,
  amount,
  damageType,
  critical = false
}: CreateDamageNumberOptions): DamageNumber {
  const laneIndex = Math.abs(sequence) % HORIZONTAL_LANES.length

  return {
    id: `damage_${sequence}`,
    position: { ...position },
    amount: Math.max(1, Math.round(amount)),
    damageType,
    critical,
    elapsedMs: 0,
    durationMs: critical ? CRITICAL_DURATION_MS : NORMAL_DURATION_MS,
    horizontalOffset: HORIZONTAL_LANES[laneIndex]
  }
}

export function advanceDamageNumbers(
  damageNumbers: DamageNumber[],
  deltaTime: number
): DamageNumber[] {
  const elapsedTime = Math.max(0, deltaTime)

  return damageNumbers
    .map(damageNumber => ({
      ...damageNumber,
      elapsedMs: Math.min(
        damageNumber.durationMs,
        damageNumber.elapsedMs + elapsedTime
      )
    }))
    .filter(damageNumber => damageNumber.elapsedMs < damageNumber.durationMs)
}
