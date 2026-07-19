import { resolve } from 'node:path'

export interface ServerConfig {
  host: string
  port: number
  databasePath: string
  runTtlMs: number
}

export function readServerConfig(
  environment: NodeJS.ProcessEnv = process.env
): ServerConfig {
  return {
    host: environment.API_HOST || '127.0.0.1',
    port: readInteger(environment.API_PORT, 3001, 1, 65535, 'API_PORT'),
    databasePath: environment.DATABASE_PATH
      || resolve(process.cwd(), 'server/data/leaderboard.sqlite'),
    runTtlMs: readInteger(
      environment.RUN_TTL_MS,
      24 * 60 * 60 * 1000,
      60_000,
      7 * 24 * 60 * 60 * 1000,
      'RUN_TTL_MS'
    )
  }
}

function readInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string
): number {
  if (value === undefined || value === '') return fallback
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`)
  }
  const parsed = Number(value)
  if (parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`)
  }
  return parsed
}
