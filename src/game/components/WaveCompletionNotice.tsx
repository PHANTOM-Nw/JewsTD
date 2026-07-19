import { useEffect, useState } from 'react'
import { CheckCircleIcon } from '@phosphor-icons/react'
import { WAVES } from '../config/waves'
import { getCompletedWaveForNotice } from '../engine/gameFlow'
import type { GameStatus } from '../types/game'
import { scheduleWaveCompletionNoticeDismissal } from './waveCompletionNoticeLifecycle'

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
  const [visibleCompletedWave, setVisibleCompletedWave] = useState(completedWave)

  useEffect(() => {
    if (completedWave === null) {
      setVisibleCompletedWave(null)
      return
    }

    setVisibleCompletedWave(completedWave)
    return scheduleWaveCompletionNoticeDismissal(() => {
      setVisibleCompletedWave(visibleWave => (
        visibleWave === completedWave ? null : visibleWave
      ))
    })
  }, [completedWave])

  if (completedWave === null || visibleCompletedWave === null) return null

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
        <strong>第 {visibleCompletedWave} 波完成！</strong>
        <span>矿坑守住了，准备迎接第 {visibleCompletedWave + 1} 波。</span>
      </div>
    </div>
  )
}
