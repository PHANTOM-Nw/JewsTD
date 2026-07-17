import { describe, expect, it } from 'vitest'
import type { MahjongNumberTile, MahjongRoundTile } from '../types/game'
import {
  beginMahjongRound,
  createMahjongRandomStats,
  createMahjongTilePool,
  isMahjongHonorDrawRound,
  MAHJONG_BAMBOO_LAYOUTS,
  MAHJONG_DOT_LAYOUTS,
  MAHJONG_DRAWS_PER_ROUND,
  MAHJONG_FORMATION_MECHANICS,
  MAHJONG_FORMATION_MULTIPLIERS,
  MAHJONG_GREEN_ATTACHMENT_CONFIG,
  MAHJONG_HONOR_DRAW_INTERVAL_ROUNDS,
  MAHJONG_HONOR_DRAW_SUCCESS_CHANCE,
  MAHJONG_RANKS,
  MAHJONG_RED_ATTACHMENT_CONFIG,
  MAHJONG_SUIT_COMBAT_CONFIG,
  MAHJONG_WHITE_CATALYST_CONFIG,
  resolveMahjongHonorDraw,
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

  it('uses opaque identities that do not encode a tile face', () => {
    const pool = createMahjongTilePool()

    for (const tile of pool) {
      expect(tile.id).toMatch(/^mahjong-tile-/)
      expect(tile.id).not.toContain(tile.suit)
      expect(tile.id).not.toMatch(/^(characters|bamboo|dots)-[1-9]-[1-4]$/)
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
    expect(views[1]).not.toHaveProperty('stats')
  })

  it('reveals newly drawn suits only when the reveal parameter is set', () => {
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

describe('mahjong v0.1 combat configuration', () => {
  it.each([
    ['characters', [30, 900, 115], [38, 1200, 140]],
    ['bamboo', [13, 450, 125], [19, 650, 155]],
    ['dots', [20, 900, 110], [28, 1200, 135]]
  ] as const)('rolls %s stats independently on integer closed intervals', (
    suit,
    minimum,
    maximum
  ) => {
    expect(createMahjongRandomStats(suit, () => 0)).toEqual({
      damage: minimum[0],
      attackIntervalMs: minimum[1],
      attackRange: minimum[2]
    })
    expect(createMahjongRandomStats(suit, () => 1)).toEqual({
      damage: maximum[0],
      attackIntervalMs: maximum[1],
      attackRange: maximum[2]
    })

    const rolls = [0, 1, .5]
    expect(createMahjongRandomStats(suit, () => rolls.shift()!)).toEqual({
      damage: minimum[0],
      attackIntervalMs: maximum[1],
      attackRange: minimum[2] + Math.floor((maximum[2] - minimum[2] + 1) / 2)
    })
  })

  it('keeps suit, formation and honor values in the Mahjong configuration', () => {
    expect(MAHJONG_SUIT_COMBAT_CONFIG.characters.baseMechanics.crit).toEqual({
      chance: .15,
      multiplier: 2
    })
    expect(MAHJONG_FORMATION_MULTIPLIERS.kong).toEqual({
      damage: 2.7,
      attackFrequency: 1.4,
      attackRange: 1.2
    })
    expect(MAHJONG_FORMATION_MECHANICS.bamboo.pung.poison).toEqual({
      damagePerSecond: 7,
      durationMs: 4000,
      maxStacks: 3
    })
    expect(MAHJONG_FORMATION_MECHANICS.dots.kong.splash).toEqual({
      radius: 55,
      damageRatio: 1
    })
    expect(MAHJONG_RED_ATTACHMENT_CONFIG.burn.durationMs).toBe(3000)
    expect(MAHJONG_GREEN_ATTACHMENT_CONFIG).toEqual({
      characters: {
        executeHealthRatio: .12,
        bossExecuteHealthRatio: .05
      },
      bamboo: {
        attackFrequencyBonusPerHit: .03,
        maxStacks: 10,
        resetAfterMs: 2000
      },
      dots: {
        stunChance: .12,
        stunDurationMs: 800,
        bossStunDurationMs: 350
      }
    })
    expect(MAHJONG_WHITE_CATALYST_CONFIG).toEqual({
      allowedFormations: ['chow', 'pung', 'kong'],
      contributesRandomStats: false,
      canBeAnchor: false,
      consumedOnUse: true
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

describe('scheduled Mahjong honor draw', () => {
  function sequenceRandom(values: readonly number[]): () => number {
    let index = 0
    return () => values[index++] ?? 0
  }

  it('schedules only build rounds 2, 4, 6, 8, 10 and 12', () => {
    expect(MAHJONG_HONOR_DRAW_INTERVAL_ROUNDS).toBe(2)
    expect(Array.from({ length: 12 }, (_, index) => index + 1)
      .filter(isMahjongHonorDrawRound)).toEqual([2, 4, 6, 8, 10, 12])
    expect(isMahjongHonorDrawRound(0)).toBe(false)
    expect(isMahjongHonorDrawRound(2.5)).toBe(false)
  })

  it('uses a fixed 50% boundary independent of number tiles', () => {
    expect(MAHJONG_HONOR_DRAW_SUCCESS_CHANCE).toBe(.5)
    expect(resolveMahjongHonorDraw(sequenceRandom([.49, .999999999]))).toEqual({
      success: true,
      honor: 'white'
    })
    expect(resolveMahjongHonorDraw(sequenceRandom([.5]))).toEqual({
      success: false,
      honor: null
    })
  })

  it.each([
    [0, 'red'],
    [.34, 'green'],
    [.999999999, 'white']
  ] as const)('awards %s of the honor interval as %s after success', (honorRoll, honor) => {
    expect(resolveMahjongHonorDraw(sequenceRandom([0, honorRoll]))).toEqual({
      success: true,
      honor
    })
  })

  it('does not consume an honor-selection roll after failure', () => {
    let calls = 0
    expect(resolveMahjongHonorDraw(() => {
      calls += 1
      return .5
    })).toEqual({ success: false, honor: null })
    expect(calls).toBe(1)
  })
})
