import { createHash, timingSafeEqual } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import type { ScoreSubmission } from './validation.js'

const MIGRATIONS = [
  `
    CREATE TABLE runs (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL,
      scoring_version TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      submitted_at INTEGER
    ) STRICT;

    CREATE TABLE scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL UNIQUE REFERENCES runs(id),
      display_name TEXT NOT NULL,
      total_score INTEGER NOT NULL,
      kill_score INTEGER NOT NULL,
      synthesis_score INTEGER NOT NULL,
      breakdown_json TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK (outcome IN ('victory', 'game_over')),
      wave INTEGER NOT NULL,
      mine_health INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      client_version TEXT NOT NULL,
      scoring_version TEXT NOT NULL,
      created_at INTEGER NOT NULL
    ) STRICT;

    CREATE INDEX scores_leaderboard_idx
      ON scores(scoring_version, total_score DESC, created_at ASC, id ASC);
  `,
  `
    CREATE INDEX runs_expiration_idx
      ON runs(submitted_at, expires_at);
  `
]

const EXPIRED_RUN_CLEANUP_LIMIT = 100

export interface LeaderboardEntry {
  id: number
  runId: string
  displayName: string
  totalScore: number
  killScore: number
  synthesisScore: number
  outcome: string
  wave: number
  mineHealth: number
  durationMs: number
  createdAt: string
  rank: number
}

interface RunRow {
  id: string
  token_hash: string
  scoring_version: string
  expires_at: number
  submitted_at: number | null
}

interface ScoreRow {
  id: number
  run_id: string
  display_name: string
  total_score: number
  kill_score: number
  synthesis_score: number
  outcome: string
  wave: number
  mine_health: number
  duration_ms: number
  created_at: number
  rank: number
}

export type SubmitResult =
  | { status: 'ok'; entry: LeaderboardEntry }
  | { status: 'replay'; entry: LeaderboardEntry }
  | { status: 'not_found' }
  | { status: 'invalid_token' }
  | { status: 'expired' }
  | { status: 'version_mismatch' }

export function openDatabase(path: string): Database.Database {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true, mode: 0o750 })
  }

  const database = new Database(path)
  database.pragma('foreign_keys = ON')
  database.pragma('busy_timeout = 5000')
  if (path !== ':memory:') {
    database.pragma('journal_mode = WAL')
    database.pragma('synchronous = NORMAL')
  }
  migrateDatabase(database)
  return database
}

export function migrateDatabase(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    ) STRICT;
  `)

  const appliedRows = database
    .prepare('SELECT version FROM schema_migrations')
    .all() as Array<{ version: number }>
  const applied = new Set(appliedRows.map(row => row.version))

  MIGRATIONS.forEach((sql, index) => {
    const version = index + 1
    if (applied.has(version)) return

    database.transaction(() => {
      database.exec(sql)
      database.prepare(
        'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)'
      ).run(version, Date.now())
    })()
  })
}

export function insertRun(
  database: Database.Database,
  runId: string,
  token: string,
  scoringVersion: string,
  createdAt: number,
  expiresAt: number
): void {
  database.transaction(() => {
    // Bound cleanup work so a burst of run creation cannot turn one request
    // into an unbounded delete. Submitted runs are retained with their scores.
    database.prepare(`
      DELETE FROM runs
      WHERE id IN (
        SELECT id
        FROM runs
        WHERE submitted_at IS NULL AND expires_at < ?
        ORDER BY expires_at ASC, id ASC
        LIMIT ?
      )
    `).run(createdAt, EXPIRED_RUN_CLEANUP_LIMIT)

    database.prepare(`
      INSERT INTO runs(id, token_hash, scoring_version, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(runId, hashToken(token), scoringVersion, createdAt, expiresAt)
  })()
}

export function submitScore(
  database: Database.Database,
  submission: ScoreSubmission,
  now: number
): SubmitResult {
  return database.transaction((): SubmitResult => {
    const run = database.prepare(`
      SELECT id, token_hash, scoring_version, expires_at, submitted_at
      FROM runs
      WHERE id = ?
    `).get(submission.runId) as RunRow | undefined

    if (!run) return { status: 'not_found' }
    if (!tokensMatch(run.token_hash, submission.submissionToken)) {
      return { status: 'invalid_token' }
    }
    if (run.submitted_at !== null) {
      const entry = getRankedEntryByRunId(
        database,
        run.scoring_version,
        run.id
      )
      if (!entry) throw new Error('Submitted run has no score entry')
      return { status: 'replay', entry }
    }
    if (now > run.expires_at) return { status: 'expired' }
    if (run.scoring_version !== submission.scoringVersion) {
      return { status: 'version_mismatch' }
    }

    const insert = database.prepare(`
      INSERT INTO scores(
        run_id,
        display_name,
        total_score,
        kill_score,
        synthesis_score,
        breakdown_json,
        outcome,
        wave,
        mine_health,
        duration_ms,
        client_version,
        scoring_version,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      submission.runId,
      submission.displayName,
      submission.totalScore,
      submission.breakdown.killScore,
      submission.breakdown.synthesisScore,
      JSON.stringify(submission.breakdown),
      submission.outcome,
      submission.wave,
      submission.mineHealth,
      submission.durationMs,
      submission.clientVersion,
      submission.scoringVersion,
      now
    )

    database.prepare('UPDATE runs SET submitted_at = ? WHERE id = ?')
      .run(now, submission.runId)

    const entry = getRankedEntryById(database, Number(insert.lastInsertRowid))
    if (!entry) throw new Error('Inserted score could not be read back')
    return { status: 'ok', entry }
  })()
}

export function getLeaderboard(
  database: Database.Database,
  scoringVersion: string,
  limit: number
): LeaderboardEntry[] {
  const rows = database.prepare(`
    WITH ranked AS (
      SELECT
        id,
        run_id,
        display_name,
        total_score,
        kill_score,
        synthesis_score,
        outcome,
        wave,
        mine_health,
        duration_ms,
        created_at,
        ROW_NUMBER() OVER (
          ORDER BY total_score DESC, created_at ASC, id ASC
        ) AS rank
      FROM scores
      WHERE scoring_version = ?
    )
    SELECT * FROM ranked
    ORDER BY rank ASC
    LIMIT ?
  `).all(scoringVersion, limit) as ScoreRow[]

  return rows.map(toLeaderboardEntry)
}

export function getRankedEntryByRunId(
  database: Database.Database,
  scoringVersion: string,
  runId: string
): LeaderboardEntry | null {
  const row = database.prepare(`
    WITH ranked AS (
      SELECT
        id,
        run_id,
        display_name,
        total_score,
        kill_score,
        synthesis_score,
        outcome,
        wave,
        mine_health,
        duration_ms,
        created_at,
        ROW_NUMBER() OVER (
          ORDER BY total_score DESC, created_at ASC, id ASC
        ) AS rank
      FROM scores
      WHERE scoring_version = ?
    )
    SELECT * FROM ranked WHERE run_id = ?
  `).get(scoringVersion, runId) as ScoreRow | undefined

  return row ? toLeaderboardEntry(row) : null
}

function getRankedEntryById(
  database: Database.Database,
  id: number
): LeaderboardEntry | null {
  const versionRow = database.prepare(
    'SELECT scoring_version FROM scores WHERE id = ?'
  ).get(id) as { scoring_version: string } | undefined
  if (!versionRow) return null

  const row = database.prepare(`
    WITH ranked AS (
      SELECT
        id,
        run_id,
        display_name,
        total_score,
        kill_score,
        synthesis_score,
        outcome,
        wave,
        mine_health,
        duration_ms,
        created_at,
        ROW_NUMBER() OVER (
          ORDER BY total_score DESC, created_at ASC, id ASC
        ) AS rank
      FROM scores
      WHERE scoring_version = ?
    )
    SELECT * FROM ranked WHERE id = ?
  `).get(versionRow.scoring_version, id) as ScoreRow | undefined

  return row ? toLeaderboardEntry(row) : null
}

function toLeaderboardEntry(row: ScoreRow): LeaderboardEntry {
  return {
    id: row.id,
    runId: row.run_id,
    displayName: row.display_name,
    totalScore: row.total_score,
    killScore: row.kill_score,
    synthesisScore: row.synthesis_score,
    outcome: row.outcome,
    wave: row.wave,
    mineHealth: row.mine_health,
    durationMs: row.duration_ms,
    createdAt: new Date(row.created_at).toISOString(),
    rank: row.rank
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function tokensMatch(expectedHash: string, token: string): boolean {
  const expected = Buffer.from(expectedHash, 'hex')
  const actual = Buffer.from(hashToken(token), 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
