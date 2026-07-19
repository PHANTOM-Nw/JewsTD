# Leaderboard API

The leaderboard is a Node.js 20+ service backed by SQLite. It listens on
`127.0.0.1:3001` by default and is intended to be exposed by the same Nginx
origin as the game.

## Commands and environment

```bash
npm run build:server
DATABASE_PATH=/tmp/jewstd.sqlite npm run server:migrate
DATABASE_PATH=/tmp/jewstd.sqlite npm run server:start
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `API_HOST` | `127.0.0.1` | Listen address; keep loopback behind Nginx |
| `API_PORT` | `3001` | Listen port |
| `DATABASE_PATH` | `server/data/leaderboard.sqlite` | Persistent SQLite file |
| `RUN_TTL_MS` | `86400000` | Run submission-token lifetime (1 minute–7 days) |

Schema migrations run at process startup and through `server:migrate`. File
databases use WAL, foreign keys and a busy timeout. Production data must live
outside the API release and frontend `dist` directories.

## JSON contract (`scoringVersion: "v1"`)

`POST /api/runs` accepts an empty body or `{}` and returns HTTP 201:

```json
{
  "runId": "uuid",
  "submissionToken": "one-time-secret",
  "scoringVersion": "v1"
}
```

`POST /api/scores` requires `Content-Type: application/json`:

```json
{
  "runId": "uuid",
  "submissionToken": "one-time-secret",
  "displayName": "Player",
  "totalScore": 720,
  "breakdown": {
    "killScore": 120,
    "synthesisScore": 600,
    "killsByType": { "basic": 3, "fast": 2, "tank": 1, "boss": 0 },
    "synthesesByFormation": { "pair": 1, "chow": 1, "pung": 1, "kong": 0 }
  },
  "outcome": "game_over",
  "wave": 8,
  "mineHealth": 0,
  "durationMs": 60000,
  "clientVersion": "0.1.0",
  "scoringVersion": "v1"
}
```

The API rejects a submission unless every subtotal and total matches the
weighted counts. A successful first submission returns HTTP 201 with
`{ "entry": LeaderboardEntry, "rank": 1 }`. Replaying the same valid run ID
and token returns the original stored entry and its current rank with HTTP 200;
replayed name or score fields never overwrite the stored result. The run ID is
unique and the secret is stored only as a SHA-256 hash.

`GET /api/leaderboard?limit=10&runId=<uuid>` returns:

```json
{
  "scoringVersion": "v1",
  "entries": [],
  "self": null
}
```

Entries include `id`, `runId`, `displayName`, `totalScore`, `killScore`,
`synthesisScore`, `outcome`, `wave`, `mineHealth`, `durationMs`, `createdAt`
and `rank`. Ranking is stable by score descending, creation time ascending,
then row ID ascending. `limit` is 1–100. `self` contains the requested run's
ranked entry even when it is outside the returned top entries.

`GET /api/health` returns `{ "status": "ok", "scoringVersion": "v1" }`.

Errors have the shape
`{ "error": { "code": "validation_error", "message": "...", "details": [] } }`.
Public codes include `invalid_json`, `payload_too_large`,
`unsupported_media_type`, `validation_error`, `version_mismatch`,
`invalid_submission_token`, `submission_token_expired`,
`not_found`, `rate_limited` and `internal_error`.

Creating a run deletes at most 100 expired, unsubmitted run rows in the same
transaction. An index on `(submitted_at, expires_at)` keeps this bounded cleanup
efficient; submitted runs and their leaderboard entries are retained.

This is a casual leaderboard: server-side score recomputation, per-wave
ceilings, token hashing, body limits and in-memory IP rate limiting reject
accidental or simple forged submissions, but a browser client remains capable
of fabricating a plausible play history. Competitive integrity would require a
server-verifiable event log or deterministic replay.
