import {
  SCORING_VERSION,
  WAVE_COUNT,
  calculateScore,
  validatePlausibleCounts
} from './scoring.js'
import type {
  EnemyType,
  ScoreBreakdown,
  SynthesisFormation
} from './scoring.js'

const MAX_COUNT = 1_000_000
const MAX_SCORE = 10_000_000
const MAX_DURATION_MS = 24 * 60 * 60 * 1000
const CONTROL_CHARACTER_PATTERN = /[\p{Cc}\p{Cf}]/u

export type GameOutcome = 'victory' | 'game_over'

export interface ScoreSubmission {
  runId: string
  submissionToken: string
  displayName: string
  totalScore: number
  breakdown: ScoreBreakdown
  outcome: GameOutcome
  wave: number
  mineHealth: number
  durationMs: number
  clientVersion: string
  scoringVersion: string
}

export class ValidationError extends Error {
  readonly details: string[]

  constructor(details: string[]) {
    super('The request body is invalid')
    this.name = 'ValidationError'
    this.details = details
  }
}

export function parseScoreSubmission(value: unknown): ScoreSubmission {
  const errors: string[] = []
  const input = requireRecord(value, 'body', errors)
  const breakdownInput = requireRecord(input.breakdown, 'breakdown', errors)

  const runId = readString(input.runId, 'runId', errors, 1, 64)
  const submissionToken = readString(
    input.submissionToken,
    'submissionToken',
    errors,
    32,
    256
  )
  const displayName = normalizeDisplayName(input.displayName, errors)
  const totalScore = readInteger(
    input.totalScore,
    'totalScore',
    errors,
    0,
    MAX_SCORE
  )
  const killScore = readInteger(
    breakdownInput.killScore,
    'breakdown.killScore',
    errors,
    0,
    MAX_SCORE
  )
  const synthesisScore = readInteger(
    breakdownInput.synthesisScore,
    'breakdown.synthesisScore',
    errors,
    0,
    MAX_SCORE
  )
  const killsByType = readCountRecord<EnemyType>(
    breakdownInput.killsByType,
    'breakdown.killsByType',
    ['basic', 'fast', 'tank', 'boss'],
    errors
  )
  const synthesesByFormation = readCountRecord<SynthesisFormation>(
    breakdownInput.synthesesByFormation,
    'breakdown.synthesesByFormation',
    ['pair', 'chow', 'pung', 'kong'],
    errors
  )
  const outcome = readOutcome(input.outcome, errors)
  const wave = readInteger(input.wave, 'wave', errors, 1, WAVE_COUNT)
  const mineHealth = readInteger(input.mineHealth, 'mineHealth', errors, 0, 1000)
  const durationMs = readInteger(
    input.durationMs,
    'durationMs',
    errors,
    0,
    MAX_DURATION_MS
  )
  const clientVersion = readSafeText(
    input.clientVersion,
    'clientVersion',
    errors,
    1,
    64
  )
  const scoringVersion = readString(
    input.scoringVersion,
    'scoringVersion',
    errors,
    1,
    32
  )

  if (errors.length > 0) {
    throw new ValidationError(errors)
  }

  const breakdown: ScoreBreakdown = {
    killScore,
    synthesisScore,
    killsByType,
    synthesesByFormation
  }
  const calculated = calculateScore(breakdown)

  if (killScore !== calculated.killScore) {
    errors.push('breakdown.killScore does not match killsByType')
  }
  if (synthesisScore !== calculated.synthesisScore) {
    errors.push('breakdown.synthesisScore does not match synthesesByFormation')
  }
  if (totalScore !== calculated.totalScore) {
    errors.push('totalScore does not match the submitted breakdown')
  }
  errors.push(...validatePlausibleCounts(breakdown, wave))
  if (outcome === 'victory' && wave !== WAVE_COUNT) {
    errors.push(`victory submissions must end on wave ${WAVE_COUNT}`)
  }

  if (errors.length > 0) {
    throw new ValidationError(errors)
  }

  return {
    runId,
    submissionToken,
    displayName,
    totalScore,
    breakdown,
    outcome,
    wave,
    mineHealth,
    durationMs,
    clientVersion,
    scoringVersion
  }
}

export function assertCurrentScoringVersion(version: string): void {
  if (version !== SCORING_VERSION) {
    throw new ValidationError([
      `scoringVersion must be ${SCORING_VERSION}`
    ])
  }
}

function normalizeDisplayName(value: unknown, errors: string[]): string {
  if (typeof value !== 'string') {
    errors.push('displayName must be a string')
    return ''
  }

  const normalized = value.normalize('NFC').trim()
  const length = Array.from(normalized).length
  if (length < 1 || length > 16) {
    errors.push('displayName must contain 1 to 16 Unicode characters')
  }
  if (CONTROL_CHARACTER_PATTERN.test(normalized)) {
    errors.push('displayName must not contain control or formatting characters')
  }
  return normalized
}

function readOutcome(value: unknown, errors: string[]): GameOutcome {
  if (value !== 'victory' && value !== 'game_over') {
    errors.push("outcome must be 'victory' or 'game_over'")
    return 'game_over'
  }
  return value
}

function readCountRecord<Key extends string>(
  value: unknown,
  path: string,
  keys: readonly Key[],
  errors: string[]
): Record<Key, number> {
  const input = requireRecord(value, path, errors)
  return Object.fromEntries(
    keys.map(key => [
      key,
      readInteger(input[key], `${path}.${key}`, errors, 0, MAX_COUNT)
    ])
  ) as Record<Key, number>
}

function requireRecord(
  value: unknown,
  path: string,
  errors: string[]
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push(`${path} must be a JSON object`)
    return {}
  }
  return value as Record<string, unknown>
}

function readInteger(
  value: unknown,
  path: string,
  errors: string[],
  minimum: number,
  maximum: number
): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    errors.push(`${path} must be a safe integer from ${minimum} to ${maximum}`)
    return minimum
  }
  return value as number
}

function readSafeText(
  value: unknown,
  path: string,
  errors: string[],
  minimumLength: number,
  maximumLength: number
): string {
  const text = readString(value, path, errors, minimumLength, maximumLength)
  if (CONTROL_CHARACTER_PATTERN.test(text)) {
    errors.push(`${path} must not contain control or formatting characters`)
  }
  return text
}

function readString(
  value: unknown,
  path: string,
  errors: string[],
  minimumLength: number,
  maximumLength: number
): string {
  if (typeof value !== 'string') {
    errors.push(`${path} must be a string`)
    return ''
  }
  const length = Array.from(value).length
  if (length < minimumLength || length > maximumLength) {
    errors.push(`${path} must contain ${minimumLength} to ${maximumLength} characters`)
  }
  return value
}
