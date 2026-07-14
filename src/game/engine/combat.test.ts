import { describe, expect, it } from 'vitest'
import type { Enemy, Tower } from '../types/game'
import {
  PIERCE_DAMAGE_MULTIPLIER,
  PIERCE_SEARCH_RADIUS,
  advanceBullet,
  advancePoisonEffects,
  advanceTimedEffects,
  applyEnemyDamage,
  calculateDamage,
  getSlowedSpeed,
  selectPierceTarget,
  selectTowerTargets
} from './combat'

function createEnemy(id: string, pathIndex: number, progress: number, x: number): Enemy {
  return {
    id,
    type: 'basic',
    position: { x, y: 0 },
    health: 100,
    maxHealth: 100,
    speed: 60,
    armor: 5,
    magicResist: 0.2,
    pathIndex,
    progress,
    reward: 5,
    mineDamage: 1
  }
}

function createTower(): Tower {
  return {
    id: 'tower',
    gemType: 'diamond',
    level: 'chipped',
    gridPosition: { row: 0, col: 0 },
    position: { x: 0, y: 0 },
    damage: 10,
    range: 100,
    attackSpeed: 400,
    lastAttackTime: 0,
    damageType: 'physical',
    multiTarget: 2
  }
}

describe('damage calculation', () => {
  it('keeps critical damage when applying physical armor', () => {
    const result = calculateDamage(30, 'physical', {
      armor: 5,
      magicResist: 0
    }, 0.5, 2, 0.1)

    expect(result.critical).toBe(true)
    expect(result.damage).toBeCloseTo(40)
  })

  it('applies magic resistance and leaves pure damage untouched', () => {
    const target = { armor: 20, magicResist: 0.25 }

    expect(calculateDamage(40, 'magic', target, 0, 2, 1).damage).toBe(30)
    expect(calculateDamage(40, 'pure', target, 0, 2, 1).damage).toBe(40)
  })
})

describe('tower targeting', () => {
  it('uses multi-target count and prioritizes enemies furthest along the path', () => {
    const targets = selectTowerTargets(createTower(), [
      createEnemy('near-start', 1, 0.9, 10),
      createEnemy('leader', 3, 0.1, 80),
      createEnemy('second', 2, 0.5, 50),
      createEnemy('out-of-range', 9, 0.9, 101)
    ])

    expect(targets.map(target => target.id)).toEqual(['leader', 'second'])
  })

  it('ignores dead and escaped enemies', () => {
    const dead = createEnemy('dead', 9, 0.9, 10)
    const escaped = createEnemy('escaped', 8, 0.9, 10)
    dead.isDead = true
    escaped.reachedEnd = true

    expect(selectTowerTargets(createTower(), [dead, escaped])).toEqual([])
  })

  it('selects the nearest living target for a 60% pierce hit', () => {
    const primary = createEnemy('primary', 3, 0.5, 0)
    const escaped = createEnemy('escaped', 5, 0.5, 5)
    const dead = createEnemy('dead', 5, 0.5, 10)
    const nearest = createEnemy('nearest', 2, 0.5, 20)
    const farther = createEnemy('farther', 4, 0.5, 50)
    const outOfRange = createEnemy('out-of-range', 9, 0.5, PIERCE_SEARCH_RADIUS + 1)
    escaped.reachedEnd = true
    dead.isDead = true

    expect(selectPierceTarget(primary, [
      primary,
      escaped,
      dead,
      farther,
      outOfRange,
      nearest
    ])).toBe(nearest)
    expect(PIERCE_SEARCH_RADIUS).toBe(60)
    expect(calculateDamage(
      100 * PIERCE_DAMAGE_MULTIPLIER,
      'pure',
      nearest
    ).damage).toBe(60)
  })
})

describe('projectile range', () => {
  it('discards a projectile before impact when its target leaves tower range', () => {
    const target = createEnemy('target', 0, 0, 101)

    expect(advanceBullet({
      position: { x: 99, y: 0 },
      originPosition: { x: 0, y: 0 },
      attackRange: 100,
      speed: 300
    }, target, 100)).toEqual({
      status: 'out_of_range',
      position: { x: 99, y: 0 }
    })
    expect(target.health).toBe(100)
  })

  it('still allows an impact at the edge of tower range', () => {
    const target = createEnemy('target', 0, 0, 100)

    expect(advanceBullet({
      position: { x: 95, y: 0 },
      originPosition: { x: 0, y: 0 },
      attackRange: 100,
      speed: 300
    }, target, 100).status).toBe('hit')
  })
})

describe('slow calculation', () => {
  it('uses the configured slow amount and clamps extreme values', () => {
    expect(getSlowedSpeed(100, 0.3)).toBe(70)
    expect(getSlowedSpeed(100, 5)).toBeCloseTo(10)
  })
})

describe('timed combat effects', () => {
  it('uses only the poison duration remaining in a long frame', () => {
    const firstUpdate = advancePoisonEffects([{
      damage: 4,
      duration: 2500,
      tickAccumulator: 0
    }], 500)

    expect(firstUpdate).toEqual({
      damage: 0,
      effects: [{
        damage: 4,
        duration: 2000,
        tickAccumulator: 500
      }]
    })

    const finalUpdate = advancePoisonEffects(firstUpdate.effects, 3000)
    expect(finalUpdate.damage).toBe(8)
    expect(finalUpdate.effects).toEqual([])
  })

  it('allows an accumulated final poison tick to kill once', () => {
    const enemy = createEnemy('poisoned', 0, 0, 0)
    enemy.health = 10

    const poisonUpdate = advancePoisonEffects([{
      damage: 10,
      duration: 300,
      tickAccumulator: 800
    }], 1000)

    expect(poisonUpdate).toEqual({ effects: [], damage: 10 })
    expect(applyEnemyDamage(enemy, poisonUpdate.damage)).toBe(true)
    expect(applyEnemyDamage(enemy, poisonUpdate.damage)).toBe(false)
    expect(enemy.health).toBe(0)
  })

  it('expires stun and slow timers while using only their active frame portions', () => {
    const stunned = createEnemy('stunned', 0, 0, 0)
    stunned.speed = 100
    stunned.isStunned = true
    stunned.stunTimer = 500

    expect(advanceTimedEffects(stunned, 1000)).toEqual({
      travelDistance: 50,
      isStunned: false,
      stunTimer: undefined,
      slowTimer: undefined,
      slowEffect: undefined
    })

    const slowed = createEnemy('slowed', 0, 0, 0)
    slowed.speed = 100
    slowed.slowTimer = 400
    slowed.slowEffect = 0.5

    expect(advanceTimedEffects(slowed, 1000)).toEqual({
      travelDistance: 80,
      isStunned: false,
      stunTimer: undefined,
      slowTimer: undefined,
      slowEffect: undefined
    })
  })

  it('keeps status timers active until their remaining time reaches zero', () => {
    const enemy = createEnemy('controlled', 0, 0, 0)
    enemy.speed = 100
    enemy.isStunned = true
    enemy.stunTimer = 700
    enemy.slowTimer = 900
    enemy.slowEffect = 0.25

    expect(advanceTimedEffects(enemy, 200)).toEqual({
      travelDistance: 0,
      isStunned: true,
      stunTimer: 500,
      slowTimer: 700,
      slowEffect: 0.25
    })
  })
})

describe('enemy death', () => {
  it('reports a kill only on the first lethal damage application', () => {
    const enemy = createEnemy('target', 0, 0, 0)
    enemy.health = 5

    expect(applyEnemyDamage(enemy, 5)).toBe(true)
    expect(applyEnemyDamage(enemy, 5)).toBe(false)
    expect(enemy).toMatchObject({ health: 0, isDead: true })
  })
})
