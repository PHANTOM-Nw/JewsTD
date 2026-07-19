import { describe, expect, it } from 'vitest'
import type { GameStatus, GridCell } from '../types/game'
import {
  canInspectTowerDuringStatus,
  getBoardClickIntent
} from './boardInteraction'

const storedTowerCell: GridCell = {
  row: 2,
  col: 3,
  type: 'tower',
  towerId: 'stored-tower'
}

function intent(
  gameStatus: GameStatus,
  cell: GridCell = storedTowerCell,
  overrides: Partial<Parameters<typeof getBoardClickIntent>[0]> = {}
) {
  return getBoardClickIntent({
    gameStatus,
    cell,
    existingTowerIds: ['stored-tower', 'round-tower'],
    storedTowerIds: ['stored-tower'],
    currentBatchTowerIds: ['round-tower'],
    inspectedTowerId: null,
    hasPendingAttachment: false,
    ...overrides
  })
}

describe('getBoardClickIntent', () => {
  it.each(['building', 'ready'] as const)(
    'opens inspection and synthesis for a stored tower during %s',
    gameStatus => {
      expect(intent(gameStatus)).toEqual({
        kind: 'inspect_tower',
        towerId: 'stored-tower',
        openSynthesis: true
      })
    }
  )

  it.each(['playing', 'paused'] as const)(
    'opens inspection without synthesis during %s',
    gameStatus => {
      expect(intent(gameStatus)).toEqual({
        kind: 'inspect_tower',
        towerId: 'stored-tower',
        openSynthesis: false
      })
    }
  )

  it('routes current-batch clicks exclusively to the deciding flow', () => {
    expect(intent('deciding', {
      row: 4,
      col: 2,
      type: 'tower',
      towerId: 'round-tower'
    })).toEqual({
      kind: 'select_decision_tower',
      towerId: 'round-tower'
    })
  })

  it('keeps a pending attachment ahead of toggle and synthesis behavior', () => {
    expect(intent('ready', storedTowerCell, {
      inspectedTowerId: 'stored-tower',
      hasPendingAttachment: true
    })).toEqual({
      kind: 'target_attachment',
      towerId: 'stored-tower'
    })
  })

  it('closes inspection when the same tower, an empty cell or a combat wall is clicked', () => {
    expect(intent('playing', storedTowerCell, {
      inspectedTowerId: 'stored-tower'
    })).toEqual({ kind: 'clear_selection' })
    expect(intent('playing', { row: 1, col: 1, type: 'empty' })).toEqual({
      kind: 'clear_selection'
    })
    expect(intent('playing', {
      row: 1,
      col: 1,
      type: 'obstacle',
      mahjongWallKind: 'pure'
    })).toEqual({ kind: 'clear_selection' })
  })

  it('closes tower inspection before opening a wall detail during preparation', () => {
    const wall: GridCell = {
      row: 1,
      col: 1,
      type: 'obstacle',
      mahjongWallKind: 'pure'
    }
    expect(intent('building', wall, {
      inspectedTowerId: 'stored-tower'
    })).toEqual({ kind: 'open_wall', wall })
  })

  it('does not inspect a temporary or stale tower outside the deciding action', () => {
    expect(intent('building', {
      row: 4,
      col: 2,
      type: 'tower',
      towerId: 'round-tower'
    })).toEqual({ kind: 'clear_selection' })
    expect(intent('playing', {
      row: 4,
      col: 2,
      type: 'tower',
      towerId: 'stale-tower'
    })).toEqual({ kind: 'clear_selection' })
  })
})

describe('canInspectTowerDuringStatus', () => {
  it.each(['building', 'ready', 'playing', 'paused'] as const)(
    'keeps inspection available during %s',
    gameStatus => {
      expect(canInspectTowerDuringStatus(gameStatus)).toBe(true)
    }
  )

  it.each(['deciding', 'resolving_hand', 'game_over', 'victory'] as const)(
    'clears inspection during %s',
    gameStatus => {
      expect(canInspectTowerDuringStatus(gameStatus)).toBe(false)
    }
  )
})
