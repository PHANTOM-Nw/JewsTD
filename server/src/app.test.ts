import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApiServer } from './app.js'
import { openDatabase } from './database.js'

interface RunResponse {
  runId: string
  submissionToken: string
  scoringVersion: string
}

let database: Database.Database
let server: Server
let baseUrl: string
let currentTime: number

beforeEach(async () => {
  currentTime = 1_700_000_000_000
  database = openDatabase(':memory:')
  server = createApiServer({
    database,
    now: () => currentTime
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  })
  database.close()
})

describe('leaderboard API', () => {
  it('creates a run, accepts one verified score and returns its rank', async () => {
    const firstRun = await createRun()
    const secondRun = await createRun()

    const firstSubmission = await submit(firstRun, {
      displayName: 'First',
      killsByType: { basic: 5, fast: 0, tank: 0, boss: 0 },
      synthesesByFormation: { pair: 0, chow: 0, pung: 0, kong: 0 },
      wave: 1
    })
    expect(firstSubmission.status).toBe(201)

    const secondSubmission = await submit(secondRun, {
      displayName: 'Second',
      killsByType: { basic: 5, fast: 3, tank: 0, boss: 0 },
      synthesesByFormation: { pair: 1, chow: 0, pung: 0, kong: 0 },
      wave: 3
    })
    expect(secondSubmission.status).toBe(201)

    const leaderboardResponse = await fetch(
      `${baseUrl}/api/leaderboard?limit=10&runId=${firstRun.runId}`
    )
    const leaderboard = await leaderboardResponse.json() as {
      scoringVersion: string
      entries: Array<{ displayName: string; rank: number }>
      self: { displayName: string; rank: number }
    }

    expect(leaderboard.scoringVersion).toBe('v1')
    expect(leaderboard.entries.map(entry => entry.displayName)).toEqual([
      'Second',
      'First'
    ])
    expect(leaderboard.self).toMatchObject({ displayName: 'First', rank: 2 })

    const replay = await submit(firstRun, {
      displayName: 'Changed name',
      killsByType: { basic: 5, fast: 3, tank: 0, boss: 0 },
      synthesesByFormation: { pair: 1, chow: 0, pung: 0, kong: 0 },
      wave: 3
    })
    expect(replay.status).toBe(200)
    expect(await replay.json()).toMatchObject({
      entry: {
        displayName: 'First',
        totalScore: 50,
        rank: 2
      },
      rank: 2
    })
  })

  it('uses creation order and then id as the stable tie breaker', async () => {
    const firstRun = await createRun()
    const secondRun = await createRun()
    const score = {
      killsByType: { basic: 5, fast: 0, tank: 0, boss: 0 },
      synthesesByFormation: { pair: 0, chow: 0, pung: 0, kong: 0 },
      wave: 1
    }

    await submit(firstRun, { ...score, displayName: 'Earlier' })
    await submit(secondRun, { ...score, displayName: 'Later' })

    const response = await fetch(`${baseUrl}/api/leaderboard`)
    const body = await response.json() as {
      entries: Array<{ displayName: string; rank: number }>
    }
    expect(body.entries).toEqual([
      expect.objectContaining({ displayName: 'Earlier', rank: 1 }),
      expect.objectContaining({ displayName: 'Later', rank: 2 })
    ])
  })

  it('rejects an invalid token without consuming the run', async () => {
    const run = await createRun()
    const invalidRun = { ...run, submissionToken: 'z'.repeat(43) }
    const score = {
      displayName: 'Player',
      killsByType: { basic: 1, fast: 0, tank: 0, boss: 0 },
      synthesesByFormation: { pair: 0, chow: 0, pung: 0, kong: 0 },
      wave: 1
    }

    const invalid = await submit(invalidRun, score)
    expect(invalid.status).toBe(403)
    expect(await invalid.json()).toMatchObject({
      error: { code: 'invalid_submission_token' }
    })

    expect((await submit(run, score)).status).toBe(201)
  })

  it('rejects a score after its submission token expires', async () => {
    const run = await createRun()
    currentTime += 24 * 60 * 60 * 1000 + 1

    const response = await submit(run, {
      displayName: 'Player',
      killsByType: { basic: 1, fast: 0, tank: 0, boss: 0 },
      synthesesByFormation: { pair: 0, chow: 0, pung: 0, kong: 0 },
      wave: 1
    })

    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({
      error: { code: 'submission_token_expired' }
    })
  })

  it('exposes a health check and rejects inconsistent score details', async () => {
    const health = await fetch(`${baseUrl}/api/health`)
    expect(await health.json()).toEqual({ status: 'ok', scoringVersion: 'v1' })

    const run = await createRun()
    const response = await fetch(`${baseUrl}/api/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...scoreBody(run, {
          displayName: 'Player',
          killsByType: { basic: 1, fast: 0, tank: 0, boss: 0 },
          synthesesByFormation: { pair: 0, chow: 0, pung: 0, kong: 0 },
          wave: 1
        }),
        totalScore: 999
      })
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: { code: 'validation_error' }
    })
  })

  it('rate limits excessive run creation per client and route', async () => {
    const responses = []
    for (let index = 0; index < 11; index += 1) {
      responses.push(await fetch(`${baseUrl}/api/runs`, { method: 'POST' }))
    }

    expect(responses.slice(0, 10).every(response => response.status === 201)).toBe(true)
    expect(responses[10].status).toBe(429)
    expect(responses[10].headers.get('retry-after')).toBe('60')
    expect(await responses[10].json()).toMatchObject({
      error: { code: 'rate_limited' }
    })
  })

  it('cleans at most 100 expired unsubmitted runs before creating a run', async () => {
    const insert = database.prepare(`
      INSERT INTO runs(
        id,
        token_hash,
        scoring_version,
        created_at,
        expires_at,
        submitted_at
      ) VALUES (?, ?, 'v1', ?, ?, ?)
    `)
    for (let index = 0; index < 120; index += 1) {
      insert.run(
        `expired-${String(index).padStart(3, '0')}`,
        '0'.repeat(64),
        currentTime - 2000,
        currentTime - 1000,
        null
      )
    }
    for (let index = 0; index < 3; index += 1) {
      insert.run(
        `submitted-${index}`,
        '0'.repeat(64),
        currentTime - 2000,
        currentTime - 1000,
        currentTime - 500
      )
    }

    expect((await createRun()).scoringVersion).toBe('v1')

    const expired = database.prepare(`
      SELECT COUNT(*) AS count
      FROM runs
      WHERE submitted_at IS NULL AND expires_at < ?
    `).get(currentTime) as { count: number }
    const submitted = database.prepare(`
      SELECT COUNT(*) AS count FROM runs WHERE submitted_at IS NOT NULL
    `).get() as { count: number }
    const indexes = database.prepare("PRAGMA index_list('runs')").all() as Array<{
      name: string
    }>

    expect(expired.count).toBe(20)
    expect(submitted.count).toBe(3)
    expect(indexes.map(index => index.name)).toContain('runs_expiration_idx')
  })
})

async function createRun(): Promise<RunResponse> {
  const response = await fetch(`${baseUrl}/api/runs`, { method: 'POST' })
  expect(response.status).toBe(201)
  return response.json() as Promise<RunResponse>
}

interface ScoreOptions {
  displayName: string
  killsByType: { basic: number; fast: number; tank: number; boss: number }
  synthesesByFormation: { pair: number; chow: number; pung: number; kong: number }
  wave: number
}

async function submit(run: RunResponse, options: ScoreOptions): Promise<Response> {
  return fetch(`${baseUrl}/api/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scoreBody(run, options))
  })
}

function scoreBody(run: RunResponse, options: ScoreOptions): Record<string, unknown> {
  const killScore = options.killsByType.basic * 10
    + options.killsByType.fast * 20
    + options.killsByType.tank * 50
    + options.killsByType.boss * 500
  const synthesisScore = options.synthesesByFormation.pair * 100
    + options.synthesesByFormation.chow * 200
    + options.synthesesByFormation.pung * 300
    + options.synthesesByFormation.kong * 400

  return {
    runId: run.runId,
    submissionToken: run.submissionToken,
    displayName: options.displayName,
    totalScore: killScore + synthesisScore,
    breakdown: {
      killScore,
      synthesisScore,
      killsByType: options.killsByType,
      synthesesByFormation: options.synthesesByFormation
    },
    outcome: 'game_over',
    wave: options.wave,
    mineHealth: 0,
    durationMs: 60_000,
    clientVersion: '0.1.0',
    scoringVersion: run.scoringVersion
  }
}
