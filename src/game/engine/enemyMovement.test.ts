import { describe, expect, it } from 'vitest'
import {
  ENEMY_TRAFFIC_CONFIG,
  ENEMY_TYPES
} from '../config/enemies'
import type { EnemyType } from '../types/game'
import {
  advancePathCursor,
  canSpawnEnemyAtEntrance,
  createPathMetrics,
  distanceToPathCursor,
  pathCursorToDistance,
  resolveEnemyQueueMovement,
  takeNextEnemySpawn
} from './enemyMovement'
import type { EnemyMovementIntent } from './enemyMovement'

function createIntent(
  id: string,
  type: EnemyType,
  pathDistance: number,
  freeTravelDistance: number,
  options: Partial<EnemyMovementIntent> = {}
): EnemyMovementIntent {
  const config = ENEMY_TYPES[type]
  return {
    id,
    spawnSequence: Number(id.replace(/\D/g, '')) || 0,
    pathDistance,
    radius: config.radius,
    baseSpeed: config.speed,
    freeTravelDistance,
    ...options
  }
}

function byId(
  results: ReturnType<typeof resolveEnemyQueueMovement>,
  id: string
) {
  return results.find(result => result.id === id)!
}

function minimumSpacing(front: EnemyType, rear: EnemyType): number {
  return (
    ENEMY_TYPES[front].radius +
    ENEMY_TYPES[rear].radius +
    ENEMY_TRAFFIC_CONFIG.gap
  )
}

describe('path cursor conversion', () => {
  const metrics = createPathMetrics([
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 40 },
    { x: 80, y: 40 }
  ])

  it('converts both sides of a corner without changing its route distance', () => {
    expect(pathCursorToDistance(metrics, {
      pathIndex: 0,
      progress: 0.75
    })).toBe(30)

    expect(distanceToPathCursor(metrics, 40)).toEqual({
      pathIndex: 1,
      progress: 0,
      position: { x: 40, y: 0 },
      pathDistance: 40,
      reachedEnd: false
    })
  })

  it('preserves travel remaining across multiple segments and clamps at the end', () => {
    expect(advancePathCursor(metrics, {
      pathIndex: 0,
      progress: 0.75
    }, 70)).toEqual({
      pathIndex: 2,
      progress: 0.5,
      position: { x: 60, y: 40 },
      pathDistance: 100,
      reachedEnd: false
    })

    expect(advancePathCursor(metrics, {
      pathIndex: 0,
      progress: 0.75
    }, 200)).toEqual({
      pathIndex: 3,
      progress: 0,
      position: { x: 80, y: 40 },
      pathDistance: 120,
      reachedEnd: true
    })
  })
})

describe('enemy queue movement', () => {
  it('keeps free movement when enemies do not make contact', () => {
    const results = resolveEnemyQueueMovement([
      createIntent('enemy-1', 'basic', 100, 2),
      createIntent('enemy-2', 'basic', 50, 5)
    ], 300, 100)

    expect(byId(results, 'enemy-1')).toMatchObject({
      pathDistance: 102,
      travelDistance: 2,
      pushed: false,
      blocked: false
    })
    expect(byId(results, 'enemy-2')).toMatchObject({
      pathDistance: 55,
      travelDistance: 5,
      pushed: false,
      blocked: false
    })
  })

  it('blocks a smaller rear enemy without letting it push the front enemy', () => {
    const spacing = minimumSpacing('basic', 'fast')
    const results = resolveEnemyQueueMovement([
      createIntent('enemy-1', 'basic', 100, 2),
      createIntent('enemy-2', 'fast', 100 - spacing, 8.5)
    ], 300, 100)

    expect(byId(results, 'enemy-1').travelDistance).toBe(2)
    expect(byId(results, 'enemy-2')).toMatchObject({
      travelDistance: 2,
      pushed: false,
      blocked: true
    })
  })

  it('keeps a blocked queue advancing behind its slowed leader across frames', () => {
    const spacing = minimumSpacing('basic', 'fast')
    const firstFrame = resolveEnemyQueueMovement([
      createIntent('enemy-1', 'basic', 100, 2, { isSlowed: true }),
      createIntent('enemy-2', 'fast', 100 - spacing, 8.5)
    ], 300, 100)
    const secondFrame = resolveEnemyQueueMovement([
      createIntent(
        'enemy-1',
        'basic',
        byId(firstFrame, 'enemy-1').pathDistance,
        2,
        { isSlowed: true }
      ),
      createIntent(
        'enemy-2',
        'fast',
        byId(firstFrame, 'enemy-2').pathDistance,
        8.5
      )
    ], 300, 100)

    expect(byId(firstFrame, 'enemy-2').travelDistance).toBe(2)
    expect(byId(secondFrame, 'enemy-1').travelDistance).toBe(2)
    expect(byId(secondFrame, 'enemy-2').travelDistance).toBe(2)
  })

  it('transfers half of equal-size catch-up excess without erasing slow', () => {
    const spacing = minimumSpacing('basic', 'basic')
    const results = resolveEnemyQueueMovement([
      createIntent('enemy-1', 'basic', 100, 2, { isSlowed: true }),
      createIntent('enemy-2', 'basic', 100 - spacing, 5)
    ], 300, 100)

    expect(byId(results, 'enemy-1')).toMatchObject({
      pathDistance: 103.5,
      travelDistance: 3.5,
      pushed: true
    })
    expect(byId(results, 'enemy-2').travelDistance).toBeCloseTo(3.5)
    expect(byId(results, 'enemy-1').travelDistance).toBeLessThan(5)
  })

  it('uses the larger rear radius as a stronger push weight', () => {
    const spacing = minimumSpacing('basic', 'tank')
    const frontFreeTravel = 0.5
    const rearFreeTravel = 3.4
    const weight = ENEMY_TYPES.tank.radius / (
      ENEMY_TYPES.tank.radius + ENEMY_TYPES.basic.radius
    )
    const expectedTravel = (
      frontFreeTravel +
      (rearFreeTravel - frontFreeTravel) * weight
    )
    const results = resolveEnemyQueueMovement([
      createIntent('enemy-1', 'basic', 100, frontFreeTravel, {
        isSlowed: true
      }),
      createIntent('enemy-2', 'tank', 100 - spacing, rearFreeTravel)
    ], 300, 100)

    expect(byId(results, 'enemy-1').travelDistance).toBeCloseTo(expectedTravel)
    expect(byId(results, 'enemy-2').travelDistance).toBeCloseTo(expectedTravel)
  })

  it('caps received pushing at the front enemy base travel distance', () => {
    const spacing = minimumSpacing('basic', 'tank')
    const results = resolveEnemyQueueMovement([
      createIntent('enemy-1', 'basic', 100, 4.9, { isSlowed: true }),
      createIntent('enemy-2', 'tank', 100 - spacing, 20, {
        baseSpeed: 200
      })
    ], 300, 100)

    expect(byId(results, 'enemy-1').travelDistance).toBeCloseTo(5)
    expect(byId(results, 'enemy-2').travelDistance).toBeCloseTo(5)
  })

  it('propagates weighted pushing from the back through a size-valid chain', () => {
    const frontMiddleSpacing = minimumSpacing('fast', 'basic')
    const middleRearSpacing = minimumSpacing('basic', 'tank')
    const results = resolveEnemyQueueMovement([
      createIntent('enemy-1', 'fast', 100, 1, { isSlowed: true }),
      createIntent('enemy-2', 'basic', 100 - frontMiddleSpacing, 2, {
        isSlowed: true
      }),
      createIntent(
        'enemy-3',
        'tank',
        100 - frontMiddleSpacing - middleRearSpacing,
        3.4
      )
    ], 300, 100)

    const rearWeight = 14 / (14 + 12)
    const middleDrive = 2 + (3.4 - 2) * rearWeight
    const middleWeight = 12 / (12 + 10)
    const expectedTravel = 1 + (middleDrive - 1) * middleWeight

    expect(byId(results, 'enemy-1').travelDistance).toBeCloseTo(expectedTravel)
    expect(byId(results, 'enemy-2').travelDistance).toBeCloseTo(expectedTravel)
    expect(byId(results, 'enemy-3').travelDistance).toBeCloseTo(expectedTravel)
  })

  it('breaks a push chain when the middle enemy is smaller than the front', () => {
    const frontMiddleSpacing = minimumSpacing('tank', 'basic')
    const middleRearSpacing = minimumSpacing('basic', 'tank')
    const results = resolveEnemyQueueMovement([
      createIntent('enemy-1', 'tank', 100, 0.34, { isSlowed: true }),
      createIntent('enemy-2', 'basic', 100 - frontMiddleSpacing, 2, {
        isSlowed: true
      }),
      createIntent(
        'enemy-3',
        'tank',
        100 - frontMiddleSpacing - middleRearSpacing,
        3.4
      )
    ], 300, 100)

    expect(byId(results, 'enemy-1').travelDistance).toBeCloseTo(0.34)
    expect(byId(results, 'enemy-2').travelDistance).toBeCloseTo(0.34)
    expect(byId(results, 'enemy-3').travelDistance).toBeCloseTo(0.34)
  })

  it('keeps a stunned front enemy as a hard stop', () => {
    const spacing = minimumSpacing('basic', 'basic')
    const results = resolveEnemyQueueMovement([
      createIntent('enemy-1', 'basic', 100, 0, {
        isSlowed: true,
        isStunned: true
      }),
      createIntent('enemy-2', 'basic', 100 - spacing, 5)
    ], 300, 100)

    expect(byId(results, 'enemy-1').travelDistance).toBe(0)
    expect(byId(results, 'enemy-2').travelDistance).toBe(0)
  })

  it('is independent of input order and does not mutate frozen inputs', () => {
    const front = Object.freeze(createIntent('enemy-1', 'basic', 100, 2))
    const middle = Object.freeze(createIntent('enemy-2', 'basic', 73, 5))
    const rear = Object.freeze(createIntent('enemy-3', 'tank', 40, 3.4))
    const ordered = Object.freeze([front, middle, rear])
    const shuffled = Object.freeze([rear, front, middle])

    const orderedResults = resolveEnemyQueueMovement(ordered, 300, 100)
    const shuffledResults = resolveEnemyQueueMovement(shuffled, 300, 100)

    expect(shuffledResults).toEqual(orderedResults)
    expect(ordered).toEqual([front, middle, rear])
    expect(shuffled).toEqual([rear, front, middle])
  })

  it('uses spawn sequence instead of input order when path distances tie', () => {
    const older = createIntent('older', 'basic', 50, 0, {
      spawnSequence: 4
    })
    const newer = createIntent('newer', 'basic', 50, 0, {
      spawnSequence: 5
    })

    expect(resolveEnemyQueueMovement(
      [newer, older],
      300,
      100
    ).map(result => result.id)).toEqual(['older', 'newer'])
  })

  it('lets an enemy reach the endpoint without creating a lasting queue wall', () => {
    const spacing = minimumSpacing('basic', 'basic')
    const firstFrame = resolveEnemyQueueMovement([
      createIntent('enemy-1', 'basic', 118, 5),
      createIntent('enemy-2', 'basic', 118 - spacing, 5)
    ], 120, 100)

    expect(byId(firstFrame, 'enemy-1')).toMatchObject({
      pathDistance: 120,
      reachedEnd: true
    })
    expect(byId(firstFrame, 'enemy-2').pathDistance).toBe(93)

    const secondFrame = resolveEnemyQueueMovement([
      createIntent('enemy-2', 'basic', 93, 5)
    ], 120, 100)
    expect(byId(secondFrame, 'enemy-2').pathDistance).toBe(98)
  })

  it('does not move at zero delta time', () => {
    const result = resolveEnemyQueueMovement([
      createIntent('enemy-1', 'basic', 100, 5)
    ], 300, 0)

    expect(byId(result, 'enemy-1')).toMatchObject({
      pathDistance: 100,
      travelDistance: 0
    })
  })

  it('rejects duplicate enemy ids', () => {
    expect(() => resolveEnemyQueueMovement([
      createIntent('duplicate', 'basic', 100, 2),
      createIntent('duplicate', 'basic', 50, 5)
    ], 300, 100)).toThrow('Duplicate enemy movement id: duplicate')
  })

  it('does not push a front enemy that is not slowed', () => {
    const spacing = minimumSpacing('basic', 'basic')
    const results = resolveEnemyQueueMovement([
      createIntent('enemy-1', 'basic', 100, 2),
      createIntent('enemy-2', 'basic', 100 - spacing, 5)
    ], 300, 100)

    expect(byId(results, 'enemy-1').travelDistance).toBe(2)
    expect(byId(results, 'enemy-2')).toMatchObject({
      travelDistance: 2,
      blocked: true
    })
  })
})

describe('enemy entrance clearance', () => {
  it('delays a spawn until every active enemy clears the required spacing', () => {
    const spawnRadius = ENEMY_TYPES.fast.radius
    const basicRadius = ENEMY_TYPES.basic.radius
    const requiredDistance = (
      spawnRadius + basicRadius + ENEMY_TRAFFIC_CONFIG.gap
    )

    expect(canSpawnEnemyAtEntrance([{
      pathDistance: requiredDistance - 0.01,
      radius: basicRadius
    }], spawnRadius)).toBe(false)
    expect(canSpawnEnemyAtEntrance([{
      pathDistance: requiredDistance,
      radius: basicRadius
    }], spawnRadius)).toBe(true)
  })

  it('allows the first spawn and ignores no queued item state', () => {
    expect(canSpawnEnemyAtEntrance([], ENEMY_TYPES.boss.radius)).toBe(true)
  })

  it('keeps a blocked queue item and advances its sequence only after spawning', () => {
    const queue = Object.freeze([
      Object.freeze({ type: 'fast' as const, delay: 100 }),
      Object.freeze({ type: 'tank' as const, delay: 100 })
    ])
    const blocked = takeNextEnemySpawn(queue, 100, [{
      pathDistance: 5,
      radius: ENEMY_TYPES.basic.radius
    }], 7)

    expect(blocked).toEqual({
      status: 'entrance_blocked',
      queue,
      nextSpawnSequence: 7
    })

    const spawned = takeNextEnemySpawn(
      blocked.queue,
      150,
      [],
      blocked.nextSpawnSequence
    )
    expect(spawned).toEqual({
      status: 'spawned',
      spawn: { type: 'fast', delay: 100, spawnSequence: 7 },
      queue: [{ type: 'tank', delay: 100 }],
      nextSpawnSequence: 8
    })

    const stillBlocked = takeNextEnemySpawn(spawned.queue, 150, [{
      pathDistance: 0,
      radius: ENEMY_TYPES.fast.radius
    }], spawned.nextSpawnSequence)
    expect(stillBlocked).toMatchObject({
      status: 'entrance_blocked',
      queue: [{ type: 'tank', delay: 100 }],
      nextSpawnSequence: 8
    })
    expect(queue).toHaveLength(2)
  })
})
