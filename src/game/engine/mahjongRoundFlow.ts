import {
  isMahjongHonorDrawRound,
  resolveMahjongHonorDraw
} from '../config/mahjong'
import type {
  MahjongHonor,
  MahjongNumberTile,
  MahjongRoundTile
} from '../types/game'

export interface SettleMahjongHandInput {
  pool: readonly MahjongNumberTile[]
  roundTiles: readonly MahjongRoundTile[]
  selectedTileId: string
  functionTiles: readonly MahjongHonor[]
  roundNumber: number
  random?: () => number
}

export type SettleMahjongHandResult =
  | {
      ok: true
      pool: MahjongNumberTile[]
      roundTiles: []
      heldTile: MahjongNumberTile
      functionTiles: MahjongHonor[]
      honorDrawResult: 'success' | 'failure' | null
    }
  | { ok: false; reason: 'tile_not_found' }

/**
 * 留牌与定期功能牌抽取是两笔相互独立的结算：数牌永远先留一回池，
 * 偶数建造轮的中發白抽取只新增功能牌，不消耗或替换所选手牌。
 */
export function settleMahjongHand(
  input: SettleMahjongHandInput
): SettleMahjongHandResult {
  const selected = input.roundTiles.find(resource => resource.id === input.selectedTileId)
  if (!selected) return { ok: false, reason: 'tile_not_found' }

  const nextPool = [
    ...input.pool,
    ...input.roundTiles
      .filter(resource => resource.id !== input.selectedTileId)
      .map(resource => resource.tile)
  ]
  const nextFunctionTiles = [...input.functionTiles]
  let honorDrawResult: 'success' | 'failure' | null = null

  if (isMahjongHonorDrawRound(input.roundNumber)) {
    const draw = resolveMahjongHonorDraw(input.random)
    honorDrawResult = draw.success ? 'success' : 'failure'
    if (draw.honor) nextFunctionTiles.push(draw.honor)
  }

  return {
    ok: true,
    pool: nextPool,
    roundTiles: [],
    heldTile: selected.tile,
    functionTiles: nextFunctionTiles,
    honorDrawResult
  }
}
