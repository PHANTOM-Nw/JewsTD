import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createInitialScoreState } from '../config/scoring'
import { GameResultPanel } from './GameResultPanel'
import { validateDisplayName } from './gameResultValidation'

const score = {
  ...createInitialScoreState(),
  total: 900,
  killScore: 500,
  synthesisScore: 400
}

const leaderboardEntry = {
  id: 1,
  runId: 'run-1',
  displayName: '东风玩家',
  totalScore: 1200,
  killScore: 800,
  synthesisScore: 400,
  outcome: 'victory' as const,
  wave: 12,
  mineHealth: 5,
  durationMs: 1000,
  createdAt: '2026-07-19T00:00:00.000Z',
  rank: 1
}

const callbacks = {
  onSubmit: vi.fn(),
  onRetryConnection: vi.fn(),
  onReloadLeaderboard: vi.fn(),
  onReset: vi.fn()
}

describe('display name validation', () => {
  it('trims names and counts Unicode code points', () => {
    expect(validateDisplayName('  麻将玩家  ')).toEqual({ value: '麻将玩家', error: null })
    expect(validateDisplayName('  e\u0301雀  ')).toEqual({ value: 'é雀', error: null })
    expect(validateDisplayName('😀'.repeat(16))).toEqual({ value: '😀'.repeat(16), error: null })
    expect(validateDisplayName('😀'.repeat(17)).error).toBe('名称不能超过 16 个字符')
    expect(validateDisplayName('　 ').error).toBe('请输入名称')
    expect(validateDisplayName('玩家\u200B名称').error).toBe('名称不能包含控制或格式字符')
  })
})

describe('GameResultPanel', () => {
  it('renders frozen score details, public-name notice, Top 10 and self rank', () => {
    const markup = renderToStaticMarkup(
      <GameResultPanel
        outcome="victory"
        wave={12}
        score={score}
        connectionStatus="ready"
        submissionStatus="success"
        submittedRank={17}
        leaderboardStatus="success"
        leaderboardEntries={[leaderboardEntry]}
        selfRank={17}
        {...callbacks}
      />
    )

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toMatch(/<h2[^>]*id="game-result-title"[^>]*tabindex="-1"/)
    expect(markup).toContain('最终总分')
    expect(markup).toContain('900')
    expect(markup).toContain('击杀得分')
    expect(markup).toContain('合成得分')
    expect(markup).toContain('名称将公开显示')
    expect(markup).toContain('允许重名，每局只能提交一次')
    expect(markup).toContain('全服排行榜 · Top 10')
    expect(markup).toContain('东风玩家')
    expect(markup).toContain('本局全服排名')
    expect(markup).toContain('第 17 名')
    expect(markup).toContain('再来一局')
    expect(markup).toContain('disabled=""')
  })

  it('renders non-blocking connection and leaderboard recovery states', () => {
    const unavailableMarkup = renderToStaticMarkup(
      <GameResultPanel
        outcome="game_over"
        wave={6}
        score={score}
        connectionStatus="unavailable"
        connectionError="本局计分版本已过期，请刷新页面后再开始新游戏"
        submissionStatus="idle"
        leaderboardStatus="error"
        leaderboardEntries={[]}
        leaderboardError="加载失败"
        {...callbacks}
      />
    )
    const emptyMarkup = renderToStaticMarkup(
      <GameResultPanel
        outcome="game_over"
        wave={6}
        score={score}
        connectionStatus="ready"
        submissionStatus="error"
        submissionError="提交失败，请重试"
        leaderboardStatus="success"
        leaderboardEntries={[]}
        {...callbacks}
      />
    )

    expect(unavailableMarkup).toContain('本局计分版本已过期')
    expect(unavailableMarkup).toContain('重试连接')
    expect(unavailableMarkup).toContain('重新加载')
    expect(emptyMarkup).toContain('排行榜暂无成绩')
    expect(emptyMarkup).toContain('提交失败，请重试')
  })
})
