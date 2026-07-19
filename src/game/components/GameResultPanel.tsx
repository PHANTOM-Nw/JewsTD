import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ScoreState } from '../types/game'
import type { LeaderboardEntry } from '../services/leaderboard'
import { validateDisplayName } from './gameResultValidation'
import { useModalFocus } from './modalFocus'

export type SubmissionStatus = 'idle' | 'submitting' | 'success' | 'error'
export type LeaderboardStatus = 'loading' | 'success' | 'error'
export type RunConnectionStatus = 'connecting' | 'ready' | 'unavailable'

interface GameResultPanelProps {
  outcome: 'victory' | 'game_over'
  wave: number
  score: ScoreState
  connectionStatus: RunConnectionStatus
  connectionError?: string
  submissionStatus: SubmissionStatus
  submissionError?: string
  submittedRank?: number | null
  leaderboardStatus: LeaderboardStatus
  leaderboardEntries: Array<LeaderboardEntry & { rank: number }>
  selfRank?: number | null
  leaderboardError?: string
  onSubmit: (displayName: string) => void
  onRetryConnection: () => void
  onReloadLeaderboard: () => void
  onReset: () => void
}

function Leaderboard({
  status,
  entries,
  error,
  selfRank,
  onReload
}: {
  status: LeaderboardStatus
  entries: Array<LeaderboardEntry & { rank: number }>
  error?: string
  selfRank?: number | null
  onReload: () => void
}) {
  return (
    <section className="game-result__leaderboard" aria-labelledby="leaderboard-title">
      <h3 id="leaderboard-title">全服排行榜 · Top 10</h3>
      {status === 'loading' && (
        <p role="status">正在加载排行榜…</p>
      )}
      {status === 'error' && (
        <div role="alert" className="game-result__inline-error">
          <p>{error ?? '排行榜加载失败，请稍后重试'}</p>
          <button type="button" onClick={onReload}>重新加载</button>
        </div>
      )}
      {status === 'success' && entries.length === 0 && (
        <p className="game-result__empty">排行榜暂无成绩，来拿下第一名吧。</p>
      )}
      {status === 'success' && entries.length > 0 && (
        <ol className="leaderboard-list" aria-label="排行榜前十名">
          {entries.map(entry => (
            <li key={entry.id}>
              <strong><span aria-hidden="true">#{entry.rank}</span><span className="sr-only">第 {entry.rank} 名</span></strong>
              <span title={entry.displayName}>{entry.displayName}</span>
              <b>{entry.totalScore}</b>
            </li>
          ))}
        </ol>
      )}
      {selfRank != null && (
        <p className="game-result__self-rank" aria-live="polite">
          本局全服排名：<strong>第 {selfRank} 名</strong>
        </p>
      )}
    </section>
  )
}

export function GameResultPanel({
  outcome,
  wave,
  score,
  connectionStatus,
  connectionError,
  submissionStatus,
  submissionError,
  submittedRank,
  leaderboardStatus,
  leaderboardEntries,
  selfRank,
  leaderboardError,
  onSubmit,
  onRetryConnection,
  onReloadLeaderboard,
  onReset
}: GameResultPanelProps) {
  const [displayName, setDisplayName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const submitted = submissionStatus === 'success'
  const { modalRef, titleRef } = useModalFocus()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (connectionStatus !== 'ready' || submissionStatus === 'submitting' || submitted) return
    const validation = validateDisplayName(displayName)
    setDisplayName(validation.value)
    setNameError(validation.error)
    if (!validation.error) onSubmit(validation.value)
  }

  return (
    <section
      ref={modalRef}
      className={`game-result game-result--${outcome === 'victory' ? 'victory' : 'over'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-result-title"
    >
      <div className="game-result__card">
        <header>
          <p>{outcome === 'victory' ? '十二波全部完成' : `坚持到第 ${wave} 波`}</p>
          <h2 ref={titleRef} id="game-result-title" tabIndex={-1}>
            {outcome === 'victory' ? '胜利！' : '游戏结束'}
          </h2>
        </header>

        <div className="game-result__score" aria-label="本局分数明细">
          <div><span>最终总分</span><strong>{score.total}</strong></div>
          <div><span>击杀得分</span><strong>{score.killScore}</strong></div>
          <div><span>合成得分</span><strong>{score.synthesisScore}</strong></div>
        </div>

        <form className="game-result__submission" onSubmit={handleSubmit} noValidate>
          <label htmlFor="leaderboard-display-name">上传本局成绩</label>
          <p id="leaderboard-name-help">
            名称将公开显示，去除首尾空格后须为 1～16 个字符；允许重名，每局只能提交一次。
          </p>
          <div className="game-result__name-row">
            <input
              id="leaderboard-display-name"
              name="displayName"
              value={displayName}
              onChange={event => {
                setDisplayName(event.target.value)
                if (nameError) setNameError(null)
              }}
              aria-describedby={`leaderboard-name-help${nameError ? ' leaderboard-name-error' : ''}`}
              aria-invalid={nameError ? 'true' : undefined}
              autoComplete="nickname"
              disabled={submitted || submissionStatus === 'submitting'}
              placeholder="输入公开名称"
            />
            <button
              type="submit"
              disabled={connectionStatus !== 'ready' || submitted || submissionStatus === 'submitting'}
            >
              {submissionStatus === 'submitting' ? '提交中…' : submitted ? '已提交' : '提交分数'}
            </button>
          </div>
          {nameError && <p id="leaderboard-name-error" role="alert">{nameError}</p>}
          {connectionStatus === 'connecting' && <p role="status">正在连接排行榜服务…</p>}
          {connectionStatus === 'unavailable' && (
            <div role="alert" className="game-result__inline-error">
              <p>{connectionError ?? '排行榜服务暂时不可用，不影响重新开始游戏。'}</p>
              <button type="button" onClick={onRetryConnection}>重试连接</button>
            </div>
          )}
          {submissionStatus === 'error' && (
            <p role="alert" className="game-result__submission-error">
              {submissionError ?? '提交失败，请重试'}
            </p>
          )}
          {submitted && (
            <p role="status" className="game-result__submission-success">
              成绩上传成功{submittedRank != null ? `，当前第 ${submittedRank} 名` : ''}。
            </p>
          )}
        </form>

        <Leaderboard
          status={leaderboardStatus}
          entries={leaderboardEntries}
          error={leaderboardError}
          selfRank={selfRank ?? submittedRank}
          onReload={onReloadLeaderboard}
        />

        <button type="button" className="game-result__reset" onClick={onReset}>
          再来一局
        </button>
      </div>
    </section>
  )
}
