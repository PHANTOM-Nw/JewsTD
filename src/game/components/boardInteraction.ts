import type { GameStatus, GridCell } from '../types/game'

export type BoardClickIntent =
  | { kind: 'select_decision_tower'; towerId: string }
  | { kind: 'inspect_tower'; towerId: string; openSynthesis: boolean }
  | { kind: 'target_attachment'; towerId: string }
  | { kind: 'open_wall'; wall: GridCell }
  | { kind: 'clear_selection' }

interface BoardClickIntentRequest {
  gameStatus: GameStatus
  cell: GridCell
  existingTowerIds: readonly string[]
  storedTowerIds: readonly string[]
  currentBatchTowerIds: readonly string[]
  inspectedTowerId: string | null
  hasPendingAttachment: boolean
}

export function canInspectTowerDuringStatus(gameStatus: GameStatus): boolean {
  return gameStatus === 'building'
    || gameStatus === 'ready'
    || gameStatus === 'playing'
    || gameStatus === 'paused'
}

function isPreparation(gameStatus: GameStatus): boolean {
  return gameStatus === 'building' || gameStatus === 'ready'
}

/**
 * 将地图格点击归一成互斥意图。组件只负责执行意图，避免三选一、
 * 中發选塔、准备阶段合成和战斗查看在同一个条件分支中互相覆盖。
 */
export function getBoardClickIntent({
  gameStatus,
  cell,
  existingTowerIds,
  storedTowerIds,
  currentBatchTowerIds,
  inspectedTowerId,
  hasPendingAttachment
}: BoardClickIntentRequest): BoardClickIntent {
  if (cell.type === 'tower' && cell.towerId) {
    const towerId = cell.towerId
    if (!existingTowerIds.includes(towerId)) return { kind: 'clear_selection' }

    if (
      gameStatus === 'deciding'
      && currentBatchTowerIds.includes(towerId)
    ) {
      return { kind: 'select_decision_tower', towerId }
    }

    if (
      canInspectTowerDuringStatus(gameStatus)
      && storedTowerIds.includes(towerId)
    ) {
      if (hasPendingAttachment && isPreparation(gameStatus)) {
        return { kind: 'target_attachment', towerId }
      }
      if (inspectedTowerId === towerId) return { kind: 'clear_selection' }
      return {
        kind: 'inspect_tower',
        towerId,
        openSynthesis: isPreparation(gameStatus)
      }
    }
  }

  if (
    cell.type === 'obstacle'
    && (cell.mahjongWallKind === 'tile' || cell.mahjongWallKind === 'pure')
    && isPreparation(gameStatus)
  ) {
    return { kind: 'open_wall', wall: cell }
  }

  return { kind: 'clear_selection' }
}
