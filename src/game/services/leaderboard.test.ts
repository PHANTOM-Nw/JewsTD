import { describe, expect, it, vi } from 'vitest'
import { createInitialScoreState } from '../config/scoring'
import {
  LeaderboardApiError,
  assertCompatibleScoringVersion,
  createLeaderboardClient,
  createScoreSubmission,
  submitScoreWithReconciliation
} from './leaderboard'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

const entry = {
  id: 1,
  runId: 'run / 3',
  displayName: '玩家三',
  totalScore: 0,
  killScore: 0,
  synthesisScore: 0,
  outcome: 'game_over',
  wave: 5,
  mineHealth: 0,
  durationMs: 8000,
  createdAt: '2026-07-19T00:00:00.000Z'
}

describe('leaderboard client', () => {
  it('creates a run without exposing game state', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      runId: 'run-1',
      submissionToken: 'token-1',
      scoringVersion: 'v1'
    }, 201))
    const client = createLeaderboardClient(fetcher)

    await expect(client.createRun()).resolves.toEqual({
      runId: 'run-1',
      submissionToken: 'token-1',
      scoringVersion: 'v1'
    })
    expect(fetcher).toHaveBeenCalledWith('/api/runs', expect.objectContaining({
      method: 'POST',
      body: '{}'
    }))
  })

  it('fails closed when the server uses a different scoring version', () => {
    let error: unknown
    try {
      assertCompatibleScoringVersion({
        runId: 'run-new',
        submissionToken: 'token-new',
        scoringVersion: 'v2'
      }, 'v1')
    } catch (caught) {
      error = caught
    }
    expect(error).toMatchObject({ code: 'version_mismatch' })
  })

  it('maps engine counters to the score submission contract explicitly', () => {
    const score = createInitialScoreState()
    score.total = 910
    score.killScore = 510
    score.synthesisScore = 400
    score.killsByEnemyType.boss = 1
    score.killsByEnemyType.basic = 1
    score.synthesesByFormation.kong = 1

    expect(createScoreSubmission(
      { runId: 'run-2', submissionToken: 'secret', scoringVersion: 'v1' },
      '玩家',
      score,
      {
        outcome: 'victory',
        wave: 12,
        mineHealth: 4,
        durationMs: 1234,
        clientVersion: 'web-v1',
        scoringVersion: 'v1'
      }
    )).toMatchObject({
      totalScore: 910,
      breakdown: {
        killScore: 510,
        synthesisScore: 400,
        killsByType: { basic: 1, fast: 0, tank: 0, boss: 1 },
        synthesesByFormation: { pair: 0, chow: 0, pung: 0, kong: 1 }
      }
    })
  })

  it('submits JSON and requests Top 10 with the current run identity', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ entry, rank: 8 }, 201))
      .mockResolvedValueOnce(jsonResponse({ scoringVersion: 'v1', entries: [], self: null }))
    const client = createLeaderboardClient(fetcher)
    const submission = createScoreSubmission(
      { runId: 'run / 3', submissionToken: 'token', scoringVersion: 'v1' },
      '玩家三',
      createInitialScoreState(),
      {
        outcome: 'game_over',
        wave: 5,
        mineHealth: 0,
        durationMs: 8000,
        clientVersion: 'web-v1',
        scoringVersion: 'v1'
      }
    )

    await client.submitScore(submission)
    await client.getLeaderboard('run / 3')

    const submitInit = fetcher.mock.calls[0][1] as RequestInit
    expect(fetcher.mock.calls[0][0]).toBe('/api/scores')
    expect(JSON.parse(String(submitInit.body))).toEqual(submission)
    expect(fetcher.mock.calls[1][0]).toBe('/api/leaderboard?limit=10&runId=run+%2F+3')
  })

  it('preserves structured API errors and normalizes network failures', async () => {
    const apiClient = createLeaderboardClient(vi.fn().mockResolvedValue(jsonResponse({
      error: { code: 'run_already_submitted', message: '本局已经提交' }
    }, 409)))
    const offlineClient = createLeaderboardClient(vi.fn().mockRejectedValue(new Error('offline')))

    await expect(apiClient.createRun()).rejects.toMatchObject({
      code: 'run_already_submitted',
      status: 409,
      message: '本局已经提交'
    })
    await expect(offlineClient.getLeaderboard()).rejects.toEqual(
      expect.objectContaining<Partial<LeaderboardApiError>>({
        code: 'network_error',
        message: '无法连接排行榜服务，请稍后重试'
      })
    )
  })

  it('recovers a successful submission when the POST response is lost', async () => {
    const rankedEntry = { ...entry, rank: 23 }
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce(jsonResponse({
        scoringVersion: 'v1',
        entries: [],
        self: rankedEntry
      }))
    const client = createLeaderboardClient(fetcher)
    const submission = createScoreSubmission(
      { runId: entry.runId, submissionToken: 'token', scoringVersion: 'v1' },
      entry.displayName,
      createInitialScoreState(),
      {
        outcome: 'game_over',
        wave: entry.wave,
        mineHealth: entry.mineHealth,
        durationMs: entry.durationMs,
        clientVersion: 'web-v1',
        scoringVersion: 'v1'
      }
    )

    await expect(submitScoreWithReconciliation(client, submission)).resolves.toMatchObject({
      rank: 23,
      reconciled: true,
      leaderboard: { self: rankedEntry }
    })
    expect(fetcher.mock.calls.map(call => call[0])).toEqual([
      '/api/scores',
      '/api/leaderboard?limit=10&runId=run+%2F+3'
    ])
  })

  it('rejects successful but malformed API responses before they reach the UI', async () => {
    const malformedRun = createLeaderboardClient(vi.fn().mockResolvedValue(jsonResponse({
      runId: 'missing-token',
      scoringVersion: 'v1'
    }, 201)))
    const malformedBoard = createLeaderboardClient(vi.fn().mockResolvedValue(jsonResponse({
      scoringVersion: 'v1',
      entries: [{ ...entry, id: 'not-a-number', rank: 1 }],
      self: null
    })))
    const malformedSubmission = createLeaderboardClient(vi.fn().mockResolvedValue(jsonResponse({
      entry,
      rank: 'first'
    }, 201)))

    await expect(malformedRun.createRun()).rejects.toMatchObject({ code: 'invalid_response' })
    await expect(malformedBoard.getLeaderboard()).rejects.toMatchObject({ code: 'invalid_response' })
    await expect(malformedSubmission.submitScore({} as never)).rejects.toMatchObject({
      code: 'invalid_response'
    })
  })
})
