import type { MahjongTargetEffectState } from './mahjongAttack'

export interface MahjongRuntimeEffectAdvance {
  effects: MahjongTargetEffectState
  poisonDamage: number
  burnDamage: number
}

function activeDurationMs(
  expiresAtMs: number,
  nowMs: number,
  deltaTimeMs: number
): number {
  const elapsed = Math.max(0, deltaTimeMs)
  const frameStart = nowMs - elapsed
  return Math.max(0, Math.min(nowMs, expiresAtMs) - frameStart)
}

/** Advances absolute-time Mahjong effects over one unpaused engine frame. */
export function advanceMahjongRuntimeEffects(
  effects: MahjongTargetEffectState,
  nowMs: number,
  deltaTimeMs: number
): MahjongRuntimeEffectAdvance {
  const poisonDamage = effects.poisons.reduce((total, poison) => (
    total + poison.damagePerSecond
      * poison.stacks
      * activeDurationMs(poison.expiresAtMs, nowMs, deltaTimeMs)
      / 1000
  ), 0)
  const burnDamage = effects.burn
    ? effects.burn.damagePerSecond
      * activeDurationMs(effects.burn.expiresAtMs, nowMs, deltaTimeMs)
      / 1000
    : 0

  return {
    poisonDamage,
    burnDamage,
    effects: {
      poisons: effects.poisons
        .filter(poison => poison.expiresAtMs > nowMs)
        .map(poison => ({ ...poison })),
      burn: effects.burn?.expiresAtMs && effects.burn.expiresAtMs > nowMs
        ? { ...effects.burn }
        : null,
      slow: effects.slow?.expiresAtMs && effects.slow.expiresAtMs > nowMs
        ? { ...effects.slow }
        : null,
      stun: effects.stun?.expiresAtMs && effects.stun.expiresAtMs > nowMs
        ? { ...effects.stun }
        : null
    }
  }
}

export function hasMahjongRuntimeEffects(effects: MahjongTargetEffectState): boolean {
  return effects.poisons.length > 0
    || effects.burn !== null
    || effects.slow !== null
    || effects.stun !== null
}
