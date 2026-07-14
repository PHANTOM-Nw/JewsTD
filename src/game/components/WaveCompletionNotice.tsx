import { CheckCircleIcon } from '@phosphor-icons/react'
import { WAVES } from '../config/waves'
import { getCompletedWaveForNotice } from '../engine/gameFlow'
import type { GameStatus } from '../types/game'

interface WaveCompletionNoticeProps {
  gameStatus: GameStatus
  currentWave: number
}

export function WaveCompletionNotice({
  gameStatus,
  currentWave
}: WaveCompletionNoticeProps) {
  const completedWave = getCompletedWaveForNotice(
    gameStatus,
    currentWave,
    WAVES.length
  )

  if (completedWave === null) return null

  return (
    <div
      className="wave-complete-notice"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <CheckCircleIcon
        className="wave-complete-notice__icon"
        aria-hidden="true"
        weight="fill"
      />
      <div>
        <strong>第 {completedWave} 波完成！</strong>
        <span>矿坑守住了，准备迎接第 {completedWave + 1} 波。</span>
      </div>
    </div>
  )
}
