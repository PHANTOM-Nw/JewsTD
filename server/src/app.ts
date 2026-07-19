import { randomBytes, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import type {
  IncomingMessage,
  Server,
  ServerResponse
} from 'node:http'
import type Database from 'better-sqlite3'
import {
  getLeaderboard,
  getRankedEntryByRunId,
  insertRun,
  submitScore
} from './database.js'
import { MemoryRateLimiter } from './rateLimit.js'
import { SCORING_VERSION } from './scoring.js'
import {
  ValidationError,
  assertCurrentScoringVersion,
  parseScoreSubmission
} from './validation.js'

const MAX_BODY_BYTES = 16 * 1024
const DEFAULT_RUN_TTL_MS = 24 * 60 * 60 * 1000

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly headers?: Record<string, string>
  ) {
    super(message)
  }
}

export interface ApiServerOptions {
  database: Database.Database
  now?: () => number
  runTtlMs?: number
  rateLimits?: Partial<Record<RateLimitRoute, RateLimitConfig>>
}

type RateLimitRoute = 'runs' | 'scores' | 'leaderboard' | 'health' | 'other'

interface RateLimitConfig {
  maximum: number
  windowMs: number
}

const DEFAULT_RATE_LIMITS: Record<RateLimitRoute, RateLimitConfig> = {
  runs: { maximum: 10, windowMs: 60_000 },
  scores: { maximum: 5, windowMs: 60_000 },
  leaderboard: { maximum: 60, windowMs: 60_000 },
  health: { maximum: 120, windowMs: 60_000 },
  other: { maximum: 60, windowMs: 60_000 }
}

export function createApiServer(options: ApiServerOptions): Server {
  const now = options.now ?? Date.now
  const limiters = Object.fromEntries(
    (Object.keys(DEFAULT_RATE_LIMITS) as RateLimitRoute[]).map(route => {
      const config = options.rateLimits?.[route] ?? DEFAULT_RATE_LIMITS[route]
      return [route, new MemoryRateLimiter(config.maximum, config.windowMs, now)]
    })
  ) as Record<RateLimitRoute, MemoryRateLimiter>

  return createServer(async (request, response) => {
    try {
      setCommonHeaders(response)
      const url = new URL(request.url ?? '/', 'http://localhost')
      enforceRateLimit(request, response, limiters, url.pathname)

      if (request.method === 'GET' && url.pathname === '/api/health') {
        options.database.prepare('SELECT 1').get()
        sendJson(response, 200, {
          status: 'ok',
          scoringVersion: SCORING_VERSION
        })
        return
      }

      if (request.method === 'POST' && url.pathname === '/api/runs') {
        await assertEmptyOrJsonObject(request)
        const createdAt = now()
        const runId = randomUUID()
        const submissionToken = randomBytes(32).toString('base64url')
        insertRun(
          options.database,
          runId,
          submissionToken,
          SCORING_VERSION,
          createdAt,
          createdAt + (options.runTtlMs ?? DEFAULT_RUN_TTL_MS)
        )
        sendJson(response, 201, {
          runId,
          submissionToken,
          scoringVersion: SCORING_VERSION
        })
        return
      }

      if (request.method === 'POST' && url.pathname === '/api/scores') {
        const submission = parseScoreSubmission(await readJsonBody(request))
        if (submission.scoringVersion !== SCORING_VERSION) {
          throw new ApiError(
            409,
            'version_mismatch',
            `This leaderboard accepts scoringVersion ${SCORING_VERSION}`
          )
        }
        assertCurrentScoringVersion(submission.scoringVersion)

        const result = submitScore(options.database, submission, now())
        if (result.status !== 'ok' && result.status !== 'replay') {
          throw submitResultError(result.status)
        }

        sendJson(response, result.status === 'ok' ? 201 : 200, {
          entry: result.entry,
          rank: result.entry.rank
        })
        return
      }

      if (request.method === 'GET' && url.pathname === '/api/leaderboard') {
        const limit = parseLimit(url.searchParams.get('limit'))
        const runId = parseOptionalRunId(url.searchParams.get('runId'))
        sendJson(response, 200, {
          scoringVersion: SCORING_VERSION,
          entries: getLeaderboard(options.database, SCORING_VERSION, limit),
          self: runId
            ? getRankedEntryByRunId(options.database, SCORING_VERSION, runId)
            : null
        })
        return
      }

      throw new ApiError(404, 'not_found', 'API route not found')
    } catch (error) {
      sendError(response, error)
    }
  })
}

function enforceRateLimit(
  request: IncomingMessage,
  response: ServerResponse,
  limiters: Record<RateLimitRoute, MemoryRateLimiter>,
  path: string
): void {
  const remoteAddress = request.socket.remoteAddress ?? 'unknown'
  const forwardedAddress = remoteAddress === '127.0.0.1' || remoteAddress === '::1'
    ? request.headers['x-real-ip']
    : undefined
  const clientAddress = typeof forwardedAddress === 'string'
    ? forwardedAddress
    : remoteAddress
  const route = getRateLimitRoute(request.method, path)
  const result = limiters[route].consume(clientAddress)
  if (!result.allowed) {
    response.setHeader('Retry-After', result.retryAfterSeconds)
    throw new ApiError(
      429,
      'rate_limited',
      'Too many requests; please retry later'
    )
  }
}

function getRateLimitRoute(
  method: string | undefined,
  path: string
): RateLimitRoute {
  if (method === 'POST' && path === '/api/runs') return 'runs'
  if (method === 'POST' && path === '/api/scores') return 'scores'
  if (method === 'GET' && path === '/api/leaderboard') return 'leaderboard'
  if (method === 'GET' && path === '/api/health') return 'health'
  return 'other'
}

async function assertEmptyOrJsonObject(request: IncomingMessage): Promise<void> {
  const body = await readBody(request)
  if (body.length === 0) return
  const parsed = parseJson(body)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ApiError(400, 'validation_error', 'The request body must be a JSON object')
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers['content-type']?.split(';', 1)[0].trim()
  if (contentType !== 'application/json') {
    throw new ApiError(
      415,
      'unsupported_media_type',
      'Content-Type must be application/json'
    )
  }
  const body = await readBody(request)
  if (body.length === 0) {
    throw new ApiError(400, 'invalid_json', 'A JSON request body is required')
  }
  return parseJson(body)
}

async function readBody(request: IncomingMessage): Promise<string> {
  const declaredLength = Number(request.headers['content-length'])
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new ApiError(413, 'payload_too_large', 'Request body is too large')
  }

  const chunks: Buffer[] = []
  let length = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    length += buffer.length
    if (length > MAX_BODY_BYTES) {
      throw new ApiError(413, 'payload_too_large', 'Request body is too large')
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body) as unknown
  } catch {
    throw new ApiError(400, 'invalid_json', 'Request body is not valid JSON')
  }
}

function parseLimit(value: string | null): number {
  if (value === null) return 10
  if (!/^\d+$/.test(value)) {
    throw new ApiError(400, 'validation_error', 'limit must be an integer from 1 to 100')
  }
  const limit = Number(value)
  if (limit < 1 || limit > 100) {
    throw new ApiError(400, 'validation_error', 'limit must be an integer from 1 to 100')
  }
  return limit
}

function parseOptionalRunId(value: string | null): string | null {
  if (value === null) return null
  if (value.length < 1 || value.length > 64) {
    throw new ApiError(400, 'validation_error', 'runId must contain 1 to 64 characters')
  }
  return value
}

function submitResultError(status: Exclude<
  ReturnType<typeof submitScore>['status'],
  'ok' | 'replay'
>): ApiError {
  switch (status) {
    case 'not_found':
      return new ApiError(404, 'not_found', 'Run not found')
    case 'invalid_token':
      return new ApiError(403, 'invalid_submission_token', 'Submission token is invalid')
    case 'expired':
      return new ApiError(410, 'submission_token_expired', 'Submission token has expired')
    case 'version_mismatch':
      return new ApiError(409, 'version_mismatch', 'Run scoring version does not match')
  }
}

function sendError(response: ServerResponse, error: unknown): void {
  if (response.headersSent) {
    response.end()
    return
  }

  if (error instanceof ValidationError) {
    sendJson(response, 400, {
      error: {
        code: 'validation_error',
        message: error.message,
        details: error.details
      }
    })
    return
  }

  if (error instanceof ApiError) {
    for (const [name, value] of Object.entries(error.headers ?? {})) {
      response.setHeader(name, value)
    }
    sendJson(response, error.status, {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details })
      }
    })
    return
  }

  console.error(error)
  sendJson(response, 500, {
    error: {
      code: 'internal_error',
      message: 'An internal server error occurred'
    }
  })
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown
): void {
  const json = JSON.stringify(body)
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Content-Length', Buffer.byteLength(json))
  response.end(json)
}

function setCommonHeaders(response: ServerResponse): void {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
}
