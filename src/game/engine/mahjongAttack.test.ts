import { describe, expect, it, vi } from 'vitest'
import type {
  EnemyType,
  MahjongAttachment,
  MahjongFormation,
  MahjongSuit,
  MahjongTowerState
} from '../types/game'
import {
  EMPTY_MAHJONG_TARGET_EFFECTS,
  createAttackPlan,
  createMahjongAttackProfile,
  resolveHitEffects
} from './mahjongAttack'
import type {
  BambooFocusState,
  MahjongAttackPlan,
  MahjongAttackTarget,
  MahjongTargetEffectState
} from './mahjongAttack'

function createTowerState(
  suit: MahjongSuit,
  formation: MahjongFormation = 'single',
  attachments: MahjongAttachment[] = []
): Pick<MahjongTowerState, 'suit' | 'formation' | 'attachments'> {
  return { suit, formation, attachments }
}

function createPlan(
  suit: MahjongSuit,
  formation: MahjongFormation,
  targetIds: readonly string[],
  attachments: MahjongAttachment[] = [],
  damage = 100,
  bambooFocus: BambooFocusState | null = null,
  nowMs = 0
): MahjongAttackPlan {
  return createAttackPlan({
    cycleId: 'cycle-1',
    profile: createMahjongAttackProfile(
      'tower-1',
      createTowerState(suit, formation, attachments),
      damage
    ),
    targetIds,
    bambooFocus,
    nowMs
  })
}

function createTarget(
  overrides: Partial<MahjongAttackTarget> = {}
): MahjongAttackTarget {
  return {
    id: 'enemy-1',
    type: 'basic',
    health: 100,
    maxHealth: 100,
    armor: 0,
    magicResist: 0,
    ...overrides
  }
}

function resolveFirstHit(
  plan: MahjongAttackPlan,
  target: MahjongAttackTarget = createTarget(),
  targetEffects: MahjongTargetEffectState = EMPTY_MAHJONG_TARGET_EFFECTS,
  bambooFocus: BambooFocusState | null = null,
  nowMs = 0,
  random: () => number = () => 1
) {
  return resolveHitEffects({
    hit: plan.hits[0],
    target,
    targetEffects,
    bambooFocus,
    nowMs,
    random
  })
}

describe('Mahjong character attacks', () => {
  it('uses the configured critical chance and multiplier for single, pung and kong forms', () => {
    const single = createPlan('characters', 'single', ['enemy'])
    const pung = createPlan('characters', 'pung', ['enemy'])
    const kong = createPlan('characters', 'kong', ['enemy'])

    expect(single.hits[0]).toMatchObject({
      criticalChance: .15,
      criticalMultiplier: 2,
      armorIgnore: 0
    })
    expect(pung.hits[0]).toMatchObject({
      criticalChance: .3,
      criticalMultiplier: 2.5,
      armorIgnore: .45
    })
    expect(kong.hits[0]).toMatchObject({
      criticalChance: .4,
      criticalMultiplier: 3,
      armorIgnore: .65
    })
    expect(resolveFirstHit(single, createTarget(), undefined, null, 0, () => .1)).toMatchObject({
      critical: true,
      damage: 200
    })
  })

  it('applies pair armor ignore before physical mitigation', () => {
    const pair = createPlan('characters', 'pair', ['enemy'])
    const result = resolveFirstHit(pair, createTarget({ armor: 10 }))

    expect(result.armorIgnore).toBe(.25)
    expect(result.damage).toBeCloseTo(100 * (1 - 7.5 / 17.5))
  })
})

describe('Mahjong bamboo poison', () => {
  it('refreshes a normal poison without stacking', () => {
    const plan = createPlan('bamboo', 'single', ['enemy'])
    const first = resolveFirstHit(plan, createTarget(), undefined, null, 100)
    const second = resolveFirstHit(plan, createTarget(), first.targetEffects, null, 900)

    expect(first.targetEffects.poisons).toEqual([{
      sourceId: 'tower-1',
      damagePerSecond: 4,
      stacks: 1,
      maxStacks: 1,
      expiresAtMs: 3100
    }])
    expect(second.targetEffects.poisons[0]).toMatchObject({
      stacks: 1,
      expiresAtMs: 3900
    })
  })

  it.each([
    ['pung', 7, 4000, 3],
    ['kong', 12, 5000, 4]
  ] as const)('caps %s poison at its configured stack limit', (
    formation,
    damagePerSecond,
    durationMs,
    maxStacks
  ) => {
    const plan = createPlan('bamboo', formation, ['enemy'])
    let effects = EMPTY_MAHJONG_TARGET_EFFECTS

    for (let hit = 0; hit < maxStacks + 2; hit += 1) {
      effects = resolveFirstHit(
        plan,
        createTarget(),
        effects,
        null,
        hit * 100
      ).targetEffects
    }

    expect(effects.poisons[0]).toMatchObject({
      damagePerSecond,
      stacks: maxStacks,
      maxStacks,
      expiresAtMs: (maxStacks + 1) * 100 + durationMs
    })
  })

  it('keeps poison effects from different source towers independent', () => {
    const firstPlan = createPlan('bamboo', 'pung', ['enemy'])
    const secondProfile = createMahjongAttackProfile(
      'tower-2',
      createTowerState('bamboo', 'pung'),
      100
    )
    const secondPlan = createAttackPlan({
      cycleId: 'cycle-2',
      profile: secondProfile,
      targetIds: ['enemy'],
      nowMs: 0
    })
    const first = resolveFirstHit(firstPlan)
    const second = resolveFirstHit(secondPlan, createTarget(), first.targetEffects)

    expect(second.targetEffects.poisons.map(effect => effect.sourceId)).toEqual([
      'tower-1',
      'tower-2'
    ])
  })
})

describe('Mahjong dot control', () => {
  it.each([
    ['single', .25, 1500, null, null],
    ['pair', .25, 1500, 32, .7],
    ['pung', .4, 2000, 40, .8],
    ['kong', .55, 2500, 55, 1]
  ] as const)('applies configured slow and splash for %s', (
    formation,
    slowAmount,
    slowDuration,
    splashRadius,
    splashMultiplier
  ) => {
    const plan = createPlan('dots', formation, ['enemy'])
    const result = resolveFirstHit(plan, createTarget(), undefined, null, 200)

    expect(result.targetEffects.slow).toEqual({
      amount: slowAmount,
      expiresAtMs: 200 + slowDuration
    })
    if (splashRadius === null) {
      expect(result.splash).toBeNull()
    } else {
      expect(result.splash).toEqual({
        radius: splashRadius,
        damageMultiplier: splashMultiplier,
        rawDamage: 100 * splashMultiplier,
        damageType: 'magic'
      })
    }
  })
})

describe('Mahjong chow attack planning', () => {
  it('targets at most three unique enemies and preserves the total raw damage budget', () => {
    const plan = createPlan('characters', 'chow', ['first', 'second', 'first', 'third', 'fourth'], [], 120)

    expect(plan.hits.map(hit => hit.targetId)).toEqual(['first', 'second', 'third'])
    expect(plan.hits.map(hit => hit.projectileCount)).toEqual([1, 1, 1])
    expect(plan.hits.reduce((total, hit) => total + hit.rawDamage, 0)).toBe(120)
    expect(new Set(plan.hits.map(hit => hit.effectKey)).size).toBe(3)
  })

  it('uses three visual projectiles but resolves effects once against one target', () => {
    const plan = createPlan('bamboo', 'chow', ['only-target'])
    const result = resolveFirstHit(plan)

    expect(plan.hits).toHaveLength(1)
    expect(plan.hits[0]).toMatchObject({ projectileCount: 3, rawDamage: 100 })
    expect(result.targetEffects.poisons[0].stacks).toBe(1)
  })

  it('splits three visual projectiles as two plus one for two targets', () => {
    const plan = createPlan('dots', 'chow', ['first', 'second'])

    expect(plan.hits.map(hit => hit.projectileCount)).toEqual([2, 1])
    expect(plan.hits.map(hit => hit.rawDamage)).toEqual([50, 50])
  })
})

describe('red attachment', () => {
  it('adds damage, a default critical hit and a refreshing non-stacking burn', () => {
    const plan = createPlan('bamboo', 'single', ['enemy'], ['red'], 100)
    const random = vi.fn(() => .05)
    const first = resolveFirstHit(plan, createTarget(), undefined, null, 100, random)
    const second = resolveFirstHit(plan, createTarget(), first.targetEffects, null, 1000, random)

    expect(plan.hits[0]).toMatchObject({
      rawDamage: 125,
      criticalChance: .1,
      criticalMultiplier: 2,
      burn: { damagePerSecond: 6, durationMs: 3000 }
    })
    expect(first).toMatchObject({ critical: true, damage: 250 })
    expect(second.targetEffects.burn).toEqual({
      sourceId: 'tower-1',
      damagePerSecond: 6,
      expiresAtMs: 4000
    })
  })

  it('adds critical chance without replacing an existing character multiplier', () => {
    const plan = createPlan('characters', 'pung', ['enemy'], ['red'])

    expect(plan.hits[0]).toMatchObject({
      rawDamage: 125,
      criticalChance: .4,
      criticalMultiplier: 2.5
    })
  })
})

describe('green attachment', () => {
  it.each<[EnemyType, number, number, boolean]>([
    ['basic', 13, 2, true],
    ['basic', 13, 1, false],
    ['boss', 6, 2, true]
  ])('executes a %s only after damage leaves it strictly below the threshold', (
    type,
    health,
    attackDamage,
    expectedExecution
  ) => {
    const plan = createPlan('characters', 'single', ['enemy'], ['green'], attackDamage)
    const result = resolveFirstHit(plan, createTarget({ type, health }))

    expect(result.executed).toBe(expectedExecution)
    expect(result.damage).toBe(expectedExecution ? health : attackDamage)
  })

  it('grows bamboo focus on the same target and resets on switching or after two seconds', () => {
    const firstPlan = createPlan('bamboo', 'single', ['first'], ['green'], 100, null, 100)
    const firstHit = resolveFirstHit(firstPlan, createTarget({ id: 'first' }), undefined, null, 100)
    const secondPlan = createPlan('bamboo', 'single', ['first'], ['green'], 100, firstHit.bambooFocus, 1000)
    const secondHit = resolveFirstHit(
      secondPlan,
      createTarget({ id: 'first' }),
      undefined,
      firstHit.bambooFocus,
      1000
    )
    const switchedPlan = createPlan('bamboo', 'single', ['second'], ['green'], 100, secondHit.bambooFocus, 1200)
    const switchedHit = resolveFirstHit(
      switchedPlan,
      createTarget({ id: 'second' }),
      undefined,
      secondHit.bambooFocus,
      1200
    )
    const expiredPlan = createPlan('bamboo', 'single', ['second'], ['green'], 100, switchedHit.bambooFocus, 3200)

    expect(firstHit.bambooFocus?.stacks).toBe(1)
    expect(secondPlan.attackFrequencyMultiplier).toBeCloseTo(1.03)
    expect(secondHit.bambooFocus?.stacks).toBe(2)
    expect(switchedPlan.attackFrequencyMultiplier).toBe(1)
    expect(switchedHit.bambooFocus).toMatchObject({ targetId: 'second', stacks: 1 })
    expect(expiredPlan.attackFrequencyMultiplier).toBe(1)
  })

  it('caps bamboo focus at ten stacks', () => {
    const profile = createMahjongAttackProfile(
      'tower-1',
      createTowerState('bamboo', 'single', ['green']),
      100
    )
    let focus: BambooFocusState | null = null

    for (let index = 0; index < 14; index += 1) {
      const plan = createAttackPlan({
        cycleId: `cycle-${index}`,
        profile,
        targetIds: ['enemy'],
        bambooFocus: focus,
        nowMs: index * 100
      })
      focus = resolveFirstHit(
        plan,
        createTarget(),
        undefined,
        focus,
        index * 100
      ).bambooFocus
    }

    expect(focus?.stacks).toBe(10)
    expect(createAttackPlan({
      cycleId: 'final',
      profile,
      targetIds: ['enemy'],
      bambooFocus: focus,
      nowMs: 1500
    }).attackFrequencyMultiplier).toBeCloseTo(1.3)
  })

  it.each([
    ['basic', 800],
    ['boss', 350]
  ] as const)('uses the configured dot stun duration for %s targets', (type, durationMs) => {
    const plan = createPlan('dots', 'single', ['enemy'], ['green'])
    const random = vi.fn(() => .11)
    const result = resolveFirstHit(
      plan,
      createTarget({ type }),
      undefined,
      null,
      500,
      random
    )

    expect(random).toHaveBeenCalledOnce()
    expect(result.targetEffects.stun).toEqual({ expiresAtMs: 500 + durationMs })
  })

  it('does not stun at the exact probability boundary', () => {
    const plan = createPlan('dots', 'single', ['enemy'], ['green'])
    const result = resolveFirstHit(plan, createTarget(), undefined, null, 0, () => .12)

    expect(result.targetEffects.stun).toBeNull()
  })
})
