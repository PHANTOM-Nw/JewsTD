import {
  ArrowCounterClockwiseIcon,
  HammerIcon,
  PauseIcon,
  PlayIcon
} from '@phosphor-icons/react'
import { ECONOMY_CONFIG } from '../config/economy'
import { WAVES } from '../config/waves'
import type { GameStatus } from '../types/game'

interface BuildPanelProps {
  wood: number
  gold: number
  placedCount: number
  gameStatus: GameStatus
  currentWave?: number
  onStartWave?: () => void
  onPause?: () => void
  onResume?: () => void
  onReset?: () => void
}

function getPhaseCopy(gameStatus: GameStatus, placedCount: number) {
  switch (gameStatus) {
    case 'building':
      return {
        eyebrow: `建造 ${placedCount}/${ECONOMY_CONFIG.towersPerRound}`,
        title: placedCount === 0 ? '点击空格建塔' : `再放 ${ECONOMY_CONFIG.towersPerRound - placedCount} 座塔`,
        detail: `本轮随机生成 ${ECONOMY_CONFIG.towersPerRound} 座，最后保留 1 座。`
      }
    case 'deciding':
      return {
        eyebrow: '本轮建造完成',
        title: '选择要保留的塔',
        detail: `其余 ${ECONOMY_CONFIG.towersPerRound - 1} 座会变成障碍，继续改变敌人路线。`
      }
    case 'ready':
      return {
        eyebrow: '迷宫准备完成',
        title: '开始下一波',
        detail: `也可以点击障碍花费 ${ECONOMY_CONFIG.obstacleRemovalGoldCost} 金币清除。`
      }
    case 'playing':
      return { eyebrow: '战斗中', title: '暂停', detail: '宝石塔正在自动攻击。' }
    case 'paused':
      return { eyebrow: '战斗已暂停', title: '继续', detail: '检查路线和塔位后继续战斗。' }
    case 'victory':
      return { eyebrow: '全部波次完成', title: '再玩一局', detail: '新的随机宝石会带来不同迷宫。' }
    default:
      return { eyebrow: '矿坑失守', title: '重新开始', detail: '调整塔位和清障时机再试一次。' }
  }
}

export function BuildPanel({
  wood,
  gold,
  placedCount,
  gameStatus,
  currentWave = 0,
  onStartWave,
  onPause,
  onResume,
  onReset
}: BuildPanelProps) {
  const copy = getPhaseCopy(gameStatus, placedCount)
  const disabledStart = currentWave >= WAVES.length

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
      return (
        <button type="button" className="action-deck__primary" onClick={onPause} disabled={!onPause}>
          <PauseIcon weight="fill" />
          暂停
        </button>
      )
    }

    if (gameStatus === 'paused') {
      return (
        <button type="button" className="action-deck__primary" onClick={onResume} disabled={!onResume}>
          <PlayIcon weight="fill" />
          继续
        </button>
      )
    }

    if (gameStatus === 'game_over' || gameStatus === 'victory') {
      return (
        <button type="button" className="action-deck__primary" onClick={onReset} disabled={!onReset}>
          <ArrowCounterClockwiseIcon weight="bold" />
          {copy.title}
        </button>
      )
    }

    return (
      <div className="action-deck__primary action-deck__primary--status" aria-live="polite">
        <HammerIcon weight="fill" />
        {copy.title}
      </div>
    )
  }

  return (
    <section className="build-panel action-deck" aria-label="当前游戏阶段">
      <div className="action-deck__phase">
        <span>{copy.eyebrow}</span>
        <strong>{copy.detail}</strong>
      </div>
      {renderPrimary()}
      <div className="action-deck__meta" aria-label="建造资源">
        <span>木材 {wood}</span>
        <span>金币 {gold}</span>
        <span>清障 {ECONOMY_CONFIG.obstacleRemovalGoldCost}</span>
      </div>
    </section>
  )
}
