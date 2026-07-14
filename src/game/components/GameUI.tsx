import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowCounterClockwiseIcon,
  ArrowFatUpIcon,
  CoinsIcon,
  HammerIcon,
  HeartIcon,
  ShieldIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
  WavesIcon
} from '@phosphor-icons/react'
import { calculateUpgradeCost } from '../config/towers'
import { WAVES } from '../config/waves'
import { soundManager } from '../services/audio'
import type { GameStatus } from '../types/game'

interface GameUIProps {
  uiState: {
    wood: number
    gold: number
    mineHealth: number
    maxMineHealth: number
    wave: number
    gameStatus: GameStatus
    selectedGem: string | null
    canPlaceTowers: boolean
    gameLevel: number
  }
  onUpgradeGameLevel?: () => void
  onResetGame: () => void
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
  onUpgradeGameLevel,
  onResetGame
}: GameUIProps) {
  const [soundEnabled, setSoundEnabled] = useState(true)
  const isPreparation = uiState.gameStatus === 'building' || uiState.gameStatus === 'ready'
  const upgradeCost = calculateUpgradeCost(uiState.gameLevel)
  const canUpgrade = Boolean(onUpgradeGameLevel) && isPreparation && uiState.gold >= upgradeCost

  const toggleSound = () => {
    const nextValue = !soundEnabled
    setSoundEnabled(nextValue)
    soundManager.setEnabled(nextValue)
  }

  return (
    <header className="game-ui" aria-label="游戏资源与快捷操作">
      <div className="game-ui__resources">
        <ResourceCard
          className="game-ui__resource--wood"
          label="剩余建造"
          value={uiState.wood}
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
          label="等级"
          value={`Lv.${uiState.gameLevel}`}
          icon={<ShieldIcon weight="duotone" />}
          action={onUpgradeGameLevel ? (
            <button
              className="game-ui__mini-action"
              type="button"
              onClick={onUpgradeGameLevel}
              disabled={!canUpgrade}
              aria-label={`提升游戏等级，需要${upgradeCost}金币`}
              title={`升级：${upgradeCost}金币`}
            >
              <ArrowFatUpIcon weight="bold" />
            </button>
          ) : null}
        />
      </div>

      <div className="game-ui__utilities" aria-label="快捷操作">
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

      <p className="sr-only" aria-live="polite">
        剩余建造{uiState.wood}次，金币{uiState.gold}，矿坑生命{uiState.mineHealth}，
        第{uiState.wave}波，游戏等级{uiState.gameLevel}。
      </p>
    </header>
  )
}
