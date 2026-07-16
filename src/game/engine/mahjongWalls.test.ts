import { describe, expect, it } from 'vitest'
import { ECONOMY_CONFIG } from '../config/economy'
import type { MahjongNumberTile } from '../types/game'
import {
  planMahjongWallRemoval,
  type MahjongRemovableWall
} from './mahjongWalls'

function createTile(id: string): MahjongNumberTile {
  return {
    id,
    suit: 'characters',
    rank: 5,
    copy: 1
  }
}

function createTileWall(tile = createTile('wall-tile')): MahjongRemovableWall {
  return {
    row: 3,
    col: 4,
    type: 'obstacle',
    mahjongWallKind: 'tile',
    mahjongTile: tile
  }
}

function createPureWall(): MahjongRemovableWall {
  return {
    row: 5,
    col: 6,
    type: 'obstacle',
    mahjongWallKind: 'pure'
  }
}

describe('mahjong wall removal transaction', () => {
  it('charges 100 gold and returns a tile wall entity to the draw pool', () => {
    const pool = [createTile('pool-tile')]
    const wall = createTileWall()

    const result = planMahjongWallRemoval({
      gameStatus: 'building',
      wall,
      gold: 135,
      pool
    })

    expect(ECONOMY_CONFIG.mahjongTileWallRemovalGoldCost).toBe(100)
    expect(result).toEqual({
      ok: true,
      plan: {
        position: { row: 3, col: 4 },
        cost: 100,
        nextGold: 35,
        nextPool: [pool[0], wall.mahjongTile],
        clearedCell: { row: 3, col: 4, type: 'empty' },
        returnedTile: wall.mahjongTile
      }
    })
    expect(pool).toHaveLength(1)
    expect(wall).toEqual(createTileWall())
  })

  it('charges 50 gold for a pure wall and returns no number tile', () => {
    const pool = [createTile('pool-tile')]
    const result = planMahjongWallRemoval({
      gameStatus: 'ready',
      wall: createPureWall(),
      gold: 75,
      pool
    })

    expect(ECONOMY_CONFIG.mahjongPureWallRemovalGoldCost).toBe(50)
    expect(result).toEqual({
      ok: true,
      plan: {
        position: { row: 5, col: 6 },
        cost: 50,
        nextGold: 25,
        nextPool: pool,
        clearedCell: { row: 5, col: 6, type: 'empty' },
        returnedTile: null
      }
    })
    expect(result.ok && result.plan.nextPool).not.toBe(pool)
  })

  it.each(['deciding', 'resolving_hand', 'playing', 'paused', 'game_over', 'victory'] as const)(
    'rejects removal during %s',
    gameStatus => {
      expect(planMahjongWallRemoval({
        gameStatus,
        wall: createPureWall(),
        gold: 100,
        pool: []
      })).toEqual({ ok: false, reason: 'invalid_phase' })
    }
  )

  it('rejects insufficient or invalid gold without changing inputs', () => {
    const wall = createTileWall()
    const pool = [createTile('pool-tile')]
    const before = structuredClone({ wall, pool })

    expect(planMahjongWallRemoval({
      gameStatus: 'building',
      wall,
      gold: 99,
      pool
    })).toEqual({ ok: false, reason: 'insufficient_gold' })
    expect(planMahjongWallRemoval({
      gameStatus: 'building',
      wall,
      gold: Number.NaN,
      pool
    })).toEqual({ ok: false, reason: 'invalid_gold' })
    expect({ wall, pool }).toEqual(before)
  })

  it.each([
    {
      name: 'a legacy obstacle without a Mahjong wall kind',
      wall: { row: 1, col: 1, type: 'obstacle' as const }
    },
    {
      name: 'a tile wall missing its tile entity',
      wall: {
        row: 1,
        col: 1,
        type: 'obstacle' as const,
        mahjongWallKind: 'tile' as const
      }
    },
    {
      name: 'a pure wall that still owns a tile',
      wall: {
        row: 1,
        col: 1,
        type: 'obstacle' as const,
        mahjongWallKind: 'pure' as const,
        mahjongTile: createTile('leaked-tile')
      }
    },
    {
      name: 'a non-obstacle cell',
      wall: {
        row: 1,
        col: 1,
        type: 'tower' as const,
        mahjongWallKind: 'pure' as const
      }
    },
    {
      name: 'an obstacle with a dangling tower identity',
      wall: {
        row: 1,
        col: 1,
        type: 'obstacle' as const,
        towerId: 'stale-tower',
        mahjongWallKind: 'pure' as const
      }
    }
  ])('rejects $name', ({ wall }) => {
    expect(planMahjongWallRemoval({
      gameStatus: 'ready',
      wall,
      gold: 100,
      pool: []
    })).toEqual({ ok: false, reason: 'invalid_wall' })
  })

  it('rejects returning a number tile that is already in the pool', () => {
    const tile = createTile('duplicate')
    expect(planMahjongWallRemoval({
      gameStatus: 'building',
      wall: createTileWall(tile),
      gold: 100,
      pool: [{ ...tile }]
    })).toEqual({ ok: false, reason: 'duplicate_tile' })
  })

  it('rejects an already-corrupted pool even when removing a pure wall', () => {
    const tile = createTile('duplicate')
    expect(planMahjongWallRemoval({
      gameStatus: 'ready',
      wall: createPureWall(),
      gold: 50,
      pool: [tile, { ...tile }]
    })).toEqual({ ok: false, reason: 'duplicate_tile' })
  })
})
