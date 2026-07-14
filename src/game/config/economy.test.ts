import { describe, expect, it } from 'vitest'
import { ECONOMY_CONFIG } from './economy'

describe('economy configuration', () => {
  it('provides valid starting resources', () => {
    expect(ECONOMY_CONFIG.startingWood).toBe(5)
    expect(ECONOMY_CONFIG.startingGold).toBe(50)
    expect(ECONOMY_CONFIG.startingMineHealth).toBe(15)
  })

  it('funds exactly five one-wood tower placements each round', () => {
    expect(ECONOMY_CONFIG.woodPerRound).toBe(5)
    expect(ECONOMY_CONFIG.towersPerRound).toBe(5)
    expect(ECONOMY_CONFIG.towerWoodCost).toBe(1)
    expect(
      ECONOMY_CONFIG.woodPerRound / ECONOMY_CONFIG.towerWoodCost
    ).toBe(ECONOMY_CONFIG.towersPerRound)
  })
})
