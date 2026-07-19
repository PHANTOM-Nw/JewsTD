import { describe, expect, it } from 'vitest'
import type {
  GridCell,
  MahjongNumberTile,
  MahjongRoundTile,
  Tower
} from '../types/game'
import {
  assertMahjongOwnership,
  auditMahjongOwnership,
  MahjongOwnershipError,
  type MahjongOwnershipSnapshot
} from './mahjongOwnership'

function tile(id: string): MahjongNumberTile {
  return { id, suit: 'characters', rank: 1, copy: 1 }
}

function emptyGrid(): GridCell[][] {
  return [[
    { row: 0, col: 0, type: 'empty' },
    { row: 0, col: 1, type: 'empty' },
    { row: 0, col: 2, type: 'empty' }
  ]]
}

function snapshot(
  overrides: Partial<MahjongOwnershipSnapshot> = {}
): MahjongOwnershipSnapshot {
  const universe = ['pool', 'round', 'held', 'tower', 'wall'].map(tile)
  const roundTiles: MahjongRoundTile[] = [{
    id: 'round',
    source: 'draw',
    tile: universe[1]
  }]
  const towers: Tower[] = [{
    id: 'active',
    mahjongTile: universe[3],
    mahjongState: {
      formation: 'single',
      suit: 'characters',
      ranks: [1],
      containedTileIds: ['tower'],
      activeSources: [{
        tileId: 'tower',
        originalStats: { damage: 30, attackIntervalMs: 1000, attackRange: 120 }
      }],
      attachments: []
    },
    level: 'chipped',
    gridPosition: { row: 0, col: 0 },
    position: { x: 0, y: 0 },
    damage: 30,
    range: 120,
    attackSpeed: 1000,
    lastAttackTime: 0,
    damageType: 'physical'
  }]
  const grid = emptyGrid()
  grid[0][0] = { row: 0, col: 0, type: 'tower', towerId: 'active' }
  grid[0][1] = {
    row: 0,
    col: 1,
    type: 'obstacle',
    mahjongWallKind: 'tile',
    mahjongTile: universe[4]
  }
  grid[0][2] = {
    row: 0,
    col: 2,
    type: 'obstacle',
    mahjongWallKind: 'pure'
  }

  return {
    universe,
    pool: [universe[0]],
    roundTiles,
    heldTile: universe[2],
    towers,
    grid,
    ...overrides
  }
}

describe('Mahjong global ownership ledger', () => {
  it('counts every physical owner once and ignores references, pure walls and honors', () => {
    const audit = assertMahjongOwnership(snapshot())

    expect(audit).toMatchObject({
      expectedEntityCount: 5,
      ownedEntityCount: 5,
      duplicates: [],
      missing: [],
      unknown: [],
      duplicateUniverseIds: [],
      conserved: true
    })
    expect(audit.owners.get('tower')).toEqual([
      { kind: 'tower', towerId: 'active' }
    ])
    expect(audit.owners.has('red')).toBe(false)
    expect(audit.owners.size).toBe(5)
  })

  it('reports duplicate, missing and unknown IDs with their locations', () => {
    const base = snapshot()
    const unknown = tile('unknown')
    const audit = auditMahjongOwnership({
      ...base,
      pool: [base.universe[0], base.universe[3], unknown],
      heldTile: null
    })

    expect(audit.conserved).toBe(false)
    expect(audit.duplicates).toEqual([{
      tileId: 'tower',
      locations: [
        { kind: 'pool', index: 1 },
        { kind: 'tower', towerId: 'active' }
      ]
    }])
    expect(audit.missing).toEqual(['held'])
    expect(audit.unknown).toEqual([{
      tileId: 'unknown',
      locations: [{ kind: 'pool', index: 2 }]
    }])
    expect(() => assertMahjongOwnership({
      ...base,
      pool: [base.universe[0], base.universe[3], unknown],
      heldTile: null
    })).toThrow(MahjongOwnershipError)
  })

  it('conserves entities when a composite tower substitutes several white slots', () => {
    const universe = ['pool', 'anchor', 'held', 'wall'].map(tile)
    const towers: Tower[] = [{
      id: 'kong',
      mahjongTile: universe[1],
      mahjongState: {
        formation: 'kong',
        suit: 'characters',
        ranks: [1, 1, 1, 1],
        containedTileIds: ['anchor'],
        activeSources: [{
          tileId: 'anchor',
          originalStats: { damage: 30, attackIntervalMs: 1000, attackRange: 120 }
        }],
        attachments: [],
        whiteSlotIndices: [1, 2, 3]
      },
      level: 'chipped',
      gridPosition: { row: 0, col: 0 },
      position: { x: 0, y: 0 },
      damage: 30,
      range: 120,
      attackSpeed: 1000,
      lastAttackTime: 0,
      damageType: 'physical'
    }]
    const grid = emptyGrid()
    grid[0][0] = { row: 0, col: 0, type: 'tower', towerId: 'kong' }
    grid[0][1] = {
      row: 0,
      col: 1,
      type: 'obstacle',
      mahjongWallKind: 'tile',
      mahjongTile: universe[3]
    }

    const audit = assertMahjongOwnership({
      universe,
      pool: [universe[0]],
      roundTiles: [],
      heldTile: universe[2],
      towers,
      grid
    })

    expect(audit).toMatchObject({
      expectedEntityCount: 4,
      ownedEntityCount: 4,
      duplicates: [],
      missing: [],
      unknown: [],
      conserved: true
    })
    expect(audit.owners.get('anchor')).toEqual([{ kind: 'tower', towerId: 'kong' }])
  })

  it('rejects a registry that defines the same opaque ID twice', () => {
    const base = snapshot()
    const audit = auditMahjongOwnership({
      ...base,
      universe: [...base.universe, { ...base.universe[0] }]
    })

    expect(audit.conserved).toBe(false)
    expect(audit.duplicateUniverseIds).toEqual(['pool'])
  })
})
