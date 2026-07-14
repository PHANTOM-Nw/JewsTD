import { describe, expect, it } from 'vitest'
import {
  ALL_SPRITE_URLS,
  BASE_TOWER_SPRITES,
  ENEMY_SPRITES,
  GATE_SPRITES,
  OBSTACLE_SPRITES,
  SPECIAL_TOWER_SPRITES,
  getObstacleSpriteUrl,
  getTowerSpriteUrl
} from './spriteRegistry'

describe('sprite registry', () => {
  it('registers every tower and enemy family used by the game', () => {
    expect(Object.keys(BASE_TOWER_SPRITES)).toHaveLength(8)
    expect(Object.keys(SPECIAL_TOWER_SPRITES)).toHaveLength(6)
    expect(Object.keys(ENEMY_SPRITES)).toEqual(['basic', 'fast', 'tank', 'boss'])
    expect(GATE_SPRITES.entrance).toMatch(/entrance/)
    expect(GATE_SPRITES.exit).toMatch(/exit/)
    expect(OBSTACLE_SPRITES.length).toBeGreaterThanOrEqual(4)
    expect(ALL_SPRITE_URLS.length).toBeGreaterThanOrEqual(25)
  })

  it('selects obstacle variations deterministically by cell', () => {
    expect(getObstacleSpriteUrl(2, 3)).toBe(getObstacleSpriteUrl(2, 3))
    const variants = new Set(
      Array.from({ length: 10 }, (_, row) => getObstacleSpriteUrl(row, row % 8))
    )
    expect(variants.size).toBeGreaterThan(1)
  })

  it('resolves base and special tower art', () => {
    expect(getTowerSpriteUrl({ gemType: 'ruby' })).toBe(BASE_TOWER_SPRITES.ruby)
    expect(getTowerSpriteUrl({ specialType: 'moonstone' })).toBe(SPECIAL_TOWER_SPRITES.moonstone)
  })
})
