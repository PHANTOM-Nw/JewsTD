import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  ArrowCounterClockwiseIcon,
  HandGrabbingIcon,
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
  MahjongAttachment,
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
  lastHonorGamble: 'success' | 'failure' | null
  currentWave?: number
  onTilePointerDown?: (tileId: string, pointerId: number) => void
  onRevealHandSuits?: () => void
  onKeepHand?: (tileId: string) => void
  onGambleForHonor?: () => void
  onSelectFunctionTile?: (attachment: MahjongAttachment) => void
  onStartWave?: () => void
  onPause?: () => void
  onResume?: () => void
  onReset?: () => void
}

function getPhaseCopy(
  gameStatus: GameStatus,
  placedCount: number,
  isChoosingHandAction: boolean
) {
  switch (gameStatus) {
    case 'building':
      return {
        eyebrow: `建造 ${placedCount}/${ECONOMY_CONFIG.towersPerRound}`,
        title: '拖动暗牌到地图',
        detail: '可自由拖动任意牌；落地后立即翻开。'
      }
    case 'deciding':
      return {
        eyebrow: '三张牌已落地',
        title: '选择 1 张激活',
        detail: `其余 ${ECONOMY_CONFIG.towersPerRound - 1} 张原地成为牌墙。`
      }
    case 'resolving_hand':
      return isChoosingHandAction
        ? {
            eyebrow: '处理剩余牌',
            title: '先选择处理方式',
            detail: '两张新牌仍为暗牌；查看花色后不能再赌中發白。'
          }
        : {
            eyebrow: '处理剩余牌',
            title: '保留 1 张手牌',
            detail: '只公开花色，具体点数继续保持未知。'
          }
    case 'ready':
      return {
        eyebrow: '迷宫准备完成',
        title: '开始下一波',
        detail: '牌墙会持续占位，不会在波次结束时自动回池。'
      }
    case 'playing':
      return { eyebrow: '战斗中', title: '暂停', detail: '激活牌正按花色与面子能力自动攻击。' }
    case 'paused':
      return { eyebrow: '战斗已暂停', title: '继续', detail: '检查路线和牌位后继续战斗。' }
    case 'victory':
      return { eyebrow: '全部波次完成', title: '再玩一局', detail: '新的摸牌顺序会带来不同迷宫。' }
    default:
      return { eyebrow: '矿坑失守', title: '重新开始', detail: '调整落牌位置和留牌策略再试一次。' }
  }
}

export function FunctionTileStrip({
  tiles,
  canAttach,
  onSelect
}: {
  tiles: MahjongHonor[]
  canAttach: boolean
  onSelect?: (attachment: MahjongAttachment) => void
}) {
  return (
    <div className="mahjong-functions" aria-label="功能牌区">
      <span>功能牌</span>
      {tiles.length === 0 ? (
        <small>暂无功能牌</small>
      ) : (
        <div>
          {tiles.map((honor, index) => honor === 'white' ? (
            <span
              key={`${honor}-${index}`}
              className="mahjong-function-tile mahjong-function-tile--white"
              title="白只在吃或碰时作为万能材料"
              aria-label="白，只能在吃或碰的合成工作台中作为材料"
            >
              <MahjongTile honor={honor} compact />
              <small>合成材料</small>
            </span>
          ) : (
            <button
              key={`${honor}-${index}`}
              type="button"
              className={`mahjong-function-tile mahjong-function-tile--${honor}`}
              disabled={!canAttach || !onSelect}
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
  lastHonorGamble,
  currentWave = 0,
  onTilePointerDown,
  onRevealHandSuits,
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
      if (canGambleForHonor) {
        return (
          <div className="mahjong-hand-decision">
            <div className="mahjong-hand-decision__tiles" aria-label="尚未公开的新牌">
              {roundTiles.map(resource => (
                <div key={resource.id}>
                  <MahjongTile
                    faceDown
                    knownSuit={resource.visibility === 'suit' ? resource.suit : undefined}
                    compact
                  />
                  <span>{resource.source === 'hand' ? '旧手牌' : '新暗牌'}</span>
                </div>
              ))}
            </div>
            <div className="mahjong-hand-decision__actions" aria-label="选择剩余牌处理方式">
              <button type="button" className="mahjong-inspect" onClick={onRevealHandSuits}>
                看花色选牌
                <small>公开两张新牌花色，再从三张中留一张</small>
              </button>
              <button type="button" className="mahjong-gamble" onClick={onGambleForHonor}>
                赌中發白
                <small>不看新牌花色，直接消耗三张进行判定</small>
              </button>
            </div>
          </div>
        )
      }

      return (
        <div className="mahjong-hand-resolution">
          <div className="mahjong-hand-resolution__choices" aria-label="选择下一回合手牌">
            {roundTiles.map(resource => (
              <button
                key={resource.id}
                type="button"
                onClick={() => onKeepHand?.(resource.id)}
                aria-label={`保留${resource.suit ? MAHJONG_SUIT_LABELS[resource.suit] : '未知'}花色手牌`}
              >
                <MahjongTile faceDown knownSuit={resource.suit} compact />
                <span>{resource.suit ? `${MAHJONG_SUIT_LABELS[resource.suit]} · 点数未知` : '未知'}</span>
              </button>
            ))}
          </div>
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
          className="action-deck__primary"
          onClick={onStartWave}
          disabled={disabledStart || !onStartWave}
        >
          <PlayIcon weight="fill" />
          开始第 {currentWave + 1} 波
        </button>
      )
    }
    if (gameStatus === 'playing') {
      return <button type="button" className="action-deck__primary" onClick={onPause} disabled={!onPause}><PauseIcon weight="fill" />暂停</button>
    }
    if (gameStatus === 'paused') {
      return <button type="button" className="action-deck__primary" onClick={onResume} disabled={!onResume}><PlayIcon weight="fill" />继续</button>
    }
    if (gameStatus === 'game_over' || gameStatus === 'victory') {
      return <button type="button" className="action-deck__primary" onClick={onReset} disabled={!onReset}><ArrowCounterClockwiseIcon weight="bold" />{copy.title}</button>
    }
    if (gameStatus === 'building') return null
    return (
      <div className="action-deck__primary action-deck__primary--status" aria-live="polite">
        <HandGrabbingIcon weight="fill" />
        {copy.title}
      </div>
    )
  }

  return (
    <section className={`build-panel action-deck action-deck--${gameStatus}`} aria-label="当前游戏阶段">
      <div className="action-deck__phase">
        <span>{copy.eyebrow}</span>
        <strong>{copy.detail}</strong>
      </div>
      {renderTiles()}
      {lastHonorGamble && gameStatus === 'ready' && (
        <p className={`mahjong-gamble-result mahjong-gamble-result--${lastHonorGamble}`}>
          {lastHonorGamble === 'success' ? '同花色成功，已获得功能牌。' : '花色不同，本次未获得功能牌。'}
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
          canAttach={gameStatus === 'building' || gameStatus === 'ready'}
          onSelect={onSelectFunctionTile}
        />
      )}
      {renderPrimary()}
      <div className="action-deck__meta" aria-label="建造资源">
        <span>剩余建造 {wood} 次</span>
        <span>金币 {gold}</span>
      </div>
    </section>
  )
}
