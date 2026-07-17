import { describe, expect, it } from 'vitest'
import { beginMahjongRound, createMahjongTilePool } from '../config/mahjong'
import type { MahjongNumberTile, MahjongRoundTile } from '../types/game'
import { settleMahjongHand } from './mahjongRoundFlow'

function expectNumberTilesConserved(
  universe: readonly MahjongNumberTile[],
  placedTiles: readonly MahjongRoundTile[],
  pool: readonly MahjongNumberTile[],
  heldTile: MahjongNumberTile
) {
  const ownedIds = [
    ...placedTiles.map(resource => resource.tile.id),
    ...pool.map(tile => tile.id),
    heldTile.id
  ]

  expect(ownedIds).toHaveLength(universe.length)
  expect(new Set(ownedIds)).toHaveLength(universe.length)
  expect(new Set(ownedIds)).toEqual(new Set(universe.map(tile => tile.id)))
}

describe('Mahjong hand and scheduled honor draw settlement', () => {
  it('always keeps one tile on an odd round without reading the honor random source', () => {
    let sequence = 0
    const universe = createMahjongTilePool(() => `entity-${sequence++}`)
    const round = beginMahjongRound(universe, null, () => 0)
    const placedTiles = round.roundTiles.slice(0, 3)
    const remainingTiles = round.roundTiles.slice(3)

    const result = settleMahjongHand({
      pool: round.pool,
      roundTiles: remainingTiles,
      selectedTileId: remainingTiles[1].id,
      functionTiles: ['green'],
      roundNumber: 1,
      random: () => {
        throw new Error('odd rounds must not draw an honor')
      }
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.heldTile).toBe(remainingTiles[1].tile)
    expect(result.roundTiles).toEqual([])
    expect(result.functionTiles).toEqual(['green'])
    expect(result.honorDrawResult).toBeNull()
    expect(result.pool.at(-1)).toBe(remainingTiles[0].tile)
    expectNumberTilesConserved(universe, placedTiles, result.pool, result.heldTile)
  })

  it.each([
    ['旧手牌留在剩余牌中', false],
    ['旧手牌已用于建造', true]
  ] as const)('%s does not change the even-round 50%% draw', (_, placeOldHand) => {
    let sequence = 0
    const universe = createMahjongTilePool(() => `entity-${sequence++}`)
    const round = beginMahjongRound(universe.slice(1), universe[0], () => 0)
    const placedTiles = placeOldHand
      ? round.roundTiles.slice(0, 3)
      : round.roundTiles.slice(3, 6)
    const placedIds = new Set(placedTiles.map(resource => resource.id))
    const remainingTiles = round.roundTiles.filter(resource => !placedIds.has(resource.id))
    let randomCalls = 0
    const rolls = [0, 0]

    const result = settleMahjongHand({
      pool: round.pool,
      roundTiles: remainingTiles,
      selectedTileId: remainingTiles[1].id,
      functionTiles: ['white'],
      roundNumber: 2,
      random: () => {
        const value = rolls[randomCalls]
        randomCalls += 1
        return value
      }
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(randomCalls).toBe(2)
    expect(result.honorDrawResult).toBe('success')
    expect(result.functionTiles).toEqual(['white', 'red'])
    expect(result.heldTile).toBe(remainingTiles[1].tile)
    expectNumberTilesConserved(universe, placedTiles, result.pool, result.heldTile)
  })

  it('keeps the selected hand and all number tiles when an even-round draw fails', () => {
    let sequence = 0
    const universe = createMahjongTilePool(() => `entity-${sequence++}`)
    const round = beginMahjongRound(universe, null, () => 0)
    const placedTiles = round.roundTiles.slice(0, 3)
    const remainingTiles = round.roundTiles.slice(3)

    const result = settleMahjongHand({
      pool: round.pool,
      roundTiles: remainingTiles,
      selectedTileId: remainingTiles[0].id,
      functionTiles: ['green'],
      roundNumber: 12,
      random: () => .5
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.honorDrawResult).toBe('failure')
    expect(result.functionTiles).toEqual(['green'])
    expect(result.heldTile).toBe(remainingTiles[0].tile)
    expectNumberTilesConserved(universe, placedTiles, result.pool, result.heldTile)
  })

  it('rejects an unknown hand choice without mutating the supplied collections', () => {
    const universe = createMahjongTilePool()
    const round = beginMahjongRound(universe, null, () => 0)
    const poolBefore = [...round.pool]
    const roundTilesBefore = [...round.roundTiles]
    const functionTiles = ['red'] as const

    expect(settleMahjongHand({
      pool: round.pool,
      roundTiles: round.roundTiles,
      selectedTileId: 'missing',
      functionTiles,
      roundNumber: 2,
      random: () => 0
    })).toEqual({ ok: false, reason: 'tile_not_found' })
    expect(round.pool).toEqual(poolBefore)
    expect(round.roundTiles).toEqual(roundTilesBefore)
    expect(functionTiles).toEqual(['red'])
  })
})
