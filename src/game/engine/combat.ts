import type { Bullet, Enemy, Position, Tower } from '../types/game'

type DamageTarget = Pick<Enemy, 'armor' | 'magicResist'>
type PoisonEffect = NonNullable<Enemy['poisonEffects']>[number]
type TimedEffectTarget = Pick<
  Enemy,
  'speed' | 'slowTimer' | 'slowEffect' | 'isStunned' | 'stunTimer'
>

export const PIERCE_SEARCH_RADIUS = 60
export const PIERCE_DAMAGE_MULTIPLIER = 0.6

export interface DamageResult {
  damage: number
  critical: boolean
}

export interface PoisonUpdate {
  effects: PoisonEffect[]
  damage: number
}

export interface TimedEffectUpdate {
  travelDistance: number
  slowTimer?: number
  slowEffect?: number
  isStunned: boolean
  stunTimer?: number
}

export interface BulletMovementUpdate {
  status: 'moving' | 'hit' | 'out_of_range'
  position: Position
}

export function calculateDamage(
  baseDamage: number,
  damageType: Tower['damageType'],
  target: DamageTarget,
  critChance = 0,
  critMultiplier = 2,
  randomValue = Math.random()
): DamageResult {
  const critical = critChance > 0 && randomValue < critChance
  let damage = critical ? baseDamage * critMultiplier : baseDamage

  if (damageType === 'physical') {
    damage *= 1 - target.armor / (target.armor + 10)
  } else if (damageType === 'magic') {
    damage *= 1 - target.magicResist
  }

  return { damage, critical }
}

export function selectTowerTargets(tower: Tower, enemies: Enemy[]): Enemy[] {
  const targetCount = Math.max(1, tower.multiTarget ?? 1)

  return enemies
    .filter(enemy => {
      if (enemy.isDead || enemy.reachedEnd) return false

      const dx = enemy.position.x - tower.position.x
      const dy = enemy.position.y - tower.position.y
      return Math.sqrt(dx * dx + dy * dy) <= tower.range
    })
    .sort((a, b) => {
      if (a.pathIndex !== b.pathIndex) return b.pathIndex - a.pathIndex
      return b.progress - a.progress
    })
    .slice(0, targetCount)
}

export function advanceBullet(
  bullet: Pick<Bullet, 'position' | 'originPosition' | 'attackRange' | 'speed'>,
  target: Pick<Enemy, 'position'>,
  deltaTime: number
): BulletMovementUpdate {
  const targetDistanceFromOrigin = Math.hypot(
    target.position.x - bullet.originPosition.x,
    target.position.y - bullet.originPosition.y
  )

  if (targetDistanceFromOrigin > bullet.attackRange) {
    return { status: 'out_of_range', position: bullet.position }
  }

  const dx = target.position.x - bullet.position.x
  const dy = target.position.y - bullet.position.y
  const distance = Math.hypot(dx, dy)
  const moveDistance = Math.max(0, bullet.speed * Math.max(0, deltaTime) / 1000)

  if (distance < 10 || moveDistance >= distance) {
    return { status: 'hit', position: target.position }
  }

  return {
    status: 'moving',
    position: {
      x: bullet.position.x + (dx / distance) * moveDistance,
      y: bullet.position.y + (dy / distance) * moveDistance
    }
  }
}

export function selectPierceTarget(
  primaryTarget: Enemy,
  enemies: Enemy[],
  maxDistance = PIERCE_SEARCH_RADIUS
): Enemy | undefined {
  return enemies
    .filter(enemy =>
      enemy.id !== primaryTarget.id &&
      !enemy.isDead &&
      !enemy.reachedEnd &&
      enemy.health > 0
    )
    .map(enemy => ({
      enemy,
      distance: Math.hypot(
        enemy.position.x - primaryTarget.position.x,
        enemy.position.y - primaryTarget.position.y
      )
    }))
    .filter(candidate => candidate.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)[0]?.enemy
}

export function applyEnemyDamage(enemy: Enemy, damage: number): boolean {
  if (enemy.isDead || enemy.reachedEnd || damage < 0) return false

  enemy.health = Math.max(0, enemy.health - damage)
  if (enemy.health > 0) return false

  enemy.isDead = true
  return true
}

export function advancePoisonEffects(
  effects: PoisonEffect[],
  deltaTime: number
): PoisonUpdate {
  const elapsedTime = Math.max(0, deltaTime)
  let damage = 0
  const activeEffects: PoisonEffect[] = []

  effects.forEach(effect => {
    const remainingDuration = Math.max(0, effect.duration)
    const effectiveElapsedTime = Math.min(elapsedTime, remainingDuration)
    const accumulatedTime = effect.tickAccumulator + effectiveElapsedTime
    const completedTicks = Math.floor(accumulatedTime / 1000)

    damage += completedTicks * effect.damage

    const nextDuration = remainingDuration - effectiveElapsedTime
    if (nextDuration > 0) {
      activeEffects.push({
        ...effect,
        duration: nextDuration,
        tickAccumulator: accumulatedTime - completedTicks * 1000
      })
    }
  })

  return { effects: activeEffects, damage }
}

export function advanceTimedEffects(
  enemy: TimedEffectTarget,
  deltaTime: number
): TimedEffectUpdate {
  const elapsedTime = Math.max(0, deltaTime)
  const stunDuration = enemy.isStunned
    ? Math.max(0, enemy.stunTimer ?? 0)
    : 0
  const slowDuration = Math.max(0, enemy.slowTimer ?? 0)
  const stunnedTime = Math.min(stunDuration, elapsedTime)
  const slowedTime = Math.max(
    0,
    Math.min(slowDuration, elapsedTime) - stunnedTime
  )
  const normalTime = elapsedTime - stunnedTime - slowedTime
  const remainingStunTime = Math.max(0, stunDuration - elapsedTime)
  const remainingSlowTime = Math.max(0, slowDuration - elapsedTime)

  return {
    travelDistance: (
      getSlowedSpeed(enemy.speed, enemy.slowEffect) * slowedTime +
      enemy.speed * normalTime
    ) / 1000,
    isStunned: remainingStunTime > 0,
    stunTimer: remainingStunTime > 0 ? remainingStunTime : undefined,
    slowTimer: remainingSlowTime > 0 ? remainingSlowTime : undefined,
    slowEffect: remainingSlowTime > 0 ? enemy.slowEffect : undefined
  }
}

export function getSlowedSpeed(baseSpeed: number, slowEffect = 0): number {
  const clampedSlow = Math.max(0, Math.min(slowEffect, 0.9))
  return baseSpeed * (1 - clampedSlow)
}
