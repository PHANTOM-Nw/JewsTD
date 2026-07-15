import { describe, expect, it } from 'vitest'
import type { MahjongNumberTile, MahjongRoundTile } from '../types/game'
import {
  beginMahjongRound,
  canGambleForMahjongHonor,
  createMahjongTilePool,
  MAHJONG_BAMBOO_LAYOUTS,
  MAHJONG_DOT_LAYOUTS,
  MAHJONG_DRAWS_PER_ROUND,
  MAHJONG_RANKS,
  resolveMahjongHonorGamble,
  toMahjongRoundTileViews
} from './mahjong'

function toRoundTile(
  tile: MahjongNumberTile,
  source: MahjongRoundTile['source']
): MahjongRoundTile {
  return { id: tile.id, source, tile }
}

describe('mahjong number tile pool', () => {
  it('contains 108 unique physical tiles across 27 faces with four copies each', () => {
    const pool = createMahjongTilePool()
    const tilesByFace = new Map<string, MahjongNumberTile[]>()

    for (const tile of pool) {
      const faceKey = `${tile.suit}-${tile.rank}`
      tilesByFace.set(faceKey, [...(tilesByFace.get(faceKey) ?? []), tile])
    }

    expect(pool).toHaveLength(108)
    expect(new Set(pool.map(tile => tile.id))).toHaveLength(108)
    expect(tilesByFace.size).toBe(27)

    for (const faceTiles of tilesByFace.values()) {
      expect(faceTiles).toHaveLength(4)
      expect(faceTiles.map(tile => tile.copy).sort()).toEqual([1, 2, 3, 4])
    }
  })

  it('draws five new tiles for a round', () => {
    const pool = createMahjongTilePool()
    const round = beginMahjongRound(pool, null, () => 0)

    expect(MAHJONG_DRAWS_PER_ROUND).toBe(5)
    expect(round.roundTiles).toHaveLength(5)
    expect(round.roundTiles.every(resource => resource.source === 'draw')).toBe(true)
    expect(round.pool).toHaveLength(103)
  })

  it('combines one old hand tile with five newly drawn tiles', () => {
    const [heldTile, ...pool] = createMahjongTilePool()
    const round = beginMahjongRound(pool, heldTile, () => 0)

    expect(round.roundTiles).toHaveLength(6)
    expect(round.roundTiles[0]).toEqual({
      id: heldTile.id,
      source: 'hand',
      tile: heldTile
    })
    expect(round.roundTiles.slice(1).every(resource => resource.source === 'draw')).toBe(true)
    expect(round.pool).toHaveLength(102)
  })
})

describe('mahjong hidden information', () => {
  it('does not leak a drawn tile suit, rank, copy or underlying entity', () => {
    const [heldTile, drawnTile] = createMahjongTilePool()
    const views = toMahjongRoundTileViews([
      toRoundTile(heldTile, 'hand'),
      toRoundTile(drawnTile, 'draw')
    ])

    expect(views[0]).toEqual({
      id: heldTile.id,
      source: 'hand',
      visibility: 'suit',
      suit: heldTile.suit
    })
    expect(views[1]).toEqual({
      id: drawnTile.id,
      source: 'draw',
      visibility: 'hidden',
      suit: undefined
    })
    expect(views[1]).not.toHaveProperty('rank')
    expect(views[1]).not.toHaveProperty('copy')
    expect(views[1]).not.toHaveProperty('tile')
  })

  it('reveals newly drawn suits only after the player chooses hand keeping', () => {
    const pool = createMahjongTilePool()
    const heldTile = pool.find(tile => tile.suit === 'characters')!
    const drawnTiles = [
      pool.find(tile => tile.suit === 'bamboo')!,
      pool.find(tile => tile.suit === 'dots')!
    ]
    const roundTiles = [
      toRoundTile(heldTile, 'hand'),
      ...drawnTiles.map(tile => toRoundTile(tile, 'draw'))
    ]

    const choosingViews = toMahjongRoundTileViews(roundTiles)
    expect(choosingViews).toEqual([
      {
        id: heldTile.id,
        source: 'hand',
        visibility: 'suit',
        suit: 'characters'
      },
      {
        id: drawnTiles[0].id,
        source: 'draw',
        visibility: 'hidden',
        suit: undefined
      },
      {
        id: drawnTiles[1].id,
        source: 'draw',
        visibility: 'hidden',
        suit: undefined
      }
    ])

    const keepingViews = toMahjongRoundTileViews(roundTiles, true)
    expect(keepingViews.map(view => ({
      source: view.source,
      visibility: view.visibility,
      suit: view.suit
    }))).toEqual([
      { source: 'hand', visibility: 'suit', suit: 'characters' },
      { source: 'draw', visibility: 'suit', suit: 'bamboo' },
      { source: 'draw', visibility: 'suit', suit: 'dots' }
    ])
    keepingViews.forEach(view => {
      expect(view).not.toHaveProperty('rank')
      expect(view).not.toHaveProperty('tile')
    })
  })
})

describe('mahjong face layouts', () => {
  it('uses exactly one face mark per dot or bamboo shown by its rank', () => {
    for (const rank of MAHJONG_RANKS) {
      expect(MAHJONG_DOT_LAYOUTS[rank]).toHaveLength(rank)
      expect(MAHJONG_BAMBOO_LAYOUTS[rank]).toHaveLength(rank)
    }
  })

  it('represents the one-bamboo bird as one face mark', () => {
    expect(MAHJONG_BAMBOO_LAYOUTS[1]).toHaveLength(1)
  })

  it('uses the standard dot arrangements and color groups', () => {
    expect(MAHJONG_DOT_LAYOUTS[2]).toEqual([
      { x: .5, y: .28, color: 'blue' },
      { x: .5, y: .72, color: 'green' }
    ])
    expect(MAHJONG_DOT_LAYOUTS[7].map(mark => mark.color)).toEqual([
      'green', 'green', 'green', 'red', 'red', 'red', 'red'
    ])
    expect(MAHJONG_DOT_LAYOUTS[8].every(mark => mark.color === 'blue')).toBe(true)
    expect(MAHJONG_DOT_LAYOUTS[9].map(mark => mark.color)).toEqual([
      'blue', 'blue', 'blue', 'red', 'red', 'red', 'green', 'green', 'green'
    ])
  })

  it('uses the standard bamboo groups, including crossed eight-bamboo marks', () => {
    expect(MAHJONG_BAMBOO_LAYOUTS[6].map(mark => [mark.x, mark.y])).toEqual([
      [.25, .3], [.5, .3], [.75, .3], [.25, .72], [.5, .72], [.75, .72]
    ])
    expect(MAHJONG_BAMBOO_LAYOUTS[7][0]).toEqual({ x: .5, y: .18, color: 'red' })
    expect(MAHJONG_BAMBOO_LAYOUTS[7].slice(1).every(mark => mark.color === 'green')).toBe(true)
    expect(MAHJONG_BAMBOO_LAYOUTS[8].map(mark => mark.rotation ?? 0)).toEqual([
      0, -42, 42, 0, 0, 42, -42, 0
    ])
    expect(MAHJONG_BAMBOO_LAYOUTS[9].map(mark => mark.color)).toEqual([
      'green', 'red', 'green', 'green', 'red', 'green', 'green', 'red', 'green'
    ])
  })
})

describe('mahjong honor gamble', () => {
  const pool = createMahjongTilePool()
  const sameSuitTiles = pool.filter(tile => tile.suit === 'characters').slice(0, 3)
  const validRoundTiles = [
    toRoundTile(sameSuitTiles[0], 'hand'),
    toRoundTile(sameSuitTiles[1], 'draw'),
    toRoundTile(sameSuitTiles[2], 'draw')
  ]

  it.each([
    [0, 'red'],
    [0.5, 'green'],
    [0.999999999, 'white']
  ] as const)('awards a deterministic honor for a same-suit gamble at %f', (random, honor) => {
    expect(canGambleForMahjongHonor(validRoundTiles)).toBe(true)
    expect(resolveMahjongHonorGamble(validRoundTiles, () => random)).toEqual({
      success: true,
      honor
    })
  })

  it('fails a structurally valid gamble when the three suits do not match', () => {
    const mismatchedRoundTiles = [
      validRoundTiles[0],
      validRoundTiles[1],
      toRoundTile(pool.find(tile => tile.suit === 'dots')!, 'draw')
    ]

    expect(canGambleForMahjongHonor(mismatchedRoundTiles)).toBe(true)
    expect(resolveMahjongHonorGamble(mismatchedRoundTiles, () => 0)).toEqual({
      success: false,
      honor: null
    })
  })

  it.each<[MahjongRoundTile[]]>([
    [validRoundTiles.slice(0, 2)],
    [validRoundTiles.map(resource => ({ ...resource, source: 'draw' as const }))]
  ])('rejects an invalid gamble input', invalidRoundTiles => {
    expect(canGambleForMahjongHonor(invalidRoundTiles)).toBe(false)
    expect(resolveMahjongHonorGamble(invalidRoundTiles, () => 0)).toEqual({
      success: false,
      honor: null
    })
  })
})
