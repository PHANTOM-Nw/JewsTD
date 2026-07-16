import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowCounterClockwiseIcon,
  CoinsIcon,
  CornersInIcon,
  CornersOutIcon,
  HammerIcon,
  HeartIcon,
  StackIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
  WavesIcon
} from '@phosphor-icons/react'
import { ECONOMY_CONFIG } from '../config/economy'
import { WAVES } from '../config/waves'
import { soundManager } from '../services/audio'
import type { UIState } from '../types/game'

interface GameUIProps {
  uiState: UIState
  onResetGame: () => void
  phaseHint?: ReactNode
  fullscreen?: {
    isSupported: boolean
    isFullscreen: boolean
    onToggle: () => void
  }
}

interface ResourceCardProps {
  className: string
  label: string
  value: string | number
  icon: ReactNode
  action?: ReactNode
}

function ResourceCard({ className, label, value, icon, action }: ResourceCardProps) {
  return (
    <div className={`game-ui__resource ${className}`}>
      <span className="game-ui__icon" aria-hidden="true">{icon}</span>
      <span className="game-ui__copy">
        <span className="game-ui__label">{label}</span>
        <strong className="game-ui__value">{value}</strong>
      </span>
      {action}
    </div>
  )
}

export function GameUI({
  uiState,
  onResetGame,
  phaseHint,
  fullscreen
}: GameUIProps) {
  const [soundEnabled, setSoundEnabled] = useState(true)

  const toggleSound = () => {
    const nextValue = !soundEnabled
    setSoundEnabled(nextValue)
    soundManager.setEnabled(nextValue)
  }

  return (
    <header className="game-ui" aria-label="麻将 TD 游戏资源与快捷操作">
      <div className="game-header">
        {phaseHint}
        <div className="game-ui__utilities" aria-label="快捷操作">
          {fullscreen?.isSupported && (
            <button
              type="button"
              className="icon-button game-ui__fullscreen"
              onClick={fullscreen.onToggle}
              aria-label={fullscreen.isFullscreen ? '退出全屏' : '进入全屏'}
              title={fullscreen.isFullscreen ? '退出全屏' : '进入全屏'}
            >
              {fullscreen.isFullscreen
                ? <CornersInIcon weight="bold" />
                : <CornersOutIcon weight="bold" />}
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            onClick={toggleSound}
            aria-label={soundEnabled ? '关闭音效' : '开启音效'}
            title={soundEnabled ? '关闭音效' : '开启音效'}
          >
            {soundEnabled
              ? <SpeakerHighIcon weight="fill" />
              : <SpeakerSlashIcon weight="fill" />}
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onResetGame}
            aria-label="重新开始"
            title="重新开始"
          >
            <ArrowCounterClockwiseIcon weight="bold" />
          </button>
        </div>
      </div>

      <div className="game-ui__resources">
        <ResourceCard
          className="game-ui__resource--wood"
          label="建造"
          value={`${ECONOMY_CONFIG.towersPerRound - uiState.wood}/${ECONOMY_CONFIG.towersPerRound}`}
          icon={<HammerIcon weight="duotone" />}
        />
        <ResourceCard
          className="game-ui__resource--gold"
          label="金币"
          value={uiState.gold}
          icon={<CoinsIcon weight="duotone" />}
        />
        <ResourceCard
          className="game-ui__resource--health"
          label="矿坑生命"
          value={`${uiState.mineHealth}/${uiState.maxMineHealth}`}
          icon={<HeartIcon weight="fill" />}
        />
        <ResourceCard
          className="game-ui__resource--wave"
          label="波次"
          value={`${uiState.wave}/${WAVES.length}`}
          icon={<WavesIcon weight="duotone" />}
        />
        <ResourceCard
          className="game-ui__resource--level"
          label="牌池"
          value={uiState.mahjongPoolCount}
          icon={<StackIcon weight="duotone" />}
        />
      </div>

      <p className="sr-only" aria-live="polite">
        本轮已建造{ECONOMY_CONFIG.towersPerRound - uiState.wood}次，金币{uiState.gold}，矿坑生命{uiState.mineHealth}，
        第{uiState.wave}波，可摸牌池剩余{uiState.mahjongPoolCount}张。
      </p>
    </header>
  )
}
