import { useEffect, useRef, useState } from 'react'
import { TrashIcon, XIcon } from '@phosphor-icons/react'
import { ECONOMY_CONFIG } from '../config/economy'
import { getMahjongTileName } from '../config/mahjong'
import type { MahjongWallRemovalFailure } from '../engine/mahjongWalls'
import type { GameStatus, GridCell } from '../types/game'
import {
  submitMahjongWallRemoval,
  type MahjongWallRemovalSubmitResult
} from './mahjongUiModel'
import { MahjongTile } from './MahjongTile'

interface MahjongWallDetailProps {
  wall: GridCell
  gold: number
  gameStatus: GameStatus
  onRemove: (position: { row: number; col: number }) => MahjongWallRemovalSubmitResult
  onClose: () => void
}

const FAILURE_MESSAGES: Record<MahjongWallRemovalFailure, string> = {
  invalid_phase: '只能在建造或备战阶段拆墙。',
  invalid_wall: '这个格子不是可拆除的麻将墙体。',
  invalid_gold: '金币状态无效。',
  insufficient_gold: '金币不足，无法拆除。',
  duplicate_tile: '牌池实体状态冲突，未执行拆墙。'
}

export function MahjongWallDetail({
  wall,
  gold,
  gameStatus,
  onRemove,
  onClose
}: MahjongWallDetailProps) {
  const [message, setMessage] = useState('')
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    closeButtonRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      previousFocus?.focus()
    }
  }, [onClose])

  const isTileWall = wall.mahjongWallKind === 'tile' && Boolean(wall.mahjongTile)
  const isPureWall = wall.mahjongWallKind === 'pure' && !wall.mahjongTile
  const validWall = wall.type === 'obstacle' && (isTileWall || isPureWall)
  const cost = isTileWall
    ? ECONOMY_CONFIG.mahjongTileWallRemovalGoldCost
    : ECONOMY_CONFIG.mahjongPureWallRemovalGoldCost
  const canRemove = validWall
    && (gameStatus === 'building' || gameStatus === 'ready')
    && gold >= cost
  const title = isTileWall && wall.mahjongTile
    ? `${getMahjongTileName(wall.mahjongTile)}牌墙`
    : '纯墙体'

  const remove = () => {
    if (!canRemove) return
    const result = submitMahjongWallRemoval(
      { row: wall.row, col: wall.col },
      onRemove,
      onClose
    )
    if (!result.ok) setMessage(FAILURE_MESSAGES[result.reason])
  }

  return (
    <div className="synthesis-dialog-backdrop" role="presentation">
      <section
        className="synthesis-dialog mahjong-wall-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mahjong-wall-title"
      >
        <header className="synthesis-dialog__header">
          <h2 id="mahjong-wall-title">{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button"
            aria-label="关闭墙体详情"
            onClick={onClose}
          >
            <XIcon weight="bold" />
          </button>
        </header>

        <div className="mahjong-wall-detail__body">
          {isTileWall && wall.mahjongTile
            ? <MahjongTile tile={wall.mahjongTile} />
            : <span className="mahjong-wall-detail__pure" aria-hidden="true">墙</span>}
          <div>
            <strong>{title}</strong>
            <span>{wall.row + 1}行{wall.col + 1}列</span>
            <p>{isTileWall
              ? '拆除后牌面实体返回发牌池；下次落地会重新生成随机属性。'
              : '该墙已不含数牌；拆除只改变路径，不会向牌池返还数牌。'}</p>
          </div>
        </div>

        <dl className="mahjong-wall-detail__cost">
          <div><dt>拆除价格</dt><dd>{cost} 金币</dd></div>
          <div><dt>当前金币</dt><dd>{gold}</dd></div>
          <div><dt>返还数牌</dt><dd>{isTileWall ? '是' : '否'}</dd></div>
        </dl>

        {!validWall && <p className="mahjong-action-message">墙体数据无效，不能拆除。</p>}
        {validWall && gameStatus !== 'building' && gameStatus !== 'ready' && (
          <p className="mahjong-action-message">只能在建造或备战阶段拆墙。</p>
        )}
        {validWall && gold < cost && (
          <p className="mahjong-action-message">还需要 {cost - gold} 金币。</p>
        )}
        <p className="mahjong-action-message" aria-live="polite">{message}</p>

        <div className="mahjong-dialog__actions">
          <button type="button" onClick={onClose}>取消</button>
          <button
            type="button"
            className="mahjong-wall-detail__remove"
            disabled={!canRemove}
            onClick={remove}
          >
            <TrashIcon weight="bold" />拆除墙体（{cost} 金币）
          </button>
        </div>
      </section>
    </div>
  )
}
