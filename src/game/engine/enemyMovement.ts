import { ENEMY_TRAFFIC_CONFIG, ENEMY_TYPES } from '../config/enemies'
import type { EnemyType, Position } from '../types/game'

const EPSILON = 1e-9

export interface PathCursor {
  readonly pathIndex: number
  readonly progress: number
}

export interface PathMetrics {
  readonly points: ReadonlyArray<Readonly<Position>>
  readonly cumulativeDistances: ReadonlyArray<number>
  readonly totalDistance: number
}

export interface ResolvedPathCursor extends PathCursor {
  readonly position: Readonly<Position>
  readonly pathDistance: number
  readonly reachedEnd: boolean
}

export interface EnemyMovementIntent {
  readonly id: string
  readonly spawnSequence: number
  readonly pathDistance: number
  readonly radius: number
  readonly baseSpeed: number
  readonly freeTravelDistance: number
  readonly isSlowed?: boolean
  readonly isStunned?: boolean
}

export interface EnemyMovementResolution {
  readonly id: string
  readonly spawnSequence: number
  readonly pathDistance: number
  readonly travelDistance: number
  readonly reachedEnd: boolean
  readonly pushed: boolean
  readonly blocked: boolean
}

interface WorkingMovement {
  id: string
  spawnSequence: number
  pathDistance: number
  radius: number
  freeTravelDistance: number
  maxTravelDistance: number
  driveDistance: number
  isSlowed: boolean
  isStunned: boolean
}

export interface EntranceOccupant {
  readonly pathDistance: number
  readonly radius: number
}

export interface ScheduledEnemySpawn {
  readonly type: EnemyType
  readonly delay: number
}

export interface EnemySpawnResolution {
  readonly status: 'not_due' | 'entrance_blocked' | 'spawned'
  readonly spawn?: ScheduledEnemySpawn & { readonly spawnSequence: number }
  readonly queue: ReadonlyArray<Readonly<ScheduledEnemySpawn>>
  readonly nextSpawnSequence: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

function requireFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be finite`)
  }
}

function compareIds(left: string, right: string): number {
  if (left === right) return 0
  return left < right ? -1 : 1
}

export function createPathMetrics(
  points: ReadonlyArray<Readonly<Position>>
): PathMetrics {
  if (points.length === 0) {
    throw new Error('A movement path must contain at least one point')
  }

  const copiedPoints = points.map(point => {
    requireFinite(point.x, 'Path point x')
    requireFinite(point.y, 'Path point y')
    return { x: point.x, y: point.y }
  })
  const cumulativeDistances = [0]

  for (let index = 1; index < copiedPoints.length; index += 1) {
    const previousPoint = copiedPoints[index - 1]
    const point = copiedPoints[index]
    const segmentLength = Math.hypot(
      point.x - previousPoint.x,
      point.y - previousPoint.y
    )

    if (segmentLength <= EPSILON) {
      throw new Error(`Path segment ${index - 1} must have positive length`)
    }

    cumulativeDistances.push(
      cumulativeDistances[cumulativeDistances.length - 1] + segmentLength
    )
  }

  return {
    points: copiedPoints,
    cumulativeDistances,
    totalDistance: cumulativeDistances[cumulativeDistances.length - 1]
  }
}

export function pathCursorToDistance(
  metrics: PathMetrics,
  cursor: PathCursor
): number {
  requireFinite(cursor.pathIndex, 'Path index')
  requireFinite(cursor.progress, 'Path progress')

  const finalPointIndex = metrics.points.length - 1
  const pathIndex = clamp(Math.floor(cursor.pathIndex), 0, finalPointIndex)
  if (pathIndex >= finalPointIndex) return metrics.totalDistance

  const segmentLength = (
    metrics.cumulativeDistances[pathIndex + 1] -
    metrics.cumulativeDistances[pathIndex]
  )
  const distance = (
    metrics.cumulativeDistances[pathIndex] +
    Math.max(0, cursor.progress) * segmentLength
  )

  return clamp(distance, 0, metrics.totalDistance)
}

export function distanceToPathCursor(
  metrics: PathMetrics,
  pathDistance: number
): ResolvedPathCursor {
  requireFinite(pathDistance, 'Path distance')

  const distance = clamp(pathDistance, 0, metrics.totalDistance)
  const finalPointIndex = metrics.points.length - 1
  if (
    finalPointIndex === 0 ||
    distance >= metrics.totalDistance - EPSILON
  ) {
    return {
      pathIndex: finalPointIndex,
      progress: 0,
      position: { ...metrics.points[finalPointIndex] },
      pathDistance: metrics.totalDistance,
      reachedEnd: true
    }
  }

  let pathIndex = 0
  while (
    pathIndex < finalPointIndex &&
    distance >= metrics.cumulativeDistances[pathIndex + 1] - EPSILON
  ) {
    pathIndex += 1
  }

  const segmentStart = metrics.points[pathIndex]
  const segmentEnd = metrics.points[pathIndex + 1]
  const segmentLength = (
    metrics.cumulativeDistances[pathIndex + 1] -
    metrics.cumulativeDistances[pathIndex]
  )
  const progress = (
    distance - metrics.cumulativeDistances[pathIndex]
  ) / segmentLength

  return {
    pathIndex,
    progress,
    position: {
      x: segmentStart.x + (segmentEnd.x - segmentStart.x) * progress,
      y: segmentStart.y + (segmentEnd.y - segmentStart.y) * progress
    },
    pathDistance: distance,
    reachedEnd: false
  }
}

export function advancePathCursor(
  metrics: PathMetrics,
  cursor: PathCursor,
  travelDistance: number
): ResolvedPathCursor {
  requireFinite(travelDistance, 'Travel distance')
  const currentDistance = pathCursorToDistance(metrics, cursor)
  return distanceToPathCursor(
    metrics,
    currentDistance + Math.max(0, travelDistance)
  )
}

export function canSpawnEnemyAtEntrance(
  occupants: ReadonlyArray<Readonly<EntranceOccupant>>,
  spawnRadius: number,
  trafficGap = ENEMY_TRAFFIC_CONFIG.gap
): boolean {
  requireFinite(spawnRadius, 'Spawn radius')
  requireFinite(trafficGap, 'Traffic gap')
  if (spawnRadius <= 0) throw new Error('Spawn radius must be positive')
  if (trafficGap < 0) throw new Error('Traffic gap must not be negative')

  return occupants.every(occupant => {
    requireFinite(occupant.pathDistance, 'Occupant path distance')
    requireFinite(occupant.radius, 'Occupant radius')
    if (occupant.radius <= 0) {
      throw new Error('Occupant radius must be positive')
    }

    return occupant.pathDistance + EPSILON >= (
      occupant.radius + spawnRadius + trafficGap
    )
  })
}

export function takeNextEnemySpawn(
  queue: ReadonlyArray<Readonly<ScheduledEnemySpawn>>,
  elapsedTime: number,
  occupants: ReadonlyArray<Readonly<EntranceOccupant>>,
  nextSpawnSequence: number
): EnemySpawnResolution {
  requireFinite(elapsedTime, 'Wave elapsed time')
  requireFinite(nextSpawnSequence, 'Next spawn sequence')
  if (!Number.isSafeInteger(nextSpawnSequence) || nextSpawnSequence < 0) {
    throw new Error('Next spawn sequence must be a non-negative safe integer')
  }

  const nextSpawn = queue[0]
  if (!nextSpawn || nextSpawn.delay > Math.max(0, elapsedTime)) {
    return {
      status: 'not_due',
      queue,
      nextSpawnSequence
    }
  }

  if (!canSpawnEnemyAtEntrance(
    occupants,
    ENEMY_TYPES[nextSpawn.type].radius
  )) {
    return {
      status: 'entrance_blocked',
      queue,
      nextSpawnSequence
    }
  }

  return {
    status: 'spawned',
    spawn: { ...nextSpawn, spawnSequence: nextSpawnSequence },
    queue: queue.slice(1),
    nextSpawnSequence: nextSpawnSequence + 1
  }
}

export function resolveEnemyQueueMovement(
  intents: ReadonlyArray<Readonly<EnemyMovementIntent>>,
  pathLength: number,
  deltaTime: number,
  trafficGap = ENEMY_TRAFFIC_CONFIG.gap
): ReadonlyArray<Readonly<EnemyMovementResolution>> {
  requireFinite(pathLength, 'Path length')
  requireFinite(deltaTime, 'Delta time')
  requireFinite(trafficGap, 'Traffic gap')
  if (pathLength < 0) throw new Error('Path length must not be negative')
  if (trafficGap < 0) throw new Error('Traffic gap must not be negative')

  const ids = new Set<string>()
  const elapsedTime = Math.max(0, deltaTime)
  const workingMovements: WorkingMovement[] = intents.map(intent => {
    if (ids.has(intent.id)) {
      throw new Error(`Duplicate enemy movement id: ${intent.id}`)
    }
    ids.add(intent.id)

    requireFinite(intent.spawnSequence, 'Spawn sequence')
    requireFinite(intent.pathDistance, 'Enemy path distance')
    requireFinite(intent.radius, 'Enemy radius')
    requireFinite(intent.baseSpeed, 'Enemy base speed')
    requireFinite(intent.freeTravelDistance, 'Enemy free travel distance')
    if (intent.radius <= 0) throw new Error('Enemy radius must be positive')

    const maxTravelDistance = Math.max(0, intent.baseSpeed) * elapsedTime / 1000
    const freeTravelDistance = clamp(
      intent.freeTravelDistance,
      0,
      maxTravelDistance
    )

    return {
      id: intent.id,
      spawnSequence: intent.spawnSequence,
      pathDistance: clamp(intent.pathDistance, 0, pathLength),
      radius: intent.radius,
      freeTravelDistance,
      maxTravelDistance,
      driveDistance: freeTravelDistance,
      isSlowed: Boolean(intent.isSlowed),
      isStunned: Boolean(intent.isStunned)
    }
  })

  workingMovements.sort((left, right) => {
    const distanceDifference = right.pathDistance - left.pathDistance
    if (Math.abs(distanceDifference) > EPSILON) return distanceDifference

    const sequenceDifference = left.spawnSequence - right.spawnSequence
    if (sequenceDifference !== 0) return sequenceDifference
    return compareIds(left.id, right.id)
  })

  for (let index = workingMovements.length - 1; index > 0; index -= 1) {
    const rear = workingMovements[index]
    const front = workingMovements[index - 1]
    if (
      rear.radius + EPSILON < front.radius ||
      !front.isSlowed ||
      front.isStunned
    ) {
      continue
    }

    const minimumSpacing = rear.radius + front.radius + trafficGap
    const availableGap = Math.max(
      0,
      front.pathDistance - rear.pathDistance - minimumSpacing
    )
    const catchUpExcess = Math.max(
      0,
      rear.driveDistance - front.driveDistance - availableGap
    )
    const transferWeight = rear.radius / (rear.radius + front.radius)
    front.driveDistance = Math.min(
      front.maxTravelDistance,
      front.driveDistance + catchUpExcess * transferWeight
    )
  }

  const resolutions: EnemyMovementResolution[] = []
  let previousMovement: WorkingMovement | undefined
  let previousDistance = pathLength

  workingMovements.forEach(movement => {
    const desiredDistance = Math.min(
      pathLength,
      movement.pathDistance + movement.driveDistance
    )
    const maximumDistance = previousMovement
      ? previousDistance - (
        previousMovement.radius + movement.radius + trafficGap
      )
      : pathLength
    const pathDistance = Math.max(
      movement.pathDistance,
      Math.min(desiredDistance, maximumDistance)
    )
    const travelDistance = pathDistance - movement.pathDistance

    resolutions.push({
      id: movement.id,
      spawnSequence: movement.spawnSequence,
      pathDistance,
      travelDistance,
      reachedEnd: pathDistance >= pathLength - EPSILON,
      pushed: travelDistance > movement.freeTravelDistance + EPSILON,
      blocked: pathDistance < desiredDistance - EPSILON
    })

    previousMovement = movement
    previousDistance = pathDistance
  })

  return resolutions
}
