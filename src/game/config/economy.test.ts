import { describe, expect, it } from 'vitest'
import { ECONOMY_CONFIG } from './economy'
import { MAP_CONFIG } from './map'

describe('economy configuration', () => {
  it('provides valid starting resources', () => {
    expect(ECONOMY_CONFIG.startingWood).toBe(3)
    expect(ECONOMY_CONFIG.startingGold).toBe(50)
    expect(ECONOMY_CONFIG.startingMineHealth).toBe(15)
  })

  it('provides exactly three one-cost tower placements each round', () => {
    expect(ECONOMY_CONFIG.woodPerRound).toBe(3)
    expect(ECONOMY_CONFIG.towersPerRound).toBe(3)
    expect(ECONOMY_CONFIG.towerWoodCost).toBe(1)
    expect(
      ECONOMY_CONFIG.woodPerRound / ECONOMY_CONFIG.towerWoodCost
    ).toBe(ECONOMY_CONFIG.towersPerRound)
  })

  it('caps accumulated obstacles for the mobile board', () => {
    expect(ECONOMY_CONFIG.obstacleRemovalGoldCost).toBe(20)
    expect(ECONOMY_CONFIG.maxObstacles).toBe(24)
    expect(ECONOMY_CONFIG.maxObstacles).toBeLessThan(
      MAP_CONFIG.rows * MAP_CONFIG.cols
    )
  })

  it('prices tile walls above pure walls because clearing returns the tile', () => {
    expect(ECONOMY_CONFIG.mahjongTileWallRemovalGoldCost).toBe(100)
    expect(ECONOMY_CONFIG.mahjongPureWallRemovalGoldCost).toBe(50)
    expect(ECONOMY_CONFIG.mahjongTileWallRemovalGoldCost).toBeGreaterThan(
      ECONOMY_CONFIG.mahjongPureWallRemovalGoldCost
    )
  })
})
