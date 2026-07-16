import type {
  EnemyType,
  MahjongFormation,
  MahjongSuit,
  MahjongTowerState
} from '../types/game'
import {
  MAHJONG_FORMATION_MECHANICS,
  MAHJONG_GREEN_ATTACHMENT_CONFIG,
  MAHJONG_RED_ATTACHMENT_CONFIG,
  MAHJONG_SUIT_COMBAT_CONFIG
} from '../config/mahjong'

export type MahjongAttackDamageType = 'physical' | 'magic'

export interface MahjongCriticalMechanic {
  chance: number
  multiplier: number
  armorIgnore: number
}

export interface MahjongPoisonMechanic {
  damagePerSecond: number
  durationMs: number
  maxStacks: number
}

export interface MahjongSlowMechanic {
  amount: number
  durationMs: number
}

export interface MahjongSplashMechanic {
  radius: number
  damageMultiplier: number
}

export interface MahjongRedMechanic {
  damageMultiplier: number
  criticalChanceBonus: number
  criticalMultiplier: number
  burnDamagePerSecond: number
  burnDurationMs: number
}

export interface MahjongExecuteMechanic {
  normalThreshold: number
  bossThreshold: number
}

export interface MahjongFocusFireMechanic {
  attackFrequencyPerStack: number
  maxStacks: number
  resetAfterMs: number
}

export interface MahjongStunMechanic {
  chance: number
  normalDurationMs: number
  bossDurationMs: number
}

/**
 * A combat-only projection of configuration and MahjongTowerState.
 * The configuration layer owns all numbers; this module only applies them.
 */
export interface MahjongAttackProfile {
  sourceId: string
  suit: MahjongSuit
  formation: MahjongFormation
  attachments: MahjongTowerState['attachments']
  damage: number
  damageType: MahjongAttackDamageType
  critical?: MahjongCriticalMechanic
  poison?: MahjongPoisonMechanic
  slow?: MahjongSlowMechanic
  splash?: MahjongSplashMechanic
  projectileCount?: number
  maxTargets?: number
  red?: MahjongRedMechanic
  execute?: MahjongExecuteMechanic
  focusFire?: MahjongFocusFireMechanic
  stun?: MahjongStunMechanic
}

/** Converts shared Mahjong configuration into the snapshot used by one attack. */
export function createMahjongAttackProfile(
  sourceId: string,
  tower: Pick<MahjongTowerState, 'suit' | 'formation' | 'attachments'>,
  /** Final formation damage from calculateMahjongFormationStats, before 中. */
  damage: number
): MahjongAttackProfile {
  const mechanics = MAHJONG_FORMATION_MECHANICS[tower.suit][tower.formation]
  const hasRed = tower.attachments.includes('red')
  const hasGreen = tower.attachments.includes('green')

  return {
    sourceId,
    suit: tower.suit,
    formation: tower.formation,
    attachments: [...tower.attachments],
    damage,
    damageType: MAHJONG_SUIT_COMBAT_CONFIG[tower.suit].damageType,
    critical: mechanics.crit
      ? {
          ...mechanics.crit,
          armorIgnore: mechanics.armorIgnoreRatio ?? 0
        }
      : mechanics.armorIgnoreRatio !== undefined
        ? {
            chance: 0,
            multiplier: MAHJONG_RED_ATTACHMENT_CONFIG.defaultCritMultiplier,
            armorIgnore: mechanics.armorIgnoreRatio
          }
        : undefined,
    poison: mechanics.poison ? { ...mechanics.poison } : undefined,
    slow: mechanics.slow
      ? { amount: mechanics.slow.ratio, durationMs: mechanics.slow.durationMs }
      : undefined,
    splash: mechanics.splash
      ? {
          radius: mechanics.splash.radius,
          damageMultiplier: mechanics.splash.damageRatio
        }
      : undefined,
    projectileCount: mechanics.projectileCount,
    maxTargets: mechanics.maxTargets,
    red: hasRed
      ? {
          damageMultiplier: MAHJONG_RED_ATTACHMENT_CONFIG.damageMultiplier,
          criticalChanceBonus: MAHJONG_RED_ATTACHMENT_CONFIG.critChanceBonus,
          criticalMultiplier: MAHJONG_RED_ATTACHMENT_CONFIG.defaultCritMultiplier,
          burnDamagePerSecond: MAHJONG_RED_ATTACHMENT_CONFIG.burn.damagePerSecond,
          burnDurationMs: MAHJONG_RED_ATTACHMENT_CONFIG.burn.durationMs
        }
      : undefined,
    execute: hasGreen && tower.suit === 'characters'
      ? {
          normalThreshold: MAHJONG_GREEN_ATTACHMENT_CONFIG.characters.executeHealthRatio,
          bossThreshold: MAHJONG_GREEN_ATTACHMENT_CONFIG.characters.bossExecuteHealthRatio
        }
      : undefined,
    focusFire: hasGreen && tower.suit === 'bamboo'
      ? {
          attackFrequencyPerStack: MAHJONG_GREEN_ATTACHMENT_CONFIG.bamboo.attackFrequencyBonusPerHit,
          maxStacks: MAHJONG_GREEN_ATTACHMENT_CONFIG.bamboo.maxStacks,
          resetAfterMs: MAHJONG_GREEN_ATTACHMENT_CONFIG.bamboo.resetAfterMs
        }
      : undefined,
    stun: hasGreen && tower.suit === 'dots'
      ? {
          chance: MAHJONG_GREEN_ATTACHMENT_CONFIG.dots.stunChance,
          normalDurationMs: MAHJONG_GREEN_ATTACHMENT_CONFIG.dots.stunDurationMs,
          bossDurationMs: MAHJONG_GREEN_ATTACHMENT_CONFIG.dots.bossStunDurationMs
        }
      : undefined
  }
}

export interface BambooFocusState {
  targetId: string
  stacks: number
  lastHitAtMs: number
}

export interface CreateAttackPlanInput {
  cycleId: string
  profile: MahjongAttackProfile
  targetIds: readonly string[]
  nowMs: number
  bambooFocus?: BambooFocusState | null
}

export interface MahjongAttackHitPlan {
  effectKey: string
  sourceId: string
  targetId: string
  isPrimaryTarget: boolean
  projectileCount: number
  rawDamage: number
  damageType: MahjongAttackDamageType
  criticalChance: number
  criticalMultiplier: number
  armorIgnore: number
  poison?: MahjongPoisonMechanic
  slow?: MahjongSlowMechanic
  splash?: MahjongSplashMechanic
  burn?: {
    damagePerSecond: number
    durationMs: number
  }
  execute?: MahjongExecuteMechanic
  focusFire?: MahjongFocusFireMechanic
  stun?: MahjongStunMechanic
}

export interface MahjongAttackPlan {
  cycleId: string
  sourceId: string
  attackFrequencyMultiplier: number
  hits: MahjongAttackHitPlan[]
}

export interface MahjongPoisonState {
  sourceId: string
  damagePerSecond: number
  stacks: number
  maxStacks: number
  expiresAtMs: number
}

export interface MahjongBurnState {
  sourceId: string
  damagePerSecond: number
  expiresAtMs: number
}

export interface MahjongSlowState {
  amount: number
  expiresAtMs: number
}

export interface MahjongStunState {
  expiresAtMs: number
}

export interface MahjongTargetEffectState {
  poisons: readonly MahjongPoisonState[]
  burn: MahjongBurnState | null
  slow: MahjongSlowState | null
  stun: MahjongStunState | null
}

export interface MahjongAttackTarget {
  id: string
  type: EnemyType
  health: number
  maxHealth: number
  armor: number
  magicResist: number
}

export interface ResolveHitEffectsInput {
  hit: MahjongAttackHitPlan
  target: MahjongAttackTarget
  targetEffects?: MahjongTargetEffectState
  bambooFocus?: BambooFocusState | null
  nowMs: number
  random: () => number
}

export interface ResolvedMahjongHit {
  targetId: string
  damage: number
  critical: boolean
  executed: boolean
  armorIgnore: number
  targetEffects: MahjongTargetEffectState
  bambooFocus: BambooFocusState | null
  splash: {
    radius: number
    damageMultiplier: number
    rawDamage: number
    damageType: MahjongAttackDamageType
  } | null
}

export const EMPTY_MAHJONG_TARGET_EFFECTS: MahjongTargetEffectState = {
  poisons: [],
  burn: null,
  slow: null,
  stun: null
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, maximum))
}

function uniqueTargetIds(targetIds: readonly string[]): string[] {
  return targetIds.filter((targetId, index) => (
    targetIds.indexOf(targetId) === index
  ))
}

function hasAttachment(
  attachments: MahjongTowerState['attachments'],
  attachment: 'red' | 'green'
) {
  return attachments.includes(attachment)
}

function getFocusFrequencyMultiplier(
  profile: MahjongAttackProfile,
  targetId: string | undefined,
  focus: BambooFocusState | null | undefined,
  nowMs: number
) {
  if (
    !targetId
    || profile.suit !== 'bamboo'
    || !hasAttachment(profile.attachments, 'green')
    || !profile.focusFire
    || !focus
    || focus.targetId !== targetId
    || nowMs - focus.lastHitAtMs >= profile.focusFire.resetAfterMs
  ) {
    return 1
  }

  return 1 + clamp(
    focus.stacks,
    0,
    profile.focusFire.maxStacks
  ) * profile.focusFire.attackFrequencyPerStack
}

/**
 * Creates semantic hits for one attack cycle. A chow always has three visual
 * projectiles, while each actual target receives exactly one effects resolution.
 */
export function createAttackPlan({
  cycleId,
  profile,
  targetIds,
  nowMs,
  bambooFocus = null
}: CreateAttackPlanInput): MahjongAttackPlan {
  const uniqueTargets = uniqueTargetIds(targetIds)
  const selectedTargets = profile.formation === 'chow'
    ? uniqueTargets.slice(0, Math.max(1, Math.floor(profile.maxTargets ?? 1)))
    : uniqueTargets.slice(0, 1)
  const redAttached = hasAttachment(profile.attachments, 'red')
    ? profile.red
    : undefined
  const greenAttached = hasAttachment(profile.attachments, 'green')
  const totalRawDamage = Math.max(0, profile.damage) * (
    redAttached ? Math.max(0, redAttached.damageMultiplier) : 1
  )
  const damagePerTarget = selectedTargets.length > 0
    ? totalRawDamage / selectedTargets.length
    : 0
  const baseCritical = profile.critical ?? {
    chance: 0,
    multiplier: 2,
    armorIgnore: 0
  }
  const criticalChance = clamp(
    baseCritical.chance + (redAttached?.criticalChanceBonus ?? 0),
    0,
    1
  )
  const criticalMultiplier = baseCritical.chance > 0
    ? Math.max(1, baseCritical.multiplier)
    : redAttached
      ? Math.max(1, redAttached.criticalMultiplier)
      : Math.max(1, baseCritical.multiplier)

  return {
    cycleId,
    sourceId: profile.sourceId,
    attackFrequencyMultiplier: getFocusFrequencyMultiplier(
      profile,
      selectedTargets[0],
      bambooFocus,
      nowMs
    ),
    hits: selectedTargets.map((targetId, index) => ({
      effectKey: `${cycleId}:${targetId}`,
      sourceId: profile.sourceId,
      targetId,
      isPrimaryTarget: index === 0,
      projectileCount: profile.formation === 'chow'
        ? Math.floor(Math.max(1, profile.projectileCount ?? 1) / selectedTargets.length)
          + (index < Math.max(1, profile.projectileCount ?? 1) % selectedTargets.length ? 1 : 0)
        : 1,
      rawDamage: damagePerTarget,
      damageType: profile.damageType,
      criticalChance,
      criticalMultiplier,
      armorIgnore: clamp(baseCritical.armorIgnore, 0, 1),
      poison: profile.poison,
      slow: profile.slow,
      splash: profile.splash,
      burn: redAttached
        ? {
            damagePerSecond: redAttached.burnDamagePerSecond,
            durationMs: redAttached.burnDurationMs
          }
        : undefined,
      execute: greenAttached && profile.suit === 'characters'
        ? profile.execute
        : undefined,
      focusFire: greenAttached && profile.suit === 'bamboo'
        ? profile.focusFire
        : undefined,
      stun: greenAttached && profile.suit === 'dots'
        ? profile.stun
        : undefined
    }))
  }
}

function resolveDirectDamage(
  hit: MahjongAttackHitPlan,
  target: MahjongAttackTarget,
  randomValue: number
) {
  const critical = hit.criticalChance > 0 && randomValue < hit.criticalChance
  let damage = hit.rawDamage * (critical ? hit.criticalMultiplier : 1)

  if (hit.damageType === 'physical') {
    const effectiveArmor = Math.max(0, target.armor) * (1 - hit.armorIgnore)
    damage *= 1 - effectiveArmor / (effectiveArmor + 10)
  } else {
    damage *= 1 - clamp(target.magicResist, 0, 1)
  }

  return { damage: Math.max(0, damage), critical }
}

function updatePoisonEffects(
  effects: readonly MahjongPoisonState[],
  hit: MahjongAttackHitPlan,
  nowMs: number
) {
  const activeEffects = effects.filter(effect => effect.expiresAtMs > nowMs)
  if (!hit.poison) return activeEffects.map(effect => ({ ...effect }))

  const existing = activeEffects.find(effect => effect.sourceId === hit.sourceId)
  const maxStacks = Math.max(1, Math.floor(hit.poison.maxStacks))
  const nextEffect: MahjongPoisonState = {
    sourceId: hit.sourceId,
    damagePerSecond: Math.max(0, hit.poison.damagePerSecond),
    stacks: Math.min(maxStacks, (existing?.stacks ?? 0) + 1),
    maxStacks,
    expiresAtMs: nowMs + Math.max(0, hit.poison.durationMs)
  }

  return [
    ...activeEffects
      .filter(effect => effect.sourceId !== hit.sourceId)
      .map(effect => ({ ...effect })),
    nextEffect
  ]
}

function updateSlowEffect(
  current: MahjongSlowState | null,
  incoming: MahjongSlowMechanic | undefined,
  nowMs: number
): MahjongSlowState | null {
  const active = current && current.expiresAtMs > nowMs ? current : null
  if (!incoming) return active ? { ...active } : null

  return {
    amount: Math.max(active?.amount ?? 0, clamp(incoming.amount, 0, 1)),
    expiresAtMs: Math.max(
      active?.expiresAtMs ?? nowMs,
      nowMs + Math.max(0, incoming.durationMs)
    )
  }
}

function updateBambooFocus(
  current: BambooFocusState | null | undefined,
  hit: MahjongAttackHitPlan,
  nowMs: number
): BambooFocusState | null {
  if (!hit.focusFire || !hit.isPrimaryTarget) {
    return current ? { ...current } : null
  }

  const continuesFocus = current?.targetId === hit.targetId
    && nowMs - current.lastHitAtMs < hit.focusFire.resetAfterMs
  const stacks = continuesFocus ? current.stacks + 1 : 1

  return {
    targetId: hit.targetId,
    stacks: Math.min(hit.focusFire.maxStacks, Math.max(1, stacks)),
    lastHitAtMs: nowMs
  }
}

/** Resolves one semantic hit. Visual sub-projectiles must not call this again. */
export function resolveHitEffects({
  hit,
  target,
  targetEffects = EMPTY_MAHJONG_TARGET_EFFECTS,
  bambooFocus = null,
  nowMs,
  random
}: ResolveHitEffectsInput): ResolvedMahjongHit {
  const damageResult = resolveDirectDamage(
    hit,
    target,
    hit.criticalChance > 0 ? random() : 1
  )
  const executeThreshold = target.type === 'boss'
    ? hit.execute?.bossThreshold
    : hit.execute?.normalThreshold
  const healthAfterDamage = Math.max(0, target.health - damageResult.damage)
  const executed = executeThreshold !== undefined
    && target.maxHealth > 0
    && healthAfterDamage > 0
    && healthAfterDamage / target.maxHealth < clamp(executeThreshold, 0, 1)
  const damage = executed ? Math.max(0, target.health) : damageResult.damage
  const activeBurn = targetEffects.burn && targetEffects.burn.expiresAtMs > nowMs
    ? targetEffects.burn
    : null
  const burn = hit.burn
    ? {
        sourceId: hit.sourceId,
        damagePerSecond: Math.max(0, hit.burn.damagePerSecond),
        expiresAtMs: nowMs + Math.max(0, hit.burn.durationMs)
      }
    : activeBurn
      ? { ...activeBurn }
      : null
  const activeStun = targetEffects.stun && targetEffects.stun.expiresAtMs > nowMs
    ? targetEffects.stun
    : null
  const stunTriggered = hit.stun
    ? random() < clamp(hit.stun.chance, 0, 1)
    : false
  const stunDuration = target.type === 'boss'
    ? hit.stun?.bossDurationMs
    : hit.stun?.normalDurationMs
  const stun = stunTriggered && stunDuration !== undefined
    ? {
        expiresAtMs: Math.max(
          activeStun?.expiresAtMs ?? nowMs,
          nowMs + Math.max(0, stunDuration)
        )
      }
    : activeStun
      ? { ...activeStun }
      : null

  return {
    targetId: target.id,
    damage,
    critical: damageResult.critical,
    executed,
    armorIgnore: hit.armorIgnore,
    targetEffects: {
      poisons: updatePoisonEffects(targetEffects.poisons, hit, nowMs),
      burn,
      slow: updateSlowEffect(targetEffects.slow, hit.slow, nowMs),
      stun
    },
    bambooFocus: updateBambooFocus(bambooFocus, hit, nowMs),
    splash: hit.splash
      ? {
          radius: Math.max(0, hit.splash.radius),
          damageMultiplier: Math.max(0, hit.splash.damageMultiplier),
          rawDamage: hit.rawDamage
            * (damageResult.critical ? hit.criticalMultiplier : 1)
            * Math.max(0, hit.splash.damageMultiplier),
          damageType: hit.damageType
        }
      : null
  }
}
