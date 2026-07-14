import { describe, expect, it } from 'vitest'
import type { GemType, Tower } from '../types/game'
import {
  createSpecialTowerAtAnchor,
  createUpgradedTowerAtAnchor,
  findSpecialSynthesisMaterials,
  findSynthesisPairsAtTower
} from './synthesis'

function createTower(id: string, gemType: GemType, row: number, col: number): Tower {
  return {
    id,
    gemType,
    level: 'chipped',
    gridPosition: { row, col },
    position: { x: col * 40 + 20, y: row * 40 + 20 },
    damage: 10,
    range: 100,
    attackSpeed: 1000,
    lastAttackTime: 500,
    damageType: 'physical'
  }
}

describe('anchored tower synthesis', () => {
  it('keeps the clicked tower first in every regular synthesis pair', () => {
    const towers = [
      createTower('older', 'diamond', 1, 1),
      createTower('selected', 'diamond', 4, 6),
      createTower('newer', 'diamond', 7, 8)
    ]

    const pairs = findSynthesisPairsAtTower(towers, 'selected')

    expect(pairs.map(pair => pair.map(tower => tower.id))).toEqual([
      ['selected', 'older'],
      ['selected', 'newer']
    ])
  })

  it('creates a regular upgrade at the clicked tower position', () => {
    const selectedTower = createTower('selected', 'ruby', 4, 6)

    const upgradedTower = createUpgradedTowerAtAnchor(selectedTower, 'flawed')

    expect(upgradedTower).toMatchObject({
      id: 'selected',
      level: 'flawed',
      gridPosition: { row: 4, col: 6 },
      position: { x: 260, y: 180 }
    })
  })

  it('uses the clicked recipe material as the special tower anchor', () => {
    const towers = [
      createTower('diamond', 'diamond', 1, 1),
      createTower('selected-topaz', 'topaz', 5, 7)
    ]

    const materials = findSpecialSynthesisMaterials(towers, 'silver', 'selected-topaz')
    const specialTower = createSpecialTowerAtAnchor(materials![0], 'silver')

    expect(materials?.map(tower => tower.id)).toEqual(['selected-topaz', 'diamond'])
    expect(specialTower).toMatchObject({
      id: 'selected-topaz',
      specialType: 'silver',
      gridPosition: { row: 5, col: 7 },
      position: { x: 300, y: 220 }
    })
  })

  it('rejects recipes that do not use the clicked tower', () => {
    const towers = [
      createTower('selected-ruby', 'ruby', 1, 1),
      createTower('diamond', 'diamond', 2, 2),
      createTower('topaz', 'topaz', 3, 3)
    ]

    expect(findSpecialSynthesisMaterials(towers, 'silver', 'selected-ruby')).toBeNull()
  })
})
