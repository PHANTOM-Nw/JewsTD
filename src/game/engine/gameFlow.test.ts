import { describe, expect, it } from 'vitest'
import {
  canFinalizeTowerBatch,
  canInspectSynthesisFromTower,
  canSynthesizeTowers,
  canStartConfiguredWave,
  getCompletedWaveForNotice,
  getStateAfterMineDamage,
  getStatusAfterPlacement,
  getStatusAfterWave
} from './gameFlow'

describe('build and wave flow', () => {
  it('enters the decision phase only after the full tower batch is placed', () => {
    expect(getStatusAfterPlacement(4, 5)).toEqual({
      gameStatus: 'building',
      canPlaceTowers: true
    })
    expect(getStatusAfterPlacement(5, 5)).toEqual({
      gameStatus: 'deciding',
      canPlaceTowers: false
    })
  })

  it('requires exactly one valid keep choice from a complete batch', () => {
    const batch = ['a', 'b', 'c', 'd', 'e']

    expect(canFinalizeTowerBatch(batch, 'c', 5)).toBe(true)
    expect(canFinalizeTowerBatch(batch.slice(0, 4), 'c', 5)).toBe(false)
    expect(canFinalizeTowerBatch(batch, 'missing', 5)).toBe(false)
  })

  it('starts a wave only from the ready phase with a valid path', () => {
    expect(canStartConfiguredWave('ready', 0, 12, true)).toBe(true)
    expect(canStartConfiguredWave('building', 0, 12, true)).toBe(false)
    expect(canStartConfiguredWave('deciding', 0, 12, true)).toBe(false)
    expect(canStartConfiguredWave('ready', 0, 12, false)).toBe(false)
    expect(canStartConfiguredWave('ready', 12, 12, true)).toBe(false)
  })

  it('allows existing towers to open the synthesis list during preparation and combat', () => {
    expect(canInspectSynthesisFromTower('building')).toBe(true)
    expect(canInspectSynthesisFromTower('ready')).toBe(true)
    expect(canInspectSynthesisFromTower('playing')).toBe(true)
    expect(canInspectSynthesisFromTower('paused')).toBe(true)
    expect(canInspectSynthesisFromTower('deciding')).toBe(false)
    expect(canInspectSynthesisFromTower('game_over')).toBe(false)
    expect(canInspectSynthesisFromTower('victory')).toBe(false)
  })

  it('keeps synthesis actions locked while a wave is active', () => {
    expect(canSynthesizeTowers('building')).toBe(true)
    expect(canSynthesizeTowers('ready')).toBe(true)
    expect(canSynthesizeTowers('playing')).toBe(false)
    expect(canSynthesizeTowers('paused')).toBe(false)
  })

  it('moves directly to victory after the final configured wave', () => {
    expect(getStatusAfterWave(11, 12)).toBe('building')
    expect(getStatusAfterWave(12, 12)).toBe('victory')
  })

  it('shows a completed-wave notice until the next wave starts', () => {
    expect(getCompletedWaveForNotice('building', 0, 12)).toBeNull()
    expect(getCompletedWaveForNotice('building', 1, 12)).toBe(1)
    expect(getCompletedWaveForNotice('deciding', 1, 12)).toBe(1)
    expect(getCompletedWaveForNotice('ready', 1, 12)).toBe(1)
    expect(getCompletedWaveForNotice('playing', 1, 12)).toBeNull()
    expect(getCompletedWaveForNotice('paused', 1, 12)).toBeNull()
    expect(getCompletedWaveForNotice('game_over', 1, 12)).toBeNull()
    expect(getCompletedWaveForNotice('victory', 12, 12)).toBeNull()
  })

  it('applies each escaped enemy mine damage and enters game over at zero', () => {
    expect(getStateAfterMineDamage(15, 5, 'playing')).toEqual({
      mineHealth: 10,
      gameStatus: 'playing'
    })
    expect(getStateAfterMineDamage(4, 5, 'playing')).toEqual({
      mineHealth: 0,
      gameStatus: 'game_over'
    })
  })

  it('does not allow invalid negative mine damage to heal the mine', () => {
    expect(getStateAfterMineDamage(10, -2, 'playing')).toEqual({
      mineHealth: 10,
      gameStatus: 'playing'
    })
  })
})
