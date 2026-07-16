import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  ArrowCounterClockwiseIcon,
  PauseIcon,
  PlayIcon
} from '@phosphor-icons/react'
import { ECONOMY_CONFIG } from '../config/economy'
import {
  MAHJONG_HONOR_LABELS,
  MAHJONG_SUIT_LABELS
} from '../config/mahjong'
import { WAVES } from '../config/waves'
import type {
  GameStatus,
  MahjongHonor,
  MahjongRoundTileView,
  MahjongSuit
} from '../types/game'
import { MahjongTile } from './MahjongTile'

interface BuildPanelProps {
  wood: number
  gold: number
  placedCount: number
  gameStatus: GameStatus
  roundTiles: MahjongRoundTileView[]
  heldTileSuit: MahjongSuit | null
  functionTiles: MahjongHonor[]
  canGambleForHonor: boolean
  honorGambleChance: number | null
  lastHonorGamble: 'success' | 'failure' | null
  currentWave?: number
  onTilePointerDown?: (tileId: string, pointerId: number) => void
  onKeepHand?: (tileId: string) => void
  onGambleForHonor?: () => void
  onSelectFunctionTile?: (honor: MahjongHonor) => void
  onStartWave?: () => void
  onPause?: () => void
  onResume?: () => void
  onReset?: () => void
}

interface GamePhaseHintProps {
  placedCount: number
  gameStatus: GameStatus
  canGambleForHonor: boolean
}

function getPhaseCopy(
  gameStatus: GameStatus,
  placedCount: number,
  canGambleForHonor: boolean
) {
  switch (gameStatus) {
    case 'building':
      return {
        eyebrow: `建造 ${placedCount}/${ECONOMY_CONFIG.towersPerRound}`,
        title: '拖动暗牌到地图',
        detail: '拖牌到地图，落地即翻开'
      }
    case 'deciding':
      return {
        eyebrow: '三选一',
        title: '选择 1 张激活',
        detail: `激活 1 张，其余 ${ECONOMY_CONFIG.towersPerRound - 1} 张变牌墙`
      }
    case 'resolving_hand':
      return canGambleForHonor
        ? {
            eyebrow: '处理手牌',
            title: '保留手牌或赌功能牌',
            detail: '点数保密：留 1 张或三张赌功能牌'
          }
        : {
            eyebrow: '处理手牌',
            title: '保留 1 张手牌',
            detail: '看花色留 1 张，点数仍保密'
          }
    case 'ready':
      return {
        eyebrow: '备战完成',
        title: '开始下一波',
        detail: '可整备，或开始下一波'
      }
    case 'playing':
      return { eyebrow: '战斗中', title: '暂停', detail: '棋子正在自动攻击' }
    case 'paused':
      return { eyebrow: '已暂停', title: '继续', detail: '检查路线后继续' }
    case 'victory':
      return { eyebrow: '胜利', title: '再玩一局', detail: '全部波次完成' }
    default:
      return { eyebrow: '矿坑失守', title: '重新开始', detail: '调整落牌和留牌策略再来' }
  }
}

export function GamePhaseHint({
  placedCount,
  gameStatus,
  canGambleForHonor
}: GamePhaseHintProps) {
  const copy = getPhaseCopy(gameStatus, placedCount, canGambleForHonor)

  return (
    <aside
      className={`game-phase-hint game-phase-hint--${gameStatus}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <span>{copy.eyebrow}</span>
      <strong>{copy.detail}</strong>
    </aside>
  )
}

export function FunctionTileStrip({
  tiles,
  onSelect
}: {
  tiles: MahjongHonor[]
  onSelect?: (honor: MahjongHonor) => void
}) {
  return (
    <div className="mahjong-functions" aria-label="功能牌区">
      <span>功能牌</span>
      {tiles.length === 0 ? (
        <small>暂无功能牌</small>
      ) : (
        <div>
          {tiles.map((honor, index) => honor === 'white' ? (
            <button
              key={`${honor}-${index}`}
              type="button"
              className="mahjong-function-tile mahjong-function-tile--white"
              disabled={!onSelect}
              onClick={() => onSelect?.('white')}
              aria-label={`查看${MAHJONG_HONOR_LABELS.white}的合成催化说明`}
            >
              <MahjongTile honor={honor} compact />
              <small>合成材料</small>
            </button>
          ) : (
            <button
              key={`${honor}-${index}`}
              type="button"
              className={`mahjong-function-tile mahjong-function-tile--${honor}`}
              disabled={!onSelect}
              onClick={() => onSelect?.(honor)}
              aria-label={`选择${MAHJONG_HONOR_LABELS[honor]}，然后选择一座激活棋子附着`}
            >
              <MahjongTile honor={honor} compact />
              <small>选择目标</small>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function BuildPanel({
  wood,
  gold,
  placedCount,
  gameStatus,
  roundTiles,
  heldTileSuit,
  functionTiles,
  canGambleForHonor,
  honorGambleChance,
  lastHonorGamble,
  currentWave = 0,
  onTilePointerDown,
  onKeepHand,
  onGambleForHonor,
  onSelectFunctionTile,
  onStartWave,
  onPause,
  onResume,
  onReset
}: BuildPanelProps) {
  const copy = getPhaseCopy(gameStatus, placedCount, canGambleForHonor)
  const disabledStart = currentWave >= WAVES.length

  const beginTileDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    tileId: string
  ) => {
    if (!event.isPrimary || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    onTilePointerDown?.(tileId, event.pointerId)
  }

  const renderTiles = () => {
    if (gameStatus === 'building') {
      return (
        <div className="mahjong-tray" aria-label="本回合可用牌">
          {roundTiles.map(resource => (
            <button
              key={resource.id}
              type="button"
              className="mahjong-tray__tile"
              onPointerDown={event => beginTileDrag(event, resource.id)}
              aria-label={resource.visibility === 'suit' && resource.suit
                ? `手牌，已知${MAHJONG_SUIT_LABELS[resource.suit]}，点数未知；拖动到地图`
                : '暗牌，花色与点数未知；拖动到地图'}
            >
              <MahjongTile
                faceDown
                knownSuit={resource.visibility === 'suit' ? resource.suit : undefined}
              />
            </button>
          ))}
        </div>
      )
    }

    if (gameStatus === 'resolving_hand') {
      const gamblePercent = Math.round((honorGambleChance ?? 0) * 100)
      return (
        <div className="mahjong-hand-resolution">
          <div className="mahjong-hand-resolution__choices" aria-label="选择下一回合手牌">
            {roundTiles.map(resource => {
              const suitLabel = resource.suit ? MAHJONG_SUIT_LABELS[resource.suit] : '未知'
              return (
                <button
                  key={resource.id}
                  type="button"
                  onClick={() => onKeepHand?.(resource.id)}
                  aria-label={`保留${suitLabel}花色手牌，点数未知`}
                >
                  <MahjongTile faceDown knownSuit={resource.suit} compact />
                  <span>{suitLabel} · 点数未知</span>
                  <small>{resource.source === 'hand' ? '旧手牌' : '新牌'}</small>
                </button>
              )
            })}
          </div>
          {canGambleForHonor && (
            <button
              type="button"
              className="mahjong-gamble"
              onClick={onGambleForHonor}
              aria-label={`消耗三张牌赌中發白，成功率${gamblePercent}%，只按花色判定，不泄露点数`}
            >
              赌中發白（成功率 {gamblePercent}%）
              <small>三张全部回池；成功等概率获得中／發／白之一</small>
            </button>
          )}
        </div>
      )
    }

    return null
  }

  const renderPrimary = () => {
    if (gameStatus === 'ready') {
      return (
        <button
          type="button"
          className="action-deck__primary action-deck__primary--action"
          onClick={onStartWave}
          disabled={disabledStart || !onStartWave}
        >
          <PlayIcon weight="fill" />
          开始第 {currentWave + 1} 波
        </button>
      )
    }
    if (gameStatus === 'playing') {
      return <button type="button" className="action-deck__primary action-deck__primary--action" onClick={onPause} disabled={!onPause}><PauseIcon weight="fill" />暂停</button>
    }
    if (gameStatus === 'paused') {
      return <button type="button" className="action-deck__primary action-deck__primary--action" onClick={onResume} disabled={!onResume}><PlayIcon weight="fill" />继续</button>
    }
    if (gameStatus === 'game_over' || gameStatus === 'victory') {
      return <button type="button" className="action-deck__primary action-deck__primary--action" onClick={onReset} disabled={!onReset}><ArrowCounterClockwiseIcon weight="bold" />{copy.title}</button>
    }
    return null
  }

  return (
    <section className={`build-panel action-deck action-deck--${gameStatus}`} aria-label="当前游戏阶段">
      {gameStatus !== 'resolving_hand' && renderPrimary()}
      {renderTiles()}
      {lastHonorGamble && gameStatus === 'ready' && (
        <p className={`mahjong-gamble-result mahjong-gamble-result--${lastHonorGamble}`}>
          {lastHonorGamble === 'success' ? '赌博成功，已获得一张功能牌。' : '赌博未中，本次没有获得功能牌。'}
        </p>
      )}
      {(gameStatus === 'ready' || gameStatus === 'playing' || gameStatus === 'paused') && heldTileSuit && (
        <div className="mahjong-held-summary">
          <MahjongTile faceDown knownSuit={heldTileSuit} compact />
          <span>手牌：{MAHJONG_SUIT_LABELS[heldTileSuit]}（点数未知）</span>
        </div>
      )}
      {(gameStatus === 'building' || gameStatus === 'ready') && (
        <FunctionTileStrip
          tiles={functionTiles}
          onSelect={onSelectFunctionTile}
        />
      )}
      <div className="action-deck__meta" aria-label="建造资源">
        <span>剩余建造 {wood} 次</span>
        <span>金币 {gold}</span>
      </div>
    </section>
  )
}
