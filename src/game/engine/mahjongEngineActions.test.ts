import { describe, expect, it } from 'vitest'
import {
  MAHJONG_FORMATION_MULTIPLIERS,
  beginMahjongRound,
  canGambleForMahjongHonor,
  createMahjongRandomStats,
  createMahjongTilePool
} from '../config/mahjong'
import type {
  GridCell,
  MahjongAttachment,
  MahjongNumberTile,
  MahjongRank,
  MahjongRoundTile,
  MahjongSuit,
  Tower
} from '../types/game'
import { createSingleMahjongTowerState } from './mahjongStats'
import {
  assertMahjongOwnership,
  auditMahjongOwnership
} from './mahjongOwnership'
import {
  applyAttachMahjongHonorAction,
  applyFinalizeMahjongBatchAction,
  applyRemoveMahjongWallAction,
  applySynthesizeMahjongAction,
  type MahjongEngineActionState
} from './mahjongEngineActions'

function createTile(
  id: string,
  suit: MahjongSuit,
  rank: MahjongRank,
  copy: MahjongNumberTile['copy'] = 1
): MahjongNumberTile {
  return { id, suit, rank, copy }
}

function createTower(
  id: string,
  suit: MahjongSuit,
  rank: MahjongRank,
  col: number,
  damage = 20
): Tower {
  const tile = createTile(`${id}-tile`, suit, rank)
  return createTowerFromTile(id, tile, col, damage)
}

function createTowerFromTile(
  id: string,
  tile: MahjongNumberTile,
  col: number,
  damage = 20
): Tower {
  const mahjongState = createSingleMahjongTowerState(tile, {
    damage,
    attackIntervalMs: 1000,
    attackRange: 120
  })
  return {
    id,
    mahjongTile: tile,
    mahjongState,
    level: 'chipped',
    gridPosition: { row: 1, col },
    position: { x: col * 40, y: 40 },
    damage,
    range: 120,
    attackSpeed: 1000,
    lastAttackTime: 0,
    damageType: tile.suit === 'dots' ? 'magic' : 'physical'
  }
}

function expectConserved(
  universe: readonly MahjongNumberTile[],
  state: MahjongEngineActionState,
  roundTiles: readonly MahjongRoundTile[],
  heldTile: MahjongNumberTile | null
) {
  return assertMahjongOwnership({
    universe,
    pool: state.pool,
    roundTiles,
    heldTile,
    towers: state.towers,
    grid: state.grid
  })
}

describe('applyFinalizeMahjongBatchAction', () => {
  it('atomically keeps one temporary single and turns the other two into tile walls', () => {
    const towers = [
      createTower('keep', 'characters', 1, 1),
      createTower('wall-a', 'bamboo', 2, 2),
      createTower('wall-b', 'dots', 3, 3)
    ]
    const state = createState(towers, { storedTowerIds: [] })

    const result = applyFinalizeMahjongBatchAction(
      state,
      towers.map(tower => tower.id),
      towers[0].id
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.towers.map(tower => tower.id)).toEqual(['keep'])
    expect(result.state.storedTowerIds).toEqual(['keep'])
    expect(result.state.grid[1][2]).toMatchObject({
      type: 'obstacle',
      mahjongWallKind: 'tile',
      mahjongTile: towers[1].mahjongTile
    })
    expect(result.state.grid[1][3]).toMatchObject({
      type: 'obstacle',
      mahjongWallKind: 'tile',
      mahjongTile: towers[2].mahjongTile
    })
    expect(result.state.obstacleOrder).toEqual([
      { row: 1, col: 2 },
      { row: 1, col: 3 }
    ])
    expect(state.towers).toHaveLength(3)
    expect(state.grid[1][2].type).toBe('tower')
  })

  it('returns the original state reference for an invalid batch or entity', () => {
    const towers = [
      createTower('keep', 'characters', 1, 1),
      createTower('wall-a', 'bamboo', 2, 2),
      createTower('wall-b', 'dots', 3, 3)
    ]
    const state = createState(towers, { storedTowerIds: [] })
    const before = structuredClone(state)

    const duplicateBatch = applyFinalizeMahjongBatchAction(
      state,
      ['keep', 'wall-a', 'wall-a'],
      'keep'
    )
    expect(duplicateBatch).toEqual({ ok: false, reason: 'invalid_batch', state })
    expect(duplicateBatch.state).toBe(state)
    expect(state).toEqual(before)

    towers[1].mahjongState!.activeSources = []
    const invalidBefore = structuredClone(state)
    const invalidEntity = applyFinalizeMahjongBatchAction(
      state,
      towers.map(tower => tower.id),
      'keep'
    )
    expect(invalidEntity).toEqual({ ok: false, reason: 'invalid_entity_state', state })
    expect(invalidEntity.state).toBe(state)
    expect(state).toEqual(invalidBefore)
  })
})

function createGrid(towers: readonly Tower[]): GridCell[][] {
  const grid: GridCell[][] = Array.from({ length: 3 }, (_, row) => (
    Array.from({ length: 5 }, (_, col) => ({ row, col, type: 'empty' }))
  ))
  towers.forEach(tower => {
    grid[tower.gridPosition.row][tower.gridPosition.col] = {
      ...grid[tower.gridPosition.row][tower.gridPosition.col],
      type: 'tower',
      towerId: tower.id
    }
  })
  return grid
}

function createState(
  towers: Tower[],
  options: Partial<MahjongEngineActionState> = {}
): MahjongEngineActionState {
  return {
    towers,
    storedTowerIds: towers.map(tower => tower.id),
    grid: createGrid(towers),
    obstacleOrder: [],
    functionTiles: [],
    gold: 200,
    pool: [],
    ...options
  }
}

describe('applySynthesizeMahjongAction', () => {
  it('atomically commits a pair and retains one canonical tower object', () => {
    const anchor = createTower('anchor', 'characters', 5, 1, 10)
    const material = createTower('material', 'characters', 5, 2, 30)
    const state = createState([anchor, material])

    const result = applySynthesizeMahjongAction(state, 'building', {
      anchorTowerId: anchor.id,
      materialTowerIds: [material.id],
      recipe: { formation: 'pair' }
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.towers).toHaveLength(1)
    expect(result.state.storedTowerIds).toEqual([anchor.id])
    expect(result.state.towers[0].mahjongState).toMatchObject({
      formation: 'pair',
      containedTileIds: ['anchor-tile', 'material-tile']
    })
    expect(result.state.towers[0].damage).toBeCloseTo(
      20 * MAHJONG_FORMATION_MULTIPLIERS.pair.damage
    )
    expect(result.state.grid[1][2]).toEqual({
      row: 1,
      col: 2,
      type: 'obstacle',
      mahjongWallKind: 'pure'
    })
    expect(result.state.obstacleOrder).toEqual([{ row: 1, col: 2 }])
    expect(state.towers).toHaveLength(2)
    expect(state.grid[1][2].type).toBe('tower')
  })

  it('consumes white only after a successful white-backed pung', () => {
    const anchor = createTower('anchor', 'bamboo', 4, 1)
    const material = createTower('material', 'bamboo', 4, 2)
    const state = createState([anchor, material], {
      functionTiles: ['white', 'red']
    })

    const result = applySynthesizeMahjongAction(state, 'ready', {
      anchorTowerId: anchor.id,
      materialTowerIds: [material.id],
      recipe: { formation: 'pung' },
      whiteCount: 1
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.functionTiles).toEqual(['red'])
    expect(result.state.towers[0].mahjongState).toMatchObject({
      formation: 'pung',
      ranks: [4, 4, 4],
      containedTileIds: ['anchor-tile', 'material-tile'],
      whiteSlotIndices: [2]
    })
    expect(state.functionTiles).toEqual(['white', 'red'])
  })

  it('consumes every requested white after a multi-white pung', () => {
    const anchor = createTower('anchor', 'bamboo', 4, 1)
    const state = createState([anchor], {
      functionTiles: ['white', 'white', 'red']
    })

    const result = applySynthesizeMahjongAction(state, 'ready', {
      anchorTowerId: anchor.id,
      recipe: { formation: 'pung' },
      whiteCount: 2
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.functionTiles).toEqual(['red'])
    expect(result.state.towers[0].mahjongState).toMatchObject({
      formation: 'pung',
      ranks: [4, 4, 4],
      containedTileIds: ['anchor-tile'],
      whiteSlotIndices: [1, 2]
    })
    expect(state.functionTiles).toEqual(['white', 'white', 'red'])
  })

  it('rejects temporary towers without mutating any resource', () => {
    const anchor = createTower('anchor', 'dots', 2, 1)
    const temporary = createTower('temporary', 'dots', 2, 2)
    const state = createState([anchor, temporary], {
      storedTowerIds: [anchor.id],
      functionTiles: ['white']
    })

    const result = applySynthesizeMahjongAction(state, 'building', {
      anchorTowerId: anchor.id,
      materialTowerIds: [temporary.id],
      recipe: { formation: 'pung' },
      whiteCount: 1
    })

    expect(result).toEqual({
      ok: false,
      reason: 'invalid_entity_state',
      state
    })
    expect(result.state).toBe(state)
  })

  it('rejects a stale stored ID whose grid cell no longer owns the tower', () => {
    const anchor = createTower('anchor', 'dots', 2, 1)
    const material = createTower('material', 'dots', 2, 2)
    const state = createState([anchor, material])
    state.grid[1][2] = { row: 1, col: 2, type: 'empty' }

    const result = applySynthesizeMahjongAction(state, 'building', {
      anchorTowerId: anchor.id,
      materialTowerIds: [material.id],
      recipe: { formation: 'pair' }
    })

    expect(result).toEqual({
      ok: false,
      reason: 'invalid_entity_state',
      state
    })
    expect(result.state).toBe(state)
  })
})

describe('applyAttachMahjongHonorAction', () => {
  it('consumes one honor and attaches it to the canonical stored tower', () => {
    const tower = createTower('tower', 'characters', 1, 1)
    const state = createState([tower], { functionTiles: ['red', 'red'] })

    const result = applyAttachMahjongHonorAction(
      state,
      'ready',
      tower.id,
      'red'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.functionTiles).toEqual(['red'])
    expect(result.state.towers[0].mahjongState?.attachments).toEqual(['red'])
    expect(state.functionTiles).toEqual(['red', 'red'])
    expect(state.towers[0].mahjongState?.attachments).toEqual([])
  })

  it.each([
    'deciding',
    'resolving_hand',
    'playing',
    'paused',
    'game_over',
    'victory'
  ] as const)('rejects attachment during %s without consuming or mutating resources', gameStatus => {
    const tower = createTower('tower', 'characters', 1, 1)
    const state = createState([tower], { functionTiles: ['red', 'green'] })
    const before = structuredClone(state)

    const result = applyAttachMahjongHonorAction(
      state,
      gameStatus,
      tower.id,
      'red'
    )

    expect(result).toEqual({ ok: false, reason: 'invalid_phase', state })
    expect(result.state).toBe(state)
    expect(state).toEqual(before)
    expect(state.functionTiles).toEqual(['red', 'green'])
    expect(state.towers[0].mahjongState?.attachments).toEqual([])
  })

  it.each([
    ['red', 'already_attached'],
    ['green', 'attachment_capacity']
  ] as const)(
    'does not consume %s after a single reaches capacity',
    (attachment: MahjongAttachment, reason) => {
      const tower = createTower('tower', 'characters', 1, 1)
      tower.mahjongState!.attachments = ['red']
      const state = createState([tower], { functionTiles: ['red', 'green'] })

      const result = applyAttachMahjongHonorAction(
        state,
        'building',
        tower.id,
        attachment
      )

      expect(result).toEqual({ ok: false, reason, state })
      expect(result.state).toBe(state)
    }
  )
})

describe('applyRemoveMahjongWallAction', () => {
  it('charges 100 gold and returns the exact tile wall entity to the pool', () => {
    const tile = createTile('wall-tile', 'dots', 9)
    const state = createState([], {
      grid: createGrid([]),
      obstacleOrder: [{ row: 1, col: 3 }]
    })
    state.grid[1][3] = {
      row: 1,
      col: 3,
      type: 'obstacle',
      mahjongWallKind: 'tile',
      mahjongTile: tile
    }

    const result = applyRemoveMahjongWallAction(
      state,
      'ready',
      { row: 1, col: 3 }
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.returnedTileId).toBe(tile.id)
    expect(result.state.gold).toBe(100)
    expect(result.state.pool).toEqual([tile])
    expect(result.state.grid[1][3]).toEqual({ row: 1, col: 3, type: 'empty' })
    expect(result.state.obstacleOrder).toEqual([])
  })

  it('allows the returned tail tile to be randomly drawn like any other pool tile', () => {
    const returnedTile = createTile('returned-wall-tile', 'bamboo', 6)
    const existingPool = [
      createTile('pool-a', 'characters', 1),
      createTile('pool-b', 'dots', 2),
      createTile('pool-c', 'bamboo', 3),
      createTile('pool-d', 'characters', 4),
      createTile('pool-e', 'dots', 5)
    ]
    const state = createState([], {
      pool: existingPool,
      grid: createGrid([]),
      obstacleOrder: [{ row: 1, col: 3 }]
    })
    state.grid[1][3] = {
      row: 1,
      col: 3,
      type: 'obstacle',
      mahjongWallKind: 'tile',
      mahjongTile: returnedTile
    }

    const removal = applyRemoveMahjongWallAction(
      state,
      'ready',
      { row: 1, col: 3 }
    )

    expect(removal.ok).toBe(true)
    if (!removal.ok) return
    expect(removal.state.pool.at(-1)).toBe(returnedTile)

    const nextRound = beginMahjongRound(removal.state.pool, null, () => .999999)

    expect(nextRound.roundTiles[0]).toEqual({
      id: returnedTile.id,
      source: 'draw',
      tile: returnedTile
    })
    expect(nextRound.pool).not.toContain(returnedTile)
  })

  it('charges 50 gold for a pure wall without creating a tile', () => {
    const state = createState([], {
      gold: 50,
      grid: createGrid([]),
      obstacleOrder: [{ row: 1, col: 3 }]
    })
    state.grid[1][3] = {
      row: 1,
      col: 3,
      type: 'obstacle',
      mahjongWallKind: 'pure'
    }

    const result = applyRemoveMahjongWallAction(
      state,
      'building',
      { row: 1, col: 3 }
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.returnedTileId).toBeNull()
    expect(result.state.gold).toBe(0)
    expect(result.state.pool).toEqual([])
  })
})

describe('production Mahjong ownership orchestration', () => {
  it('conserves all 108 entities through activation, wall+white chow, honors and removals', () => {
    let tileSequence = 0
    const universe = createMahjongTilePool(() => `entity-${tileSequence++}`)
    const firstRound = beginMahjongRound(universe, null, () => 0)
    const anchorResource = firstRound.roundTiles[0]
    const ordinaryWallResource = firstRound.roundTiles[1]
    const chowWallResource = firstRound.roundTiles[4]
    const placedResources = [
      anchorResource,
      chowWallResource,
      ordinaryWallResource
    ]
    const placedTowers = placedResources.map((resource, index) => {
      const stats = createMahjongRandomStats(resource.tile.suit, () => 0)
      const tower = createTowerFromTile(
        `placed-${index}`,
        resource.tile,
        index + 1,
        stats.damage
      )
      tower.mahjongState = createSingleMahjongTowerState(resource.tile, stats)
      tower.range = stats.attackRange
      tower.attackSpeed = stats.attackIntervalMs
      return tower
    })
    let roundTiles = firstRound.roundTiles.filter(resource => (
      !placedResources.some(placed => placed.id === resource.id)
    ))
    let heldTile: MahjongNumberTile | null = null
    let state = createState(placedTowers, {
      storedTowerIds: [],
      pool: firstRound.pool,
      functionTiles: ['white', 'red', 'green'],
      gold: 250
    })

    // Geometric placement is covered by building.test.ts. From the placed batch
    // onward this test uses the same production actions called by useGameEngine.
    expectConserved(universe, state, roundTiles, heldTile)

    const finalized = applyFinalizeMahjongBatchAction(
      state,
      placedTowers.map(tower => tower.id),
      placedTowers[0].id
    )
    expect(finalized.ok).toBe(true)
    if (!finalized.ok) return
    state = finalized.state
    expectConserved(universe, state, roundTiles, heldTile)

    const ordinaryWall = state.grid[1][3]
    expect(ordinaryWall).toMatchObject({
      type: 'obstacle',
      mahjongWallKind: 'tile',
      mahjongTile: ordinaryWallResource.tile
    })
    expect(ordinaryWall).not.toHaveProperty('mahjongState')
    expect(ordinaryWall.mahjongTile).not.toHaveProperty('originalStats')

    heldTile = roundTiles[0].tile
    state = {
      ...state,
      pool: [...state.pool, roundTiles[1].tile]
    }
    roundTiles = []
    expectConserved(universe, state, roundTiles, heldTile)

    const ownershipBeforeFailure = auditMahjongOwnership({
      universe,
      pool: state.pool,
      roundTiles,
      heldTile,
      towers: state.towers,
      grid: state.grid
    })
    const stateBeforeFailure = structuredClone(state)
    const failedSynthesis = applySynthesizeMahjongAction(state, 'ready', {
      anchorTowerId: placedTowers[0].id,
      wallPositions: [{ row: 1, col: 3 }],
      recipe: { formation: 'chow', ranks: [1, 2, 3] },
      whiteCount: 1
    })
    expect(failedSynthesis.ok).toBe(false)
    expect(failedSynthesis.state).toBe(state)
    expect(state).toEqual(stateBeforeFailure)
    expect(auditMahjongOwnership({
      universe,
      pool: failedSynthesis.state.pool,
      roundTiles,
      heldTile,
      towers: failedSynthesis.state.towers,
      grid: failedSynthesis.state.grid
    })).toEqual(ownershipBeforeFailure)

    const synthesized = applySynthesizeMahjongAction(state, 'ready', {
      anchorTowerId: placedTowers[0].id,
      wallPositions: [{ row: 1, col: 2 }],
      recipe: { formation: 'chow', ranks: [1, 2, 3] },
      whiteCount: 1
    })
    expect(synthesized.ok).toBe(true)
    if (!synthesized.ok) return
    state = synthesized.state
    expect(state.towers[0].mahjongState).toMatchObject({
      formation: 'chow',
      containedTileIds: [anchorResource.tile.id, chowWallResource.tile.id],
      activeSources: [{ tileId: anchorResource.tile.id }],
      whiteSlotIndices: [2]
    })
    expect(state.grid[1][2]).toEqual({
      row: 1,
      col: 2,
      type: 'obstacle',
      mahjongWallKind: 'pure'
    })
    expectConserved(universe, state, roundTiles, heldTile)

    for (const attachment of ['red', 'green'] as const) {
      const attached = applyAttachMahjongHonorAction(
        state,
        'ready',
        placedTowers[0].id,
        attachment
      )
      expect(attached.ok).toBe(true)
      if (!attached.ok) return
      state = attached.state
      expectConserved(universe, state, roundTiles, heldTile)
    }
    expect(state.towers[0].mahjongState?.attachments).toEqual(['red', 'green'])
    expect(state.functionTiles).toEqual([])

    const removedTileWall = applyRemoveMahjongWallAction(
      state,
      'ready',
      { row: 1, col: 3 }
    )
    expect(removedTileWall.ok).toBe(true)
    if (!removedTileWall.ok) return
    state = removedTileWall.state
    expect(removedTileWall.returnedTileId).toBe(ordinaryWallResource.tile.id)
    const returnedTile = state.pool.find(tile => tile.id === ordinaryWallResource.tile.id)
    expect(returnedTile).toBe(ordinaryWallResource.tile)
    expect(returnedTile).not.toHaveProperty('originalStats')
    expectConserved(universe, state, roundTiles, heldTile)

    const removedPureWall = applyRemoveMahjongWallAction(
      state,
      'building',
      { row: 1, col: 2 }
    )
    expect(removedPureWall.ok).toBe(true)
    if (!removedPureWall.ok) return
    state = removedPureWall.state
    expect(removedPureWall.returnedTileId).toBeNull()
    expectConserved(universe, state, roundTiles, heldTile)

    const nextRound = beginMahjongRound(state.pool, heldTile, () => 0)
    state = { ...state, pool: nextRound.pool }
    heldTile = null
    roundTiles = nextRound.roundTiles
    const finalAudit = expectConserved(universe, state, roundTiles, heldTile)
    expect(finalAudit).toMatchObject({
      expectedEntityCount: 108,
      ownedEntityCount: 108,
      duplicates: [],
      missing: [],
      unknown: [],
      conserved: true
    })
  })

  it('conserves 108 entities through a multi-white pung synthesis', () => {
    let tileSequence = 0
    const universe = createMahjongTilePool(() => `entity-${tileSequence++}`)
    const firstRound = beginMahjongRound(universe, null, () => 0)
    const anchorResource = firstRound.roundTiles[0]
    const stats = createMahjongRandomStats(anchorResource.tile.suit, () => 0)
    const anchorTower = createTowerFromTile(
      'placed-anchor',
      anchorResource.tile,
      1,
      stats.damage
    )
    anchorTower.mahjongState = createSingleMahjongTowerState(anchorResource.tile, stats)
    const roundTiles = firstRound.roundTiles.filter(resource => (
      resource.id !== anchorResource.id
    ))
    let state = createState([anchorTower], {
      storedTowerIds: ['placed-anchor'],
      pool: firstRound.pool,
      functionTiles: ['white', 'white'],
      gold: 250
    })
    expectConserved(universe, state, roundTiles, null)

    const synthesized = applySynthesizeMahjongAction(state, 'ready', {
      anchorTowerId: 'placed-anchor',
      recipe: { formation: 'pung' },
      whiteCount: 2
    })
    expect(synthesized.ok).toBe(true)
    if (!synthesized.ok) return
    state = synthesized.state
    expect(state.functionTiles).toEqual([])
    expect(state.towers[0].mahjongState).toMatchObject({
      formation: 'pung',
      containedTileIds: [anchorResource.tile.id],
      whiteSlotIndices: [1, 2]
    })

    const audit = expectConserved(universe, state, roundTiles, null)
    expect(audit).toMatchObject({
      expectedEntityCount: 108,
      ownedEntityCount: 108,
      duplicates: [],
      missing: [],
      unknown: [],
      conserved: true
    })
  })
})

describe('Mahjong honor gamble ledger', () => {
  it('returns all three staked tiles to the pool and conserves 108 entities', () => {
    let tileSequence = 0
    const universe = createMahjongTilePool(() => `entity-${tileSequence++}`)
    // 上一回合留下的手牌加上本回合摸的五张，落三张后只剩 1 手牌 + 2 暗牌可赌。
    const round = beginMahjongRound(universe.slice(1), universe[0], () => 0)
    const stakedTiles = round.roundTiles.slice(0, 3)
    const poolBeforeGamble = [
      ...round.pool,
      ...round.roundTiles.slice(3).map(resource => resource.tile)
    ]
    let roundTiles: MahjongRoundTile[] = stakedTiles
    let heldTile: MahjongNumberTile | null = null
    const state = createState([], { pool: poolBeforeGamble, functionTiles: [] })

    expect(canGambleForMahjongHonor(roundTiles)).toBe(true)
    expectConserved(universe, state, roundTiles, heldTile)

    // 模拟 gambleForMahjongHonor 的资源结算：三张实体回池、heldTile 归零、得到一张功能牌。
    state.pool = [...state.pool, ...roundTiles.map(resource => resource.tile)]
    state.functionTiles = [...state.functionTiles, 'red']
    roundTiles = []
    heldTile = null

    expect(state.functionTiles).toEqual(['red'])
    const audit = auditMahjongOwnership({
      universe,
      pool: state.pool,
      roundTiles,
      heldTile,
      towers: state.towers,
      grid: state.grid
    })
    expect(audit).toMatchObject({
      expectedEntityCount: 108,
      ownedEntityCount: 108,
      duplicates: [],
      missing: [],
      unknown: [],
      conserved: true
    })
  })
})
