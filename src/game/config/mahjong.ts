import type {
  MahjongHonor,
  MahjongNumberTile,
  MahjongRank,
  MahjongRoundTile,
  MahjongRoundTileView,
  MahjongSuit
} from '../types/game'

export const MAHJONG_SUITS: readonly MahjongSuit[] = ['characters', 'bamboo', 'dots']
export const MAHJONG_RANKS: readonly MahjongRank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
export const MAHJONG_HONORS: readonly MahjongHonor[] = ['red', 'green', 'white']
export const MAHJONG_DRAWS_PER_ROUND = 5
export const MAHJONG_BUILDS_PER_ROUND = 3

export const MAHJONG_SUIT_LABELS: Record<MahjongSuit, string> = {
  characters: '万',
  bamboo: '条',
  dots: '筒'
}

export const MAHJONG_HONOR_LABELS: Record<MahjongHonor, string> = {
  red: '中',
  green: '發',
  white: '白板'
}

export const MAHJONG_CHARACTER_NUMERALS: Record<MahjongRank, string> = {
  1: '一', 2: '二', 3: '三', 4: '四', 5: '五',
  6: '六', 7: '七', 8: '八', 9: '九'
}

export interface FaceMark {
  x: number
  y: number
  color: 'red' | 'green' | 'blue'
  rotation?: number
}

const mark = (
  x: number,
  y: number,
  color: FaceMark['color'],
  rotation?: number
): FaceMark => ({ x, y, color, ...(rotation === undefined ? {} : { rotation }) })

/** 统一供 Canvas 与 React 使用，数组长度永远等于筒子点数。 */
export const MAHJONG_DOT_LAYOUTS: Record<MahjongRank, readonly FaceMark[]> = {
  1: [mark(.5, .5, 'red')],
  2: [mark(.5, .28, 'blue'), mark(.5, .72, 'green')],
  3: [mark(.3, .24, 'blue'), mark(.5, .5, 'red'), mark(.7, .76, 'green')],
  4: [mark(.32, .3, 'green'), mark(.68, .3, 'blue'), mark(.32, .7, 'blue'), mark(.68, .7, 'green')],
  5: [mark(.3, .27, 'green'), mark(.7, .27, 'blue'), mark(.5, .5, 'red'), mark(.3, .73, 'blue'), mark(.7, .73, 'green')],
  6: [mark(.32, .22, 'green'), mark(.68, .22, 'green'), mark(.32, .5, 'red'), mark(.68, .5, 'red'), mark(.32, .78, 'red'), mark(.68, .78, 'red')],
  7: [mark(.27, .18, 'green'), mark(.5, .32, 'green'), mark(.73, .46, 'green'), mark(.34, .66, 'red'), mark(.66, .66, 'red'), mark(.34, .84, 'red'), mark(.66, .84, 'red')],
  8: [mark(.32, .17, 'blue'), mark(.68, .17, 'blue'), mark(.32, .39, 'blue'), mark(.68, .39, 'blue'), mark(.32, .61, 'blue'), mark(.68, .61, 'blue'), mark(.32, .83, 'blue'), mark(.68, .83, 'blue')],
  9: [mark(.25, .2, 'blue'), mark(.5, .2, 'blue'), mark(.75, .2, 'blue'), mark(.25, .5, 'red'), mark(.5, .5, 'red'), mark(.75, .5, 'red'), mark(.25, .8, 'green'), mark(.5, .8, 'green'), mark(.75, .8, 'green')]
}

/** 一条使用传统鸟图，其余数组长度永远等于竹节数量。 */
export const MAHJONG_BAMBOO_LAYOUTS: Record<MahjongRank, readonly FaceMark[]> = {
  1: [mark(.5, .5, 'green')],
  2: [mark(.5, .3, 'green'), mark(.5, .7, 'green')],
  3: [mark(.5, .22, 'green'), mark(.32, .72, 'green'), mark(.68, .72, 'green')],
  4: [mark(.32, .28, 'green'), mark(.68, .28, 'green'), mark(.32, .72, 'green'), mark(.68, .72, 'green')],
  5: [mark(.3, .23, 'green'), mark(.7, .23, 'green'), mark(.5, .5, 'red'), mark(.3, .77, 'green'), mark(.7, .77, 'green')],
  6: [mark(.25, .3, 'green'), mark(.5, .3, 'green'), mark(.75, .3, 'green'), mark(.25, .72, 'green'), mark(.5, .72, 'green'), mark(.75, .72, 'green')],
  7: [mark(.5, .18, 'red'), mark(.25, .5, 'green'), mark(.5, .5, 'green'), mark(.75, .5, 'green'), mark(.25, .8, 'green'), mark(.5, .8, 'green'), mark(.75, .8, 'green')],
  8: [mark(.22, .3, 'green'), mark(.44, .3, 'green', -42), mark(.56, .3, 'green', 42), mark(.78, .3, 'green'), mark(.22, .72, 'green'), mark(.44, .72, 'green', 42), mark(.56, .72, 'green', -42), mark(.78, .72, 'green')],
  9: [mark(.25, .2, 'green'), mark(.5, .2, 'red'), mark(.75, .2, 'green'), mark(.25, .5, 'green'), mark(.5, .5, 'red'), mark(.75, .5, 'green'), mark(.25, .8, 'green'), mark(.5, .8, 'red'), mark(.75, .8, 'green')]
}

export const MAHJONG_BASE_TOWER_STATS = {
  damage: 24,
  range: 125,
  attackSpeed: 900,
  damageType: 'physical' as const
}

export function createMahjongTilePool(): MahjongNumberTile[] {
  return MAHJONG_SUITS.flatMap(suit => MAHJONG_RANKS.flatMap(rank => (
    ([1, 2, 3, 4] as const).map(copy => ({
      id: `${suit}-${rank}-${copy}`,
      suit,
      rank,
      copy
    }))
  )))
}

export function drawMahjongTiles(
  pool: readonly MahjongNumberTile[],
  count: number,
  random: () => number = Math.random
): { pool: MahjongNumberTile[]; drawn: MahjongNumberTile[] } {
  const nextPool = [...pool]
  const drawn: MahjongNumberTile[] = []
  const drawCount = Math.min(Math.max(0, Math.floor(count)), nextPool.length)

  for (let index = 0; index < drawCount; index += 1) {
    const selectedIndex = Math.min(
      nextPool.length - 1,
      Math.floor(Math.max(0, Math.min(.999999999, random())) * nextPool.length)
    )
    drawn.push(nextPool.splice(selectedIndex, 1)[0])
  }

  return { pool: nextPool, drawn }
}

export function beginMahjongRound(
  pool: readonly MahjongNumberTile[],
  heldTile: MahjongNumberTile | null,
  random: () => number = Math.random
): { pool: MahjongNumberTile[]; roundTiles: MahjongRoundTile[] } {
  const result = drawMahjongTiles(pool, MAHJONG_DRAWS_PER_ROUND, random)
  return {
    pool: result.pool,
    roundTiles: [
      ...(heldTile ? [{ id: heldTile.id, source: 'hand' as const, tile: heldTile }] : []),
      ...result.drawn.map(tile => ({ id: tile.id, source: 'draw' as const, tile }))
    ]
  }
}

export function toMahjongRoundTileViews(
  roundTiles: readonly MahjongRoundTile[],
  revealDrawnSuits = false
): MahjongRoundTileView[] {
  return roundTiles.map(resource => {
    const suitVisible = resource.source === 'hand' || revealDrawnSuits
    return {
      id: resource.id,
      source: resource.source,
      visibility: suitVisible ? 'suit' : 'hidden',
      suit: suitVisible ? resource.tile.suit : undefined
    }
  })
}

export function getMahjongTileName(tile: Pick<MahjongNumberTile, 'suit' | 'rank'>): string {
  if (tile.suit === 'characters') return `${MAHJONG_CHARACTER_NUMERALS[tile.rank]}萬`
  return `${MAHJONG_CHARACTER_NUMERALS[tile.rank]}${MAHJONG_SUIT_LABELS[tile.suit]}`
}

export function canGambleForMahjongHonor(roundTiles: readonly MahjongRoundTile[]): boolean {
  return roundTiles.length === 3
    && roundTiles.filter(resource => resource.source === 'hand').length === 1
    && roundTiles.filter(resource => resource.source === 'draw').length === 2
}

export function resolveMahjongHonorGamble(
  roundTiles: readonly MahjongRoundTile[],
  random: () => number = Math.random
): { success: boolean; honor: MahjongHonor | null } {
  if (!canGambleForMahjongHonor(roundTiles)) {
    return { success: false, honor: null }
  }

  const success = roundTiles.every(resource => (
    resource.tile.suit === roundTiles[0].tile.suit
  ))
  if (!success) return { success: false, honor: null }

  const index = Math.min(
    MAHJONG_HONORS.length - 1,
    Math.floor(Math.max(0, Math.min(.999999999, random())) * MAHJONG_HONORS.length)
  )
  return { success: true, honor: MAHJONG_HONORS[index] }
}
