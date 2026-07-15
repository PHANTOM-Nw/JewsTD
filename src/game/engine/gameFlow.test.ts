import { describe, expect, it } from 'vitest'
import { ECONOMY_CONFIG } from '../config/economy'
import { WAVES } from '../config/waves'
import {
  canFinalizeTowerBatch,
  canInspectSynthesisFromTower,
  canSynthesizeTowers,
  canStartConfiguredWave,
  getCompletedWaveForNotice,
  getStateAfterMineDamage,
  getStateAfterMineDamageBatch,
  getStatusAfterPlacement,
  getStatusAfterWave
} from './gameFlow'

describe('build and wave flow', () => {
  it('enters the decision phase only after the full tower batch is placed', () => {
    expect(getStatusAfterPlacement(
      ECONOMY_CONFIG.towersPerRound - 1,
      ECONOMY_CONFIG.towersPerRound
    )).toEqual({
      gameStatus: 'building',
      canPlaceTowers: true
    })
    expect(getStatusAfterPlacement(
      ECONOMY_CONFIG.towersPerRound,
      ECONOMY_CONFIG.towersPerRound
    )).toEqual({
      gameStatus: 'deciding',
      canPlaceTowers: false
    })
  })

  it('requires exactly one valid keep choice from a complete batch', () => {
    const batch = Array.from(
      { length: ECONOMY_CONFIG.towersPerRound },
      (_, index) => `tower-${index}`
    )

    expect(canFinalizeTowerBatch(batch, batch[1], ECONOMY_CONFIG.towersPerRound)).toBe(true)
    expect(canFinalizeTowerBatch(batch.slice(0, -1), batch[1], ECONOMY_CONFIG.towersPerRound)).toBe(false)
    expect(canFinalizeTowerBatch(batch, 'missing', ECONOMY_CONFIG.towersPerRound)).toBe(false)
  })

  it('starts a wave only from the ready phase with a valid path', () => {
    expect(canStartConfiguredWave('ready', 0, WAVES.length, true)).toBe(true)
    expect(canStartConfiguredWave('building', 0, WAVES.length, true)).toBe(false)
    expect(canStartConfiguredWave('deciding', 0, WAVES.length, true)).toBe(false)
    expect(canStartConfiguredWave('ready', 0, WAVES.length, false)).toBe(false)
    expect(canStartConfiguredWave('ready', WAVES.length, WAVES.length, true)).toBe(false)
  })

  it('allows existing towers to open the synthesis list during preparation and combat', () => {
    expect(canInspectSynthesisFromTower('building')).toBe(true)
    expect(canInspectSynthesisFromTower('ready')).toBe(true)
    expect(canInspectSynthesisFromTower('playing')).toBe(true)
    expect(canInspectSynthesisFromTower('paused')).toBe(true)
    expect(canInspectSynthesisFromTower('deciding')).toBe(false)
    expect(canInspectSynthesisFromTower('resolving_hand')).toBe(false)
    expect(canInspectSynthesisFromTower('game_over')).toBe(false)
    expect(canInspectSynthesisFromTower('victory')).toBe(false)
  })

  it('keeps synthesis actions locked while a wave is active', () => {
    expect(canSynthesizeTowers('building')).toBe(true)
    expect(canSynthesizeTowers('ready')).toBe(true)
    expect(canSynthesizeTowers('resolving_hand')).toBe(false)
    expect(canSynthesizeTowers('playing')).toBe(false)
    expect(canSynthesizeTowers('paused')).toBe(false)
  })

  it('moves directly to victory after the final configured wave', () => {
    expect(getStatusAfterWave(WAVES.length - 1, WAVES.length)).toBe('building')
    expect(getStatusAfterWave(WAVES.length, WAVES.length)).toBe('victory')
  })

  it('shows a completed-wave notice until the next wave starts', () => {
    expect(getCompletedWaveForNotice('building', 0, 12)).toBeNull()
    expect(getCompletedWaveForNotice('building', 1, 12)).toBe(1)
    expect(getCompletedWaveForNotice('deciding', 1, 12)).toBe(1)
    expect(getCompletedWaveForNotice('resolving_hand', 1, 12)).toBe(1)
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

  it('settles a same-frame escape batch once and treats an empty batch as a no-op', () => {
    const settled = getStateAfterMineDamageBatch(15, [1, 5, 1], 'playing')

    expect(settled).toEqual({ mineHealth: 8, gameStatus: 'playing' })
    expect(getStateAfterMineDamageBatch(
      settled.mineHealth,
      [],
      settled.gameStatus
    )).toEqual(settled)
  })
})
