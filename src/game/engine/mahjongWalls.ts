import { ECONOMY_CONFIG } from '../config/economy'
import type {
  GameStatus,
  GridCell,
  MahjongNumberTile
} from '../types/game'

export type MahjongRemovableWall = Pick<
  GridCell,
  'row' | 'col' | 'type' | 'towerId' | 'mahjongTile' | 'mahjongWallKind'
>

export interface MahjongWallRemovalRequest {
  gameStatus: GameStatus
  wall: MahjongRemovableWall
  gold: number
  pool: readonly MahjongNumberTile[]
}

export type MahjongWallRemovalFailure =
  | 'invalid_phase'
  | 'invalid_wall'
  | 'invalid_gold'
  | 'insufficient_gold'
  | 'duplicate_tile'

export interface MahjongWallRemovalPlan {
  position: { row: number; col: number }
  cost: number
  nextGold: number
  nextPool: MahjongNumberTile[]
  clearedCell: GridCell
  returnedTile: MahjongNumberTile | null
}

export type MahjongWallRemovalResult =
  | { ok: true; plan: MahjongWallRemovalPlan }
  | { ok: false; reason: MahjongWallRemovalFailure }

function isPreparationPhase(gameStatus: GameStatus): boolean {
  return gameStatus === 'building' || gameStatus === 'ready'
}

/**
 * 生成拆墙的原子事务计划，不修改金币、牌池或输入格子。
 * 含牌墙把实体牌返还摸牌池；纯墙体只解除阻路占用。
 */
export function planMahjongWallRemoval(
  request: MahjongWallRemovalRequest
): MahjongWallRemovalResult {
  if (!isPreparationPhase(request.gameStatus)) {
    return { ok: false, reason: 'invalid_phase' }
  }
  if (!Number.isFinite(request.gold) || request.gold < 0) {
    return { ok: false, reason: 'invalid_gold' }
  }

  const { wall } = request
  if (
    wall.type !== 'obstacle'
    || wall.towerId !== undefined
    || (wall.mahjongWallKind !== 'tile' && wall.mahjongWallKind !== 'pure')
    || (wall.mahjongWallKind === 'tile' && !wall.mahjongTile)
    || (wall.mahjongWallKind === 'pure' && wall.mahjongTile !== undefined)
  ) {
    return { ok: false, reason: 'invalid_wall' }
  }

  const cost = wall.mahjongWallKind === 'tile'
    ? ECONOMY_CONFIG.mahjongTileWallRemovalGoldCost
    : ECONOMY_CONFIG.mahjongPureWallRemovalGoldCost
  if (request.gold < cost) {
    return { ok: false, reason: 'insufficient_gold' }
  }

  const returnedTile = wall.mahjongWallKind === 'tile' ? wall.mahjongTile! : null
  const poolTileIds = request.pool.map(tile => tile.id)
  if (
    new Set(poolTileIds).size !== poolTileIds.length
    || (returnedTile && poolTileIds.includes(returnedTile.id))
  ) {
    return { ok: false, reason: 'duplicate_tile' }
  }

  return {
    ok: true,
    plan: {
      position: { row: wall.row, col: wall.col },
      cost,
      nextGold: request.gold - cost,
      nextPool: returnedTile ? [...request.pool, returnedTile] : [...request.pool],
      clearedCell: {
        row: wall.row,
        col: wall.col,
        type: 'empty'
      },
      returnedTile
    }
  }
}
