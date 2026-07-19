import type { ScoreState } from '../types/game'

export const LEADERBOARD_LIMIT = 10

export interface RunSession {
  runId: string
  submissionToken: string
  scoringVersion: string
}

export interface ScoreCounters {
  killsByType: {
    basic: number
    fast: number
    tank: number
    boss: number
  }
  synthesesByFormation: {
    pair: number
    chow: number
    pung: number
    kong: number
  }
}

export interface ScoreSubmission {
  runId: string
  submissionToken: string
  displayName: string
  totalScore: number
  breakdown: {
    killScore: number
    synthesisScore: number
  } & ScoreCounters
  outcome: 'victory' | 'game_over'
  wave: number
  mineHealth: number
  durationMs: number
  clientVersion: string
  scoringVersion: string
}

export interface FinishedRunDetails {
  outcome: ScoreSubmission['outcome']
  wave: number
  mineHealth: number
  durationMs: number
  clientVersion: string
  scoringVersion: string
}

export function createScoreSubmission(
  session: RunSession,
  displayName: string,
  score: ScoreState,
  details: FinishedRunDetails
): ScoreSubmission {
  return {
    runId: session.runId,
    submissionToken: session.submissionToken,
    displayName,
    totalScore: score.total,
    breakdown: {
      killScore: score.killScore,
      synthesisScore: score.synthesisScore,
      killsByType: {
        basic: score.killsByEnemyType.basic,
        fast: score.killsByEnemyType.fast,
        tank: score.killsByEnemyType.tank,
        boss: score.killsByEnemyType.boss
      },
      synthesesByFormation: {
        pair: score.synthesesByFormation.pair,
        chow: score.synthesesByFormation.chow,
        pung: score.synthesesByFormation.pung,
        kong: score.synthesesByFormation.kong
      }
    },
    ...details
  }
}

export interface LeaderboardEntry {
  id: number
  runId: string
  displayName: string
  totalScore: number
  killScore: number
  synthesisScore: number
  outcome: 'victory' | 'game_over'
  wave: number
  mineHealth: number
  durationMs: number
  createdAt: string
  rank?: number
}

export interface ScoreSubmissionResult {
  entry: LeaderboardEntry
  rank: number
}

export interface LeaderboardResult {
  scoringVersion: string
  entries: Array<LeaderboardEntry & { rank: number }>
  self: (LeaderboardEntry & { rank: number }) | null
}

export function assertCompatibleScoringVersion(
  session: RunSession,
  expectedVersion: string
): RunSession {
  if (session.scoringVersion !== expectedVersion) {
    throw new LeaderboardApiError(
      'Leaderboard scoring version is incompatible',
      'version_mismatch',
      409
    )
  }
  return session
}

export class LeaderboardApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: unknown

  constructor(message: string, code = 'network_error', status = 0, details?: unknown) {
    super(message)
    this.name = 'LeaderboardApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function invalidResponse(): never {
  throw new LeaderboardApiError(
    '排行榜返回了无法识别的数据',
    'invalid_response',
    200
  )
}

function parseRunSession(value: unknown): RunSession {
  if (!isRecord(value)
    || typeof value.runId !== 'string'
    || value.runId.length === 0
    || typeof value.submissionToken !== 'string'
    || value.submissionToken.length === 0
    || typeof value.scoringVersion !== 'string'
    || value.scoringVersion.length === 0) {
    return invalidResponse()
  }
  return {
    runId: value.runId,
    submissionToken: value.submissionToken,
    scoringVersion: value.scoringVersion
  }
}

function parseLeaderboardEntry(value: unknown): LeaderboardEntry {
  if (!isRecord(value)
    || !isFiniteNumber(value.id)
    || typeof value.runId !== 'string'
    || typeof value.displayName !== 'string'
    || !isFiniteNumber(value.totalScore)
    || !isFiniteNumber(value.killScore)
    || !isFiniteNumber(value.synthesisScore)
    || (value.outcome !== 'victory' && value.outcome !== 'game_over')
    || !isFiniteNumber(value.wave)
    || !isFiniteNumber(value.mineHealth)
    || !isFiniteNumber(value.durationMs)
    || typeof value.createdAt !== 'string'
    || (value.rank !== undefined && !isFiniteNumber(value.rank))) {
    return invalidResponse()
  }
  return value as unknown as LeaderboardEntry
}

function parseRankedEntry(value: unknown): LeaderboardEntry & { rank: number } {
  const entry = parseLeaderboardEntry(value)
  if (!isFiniteNumber(entry.rank)) return invalidResponse()
  return { ...entry, rank: entry.rank }
}

function parseScoreSubmissionResult(value: unknown): ScoreSubmissionResult {
  if (!isRecord(value) || !isFiniteNumber(value.rank)) return invalidResponse()
  return {
    entry: parseLeaderboardEntry(value.entry),
    rank: value.rank
  }
}

function parseLeaderboardResult(value: unknown): LeaderboardResult {
  if (!isRecord(value)
    || typeof value.scoringVersion !== 'string'
    || value.scoringVersion.length === 0
    || !Array.isArray(value.entries)
    || (value.self !== null && !isRecord(value.self))) {
    return invalidResponse()
  }
  return {
    scoringVersion: value.scoringVersion,
    entries: value.entries.map(parseRankedEntry),
    self: value.self === null ? null : parseRankedEntry(value.self)
  }
}

async function requestJson<T>(
  fetcher: Fetcher,
  input: string,
  init?: RequestInit
): Promise<T> {
  let response: Response
  try {
    response = await fetcher(input, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init?.headers
      }
    })
  } catch {
    throw new LeaderboardApiError('无法连接排行榜服务，请稍后重试')
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new LeaderboardApiError(
      response.ok ? '排行榜返回了无法识别的数据' : '排行榜服务暂时不可用',
      'invalid_response',
      response.status
    )
  }

  if (!response.ok) {
    const apiError = isRecord(body) && isRecord(body.error) ? body.error : null
    throw new LeaderboardApiError(
      typeof apiError?.message === 'string'
        ? apiError.message
        : '排行榜请求失败，请稍后重试',
      typeof apiError?.code === 'string' ? apiError.code : 'request_failed',
      response.status,
      apiError?.details
    )
  }

  return body as T
}

export function createLeaderboardClient(fetcher: Fetcher = fetch) {
  return {
    createRun(signal?: AbortSignal) {
      return requestJson<unknown>(fetcher, '/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal
      }).then(parseRunSession)
    },

    submitScore(submission: ScoreSubmission, signal?: AbortSignal) {
      return requestJson<unknown>(fetcher, '/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
        signal
      }).then(parseScoreSubmissionResult)
    },

    getLeaderboard(runId?: string, signal?: AbortSignal) {
      const params = new URLSearchParams({ limit: String(LEADERBOARD_LIMIT) })
      if (runId) params.set('runId', runId)
      return requestJson<unknown>(
        fetcher,
        `/api/leaderboard?${params.toString()}`,
        { signal }
      ).then(parseLeaderboardResult)
    }
  }
}

export interface ReconciledScoreSubmissionResult extends ScoreSubmissionResult {
  reconciled: boolean
  leaderboard: LeaderboardResult | null
}

export async function submitScoreWithReconciliation(
  client: ReturnType<typeof createLeaderboardClient>,
  submission: ScoreSubmission
): Promise<ReconciledScoreSubmissionResult> {
  try {
    const result = await client.submitScore(submission)
    return { ...result, reconciled: false, leaderboard: null }
  } catch (submissionError) {
    try {
      const leaderboard = await client.getLeaderboard(submission.runId)
      if (leaderboard.self) {
        return {
          entry: leaderboard.self,
          rank: leaderboard.self.rank,
          reconciled: true,
          leaderboard
        }
      }
    } catch {
      // The original submission error is more relevant when reconciliation is unavailable.
    }
    throw submissionError
  }
}

export const leaderboardClient = createLeaderboardClient()
