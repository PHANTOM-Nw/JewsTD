import { describe, expect, it } from 'vitest'
import { parseScoreSubmission } from './validation.js'

function validSubmission(): Record<string, unknown> {
  return {
    runId: 'run-id',
    submissionToken: 'x'.repeat(43),
    displayName: ' 玩家 ',
    totalScore: 720,
    breakdown: {
      killScore: 120,
      synthesisScore: 600,
      killsByType: { basic: 3, fast: 2, tank: 1, boss: 0 },
      synthesesByFormation: { pair: 1, chow: 1, pung: 1, kong: 0 }
    },
    outcome: 'game_over',
    wave: 8,
    mineHealth: 0,
    durationMs: 60_000,
    clientVersion: '0.1.0',
    scoringVersion: 'v1'
  }
}

describe('parseScoreSubmission', () => {
  it('normalizes a valid Unicode display name and accepts pung as 300 points', () => {
    const input = validSubmission()
    input.displayName = '  e\u0301雀  '

    expect(parseScoreSubmission(input)).toMatchObject({
      displayName: 'é雀',
      totalScore: 720,
      breakdown: {
        killScore: 120,
        synthesisScore: 600
      }
    })
  })

  it('rejects a total that does not match the server calculation', () => {
    const input = validSubmission()
    input.totalScore = 931

    expect(() => parseScoreSubmission(input)).toThrow(
      /request body is invalid/i
    )
  })

  it('rejects control characters and names longer than 16 code points', () => {
    const control = validSubmission()
    control.displayName = 'player\u200Bname'
    expect(() => parseScoreSubmission(control)).toThrow()

    const long = validSubmission()
    long.displayName = '雀'.repeat(17)
    expect(() => parseScoreSubmission(long)).toThrow()
  })

  it('rejects counts above wave spawn and synthesis ceilings', () => {
    const input = validSubmission()
    input.wave = 1

    expect(() => parseScoreSubmission(input)).toThrow()
  })

  it('allows a second-wave pair, wall-assisted pung and white-assisted kong', () => {
    const input = validSubmission()
    input.wave = 2
    input.totalScore = 800
    input.breakdown = {
      killScore: 0,
      synthesisScore: 800,
      killsByType: { basic: 0, fast: 0, tank: 0, boss: 0 },
      synthesesByFormation: { pair: 1, chow: 0, pung: 1, kong: 1 }
    }

    expect(parseScoreSubmission(input)).toMatchObject({
      wave: 2,
      totalScore: 800
    })
  })

  it('requires victory submissions to end on wave 12', () => {
    const input = validSubmission()
    input.outcome = 'victory'

    expect(() => parseScoreSubmission(input)).toThrow()
  })
})
