import { describe, expect, it } from 'vitest'
import type {
  MahjongAttachment,
  MahjongFormation,
  MahjongNumberTile,
  MahjongRank,
  MahjongSuit,
  MahjongTowerState
} from '../types/game'
import {
  planMahjongSynthesis,
  type MahjongSynthesisMaterial,
  type MahjongSynthesisTower,
  type MahjongSynthesisWall
} from './mahjongSynthesis'

const FORMATION_RANK_COUNT: Record<MahjongFormation, number> = {
  single: 1,
  pair: 2,
  chow: 3,
  pung: 3,
  kong: 4
}

function createTile(
  id: string,
  suit: MahjongSuit,
  rank: MahjongRank,
  copy: MahjongNumberTile['copy'] = 1
): MahjongNumberTile {
  return { id, suit, rank, copy }
}

function createTower(
  id: string,
  suit: MahjongSuit,
  rank: MahjongRank,
  col: number,
  options: {
    formation?: MahjongFormation
    ranks?: MahjongRank[]
    activeSourceCount?: number
    attachments?: MahjongAttachment[]
    whiteSlotIndices?: readonly number[]
  } = {}
): MahjongSynthesisTower {
  const formation = options.formation ?? 'single'
  const ranks = options.ranks ?? Array.from(
    { length: FORMATION_RANK_COUNT[formation] },
    () => rank
  )
  const whiteCount = options.whiteSlotIndices?.length ?? 0
  const containedCount = ranks.length - whiteCount
  const containedTileIds = Array.from(
    { length: containedCount },
    (_, index) => `${id}-tile-${index}`
  )
  const activeSourceCount = options.activeSourceCount ?? containedCount
  const state: MahjongTowerState = {
    formation,
    suit,
    ranks,
    containedTileIds,
    activeSources: containedTileIds.slice(0, activeSourceCount).map((tileId, index) => ({
      tileId,
      originalStats: {
        damage: 10 + index,
        attackIntervalMs: 1000 - index * 10,
        attackRange: 120 + index
      }
    })),
    attachments: [...(options.attachments ?? [])],
    ...(options.whiteSlotIndices ? { whiteSlotIndices: options.whiteSlotIndices } : {})
  }

  return {
    id,
    gridPosition: { row: 1, col },
    mahjongTile: createTile(containedTileIds[0], suit, rank),
    mahjongState: state
  }
}

function createWall(
  id: string,
  suit: MahjongSuit,
  rank: MahjongRank,
  col: number
): MahjongSynthesisWall {
  return {
    row: 2,
    col,
    type: 'obstacle',
    mahjongWallKind: 'tile',
    mahjongTile: createTile(id, suit, rank)
  }
}

const towerMaterial = (tower: MahjongSynthesisTower): MahjongSynthesisMaterial => ({
  kind: 'tower',
  tower
})
const wallMaterial = (wall: MahjongSynthesisWall): MahjongSynthesisMaterial => ({
  kind: 'wall',
  wall
})

describe('mahjong pair synthesis', () => {
  it('combines two active matching singles and keeps the anchor position', () => {
    const anchor = createTower('anchor', 'characters', 5, 1)
    const material = createTower('material', 'characters', 5, 2)

    const result = planMahjongSynthesis({
      gameStatus: 'building',
      anchor,
      materials: [towerMaterial(material)],
      recipe: { formation: 'pair' }
    })

    expect(result).toEqual({
      ok: true,
      plan: {
        anchorTowerId: 'anchor',
        anchorPosition: { row: 1, col: 1 },
        resultState: {
          formation: 'pair',
          suit: 'characters',
          ranks: [5, 5],
          containedTileIds: ['anchor-tile-0', 'material-tile-0'],
          activeSources: [
            {
              tileId: 'anchor-tile-0',
              originalStats: { damage: 10, attackIntervalMs: 1000, attackRange: 120 }
            },
            {
              tileId: 'material-tile-0',
              originalStats: { damage: 10, attackIntervalMs: 1000, attackRange: 120 }
            }
          ],
          attachments: []
        },
        consumedTowerIds: ['material'],
        consumedWallPositions: [],
        pureWallPositions: [{ row: 1, col: 2 }],
        consumedWhiteCount: 0
      }
    })
  })

  it('uses the anchor attachment when a pair cannot carry both red and green', () => {
    const result = planMahjongSynthesis({
      gameStatus: 'ready',
      anchor: createTower('anchor', 'dots', 3, 1, { attachments: ['green'] }),
      materials: [towerMaterial(
        createTower('material', 'dots', 3, 2, { attachments: ['red'] })
      )],
      recipe: { formation: 'pair' }
    })

    expect(result.ok && result.plan.resultState.attachments).toEqual(['green'])
  })
})

describe('mahjong chow synthesis', () => {
  it('accepts three active consecutive singles', () => {
    const result = planMahjongSynthesis({
      gameStatus: 'building',
      anchor: createTower('three', 'bamboo', 3, 1),
      materials: [
        towerMaterial(createTower('four', 'bamboo', 4, 2)),
        towerMaterial(createTower('five', 'bamboo', 5, 3))
      ],
      recipe: { formation: 'chow', ranks: [3, 4, 5] }
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.resultState).toMatchObject({
      formation: 'chow',
      suit: 'bamboo',
      ranks: [3, 4, 5],
      containedTileIds: ['three-tile-0', 'four-tile-0', 'five-tile-0']
    })
    expect(result.plan.pureWallPositions).toEqual([
      { row: 1, col: 2 },
      { row: 1, col: 3 }
    ])
  })

  it('allows one exact wall as a passive chow material without inheriting stats', () => {
    const result = planMahjongSynthesis({
      gameStatus: 'ready',
      anchor: createTower('three', 'characters', 3, 1),
      materials: [
        towerMaterial(createTower('four', 'characters', 4, 2)),
        wallMaterial(createWall('wall-five', 'characters', 5, 4))
      ],
      recipe: { formation: 'chow', ranks: [3, 4, 5] }
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.resultState.containedTileIds).toEqual([
      'three-tile-0',
      'four-tile-0',
      'wall-five'
    ])
    expect(result.plan.resultState.activeSources.map(source => source.tileId)).toEqual([
      'three-tile-0',
      'four-tile-0'
    ])
    expect(result.plan.consumedWallPositions).toEqual([{ row: 2, col: 4 }])
    expect(result.plan.pureWallPositions).toEqual([
      { row: 1, col: 2 },
      { row: 2, col: 4 }
    ])
  })

  it('allows a white and one wall in the same chow', () => {
    const result = planMahjongSynthesis({
      gameStatus: 'building',
      anchor: createTower('three', 'dots', 3, 1),
      materials: [wallMaterial(createWall('wall-five', 'dots', 5, 4))],
      recipe: { formation: 'chow', ranks: [3, 4, 5] },
      whiteCount: 1,
      availableWhiteCount: 1
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.resultState).toMatchObject({
      ranks: [3, 4, 5],
      containedTileIds: ['three-tile-0', 'wall-five'],
      whiteSlotIndices: [1]
    })
    expect(result.plan.resultState.activeSources).toHaveLength(1)
    expect(result.plan.consumedWhiteCount).toBe(1)
  })

  it('fills every uncovered chow gap with white at the missing rank slots', () => {
    const result = planMahjongSynthesis({
      gameStatus: 'building',
      anchor: createTower('three', 'bamboo', 3, 1),
      materials: [],
      recipe: { formation: 'chow', ranks: [3, 4, 5] },
      whiteCount: 2,
      availableWhiteCount: 2
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.resultState).toMatchObject({
      ranks: [3, 4, 5],
      containedTileIds: ['three-tile-0'],
      whiteSlotIndices: [1, 2]
    })
    expect(result.plan.consumedWhiteCount).toBe(2)
  })
})

describe('mahjong pung synthesis', () => {
  it.each([
    {
      name: 'three active singles',
      anchor: createTower('a', 'characters', 7, 1),
      materials: [
        towerMaterial(createTower('b', 'characters', 7, 2)),
        towerMaterial(createTower('c', 'characters', 7, 3))
      ],
      whiteCount: 0,
      availableWhiteCount: 0
    },
    {
      name: 'two active singles and a wall',
      anchor: createTower('a', 'characters', 7, 1),
      materials: [
        towerMaterial(createTower('b', 'characters', 7, 2)),
        wallMaterial(createWall('wall', 'characters', 7, 4))
      ],
      whiteCount: 0,
      availableWhiteCount: 0
    },
    {
      name: 'one active single, a wall and a white',
      anchor: createTower('a', 'characters', 7, 1),
      materials: [wallMaterial(createWall('wall', 'characters', 7, 4))],
      whiteCount: 1,
      availableWhiteCount: 1
    },
    {
      name: 'a pair and an active single',
      anchor: createTower('pair', 'characters', 7, 1, { formation: 'pair' }),
      materials: [towerMaterial(createTower('single', 'characters', 7, 2))],
      whiteCount: 0,
      availableWhiteCount: 0
    },
    {
      name: 'a pair and a wall',
      anchor: createTower('pair', 'characters', 7, 1, { formation: 'pair' }),
      materials: [wallMaterial(createWall('wall', 'characters', 7, 4))],
      whiteCount: 0,
      availableWhiteCount: 0
    },
    {
      name: 'a pair and a white',
      anchor: createTower('pair', 'characters', 7, 1, { formation: 'pair' }),
      materials: [],
      whiteCount: 1,
      availableWhiteCount: 1
    }
  ])('accepts $name', ({ anchor, materials, whiteCount, availableWhiteCount }) => {
    const result = planMahjongSynthesis({
      gameStatus: 'building',
      anchor,
      materials,
      recipe: { formation: 'pung' },
      whiteCount,
      availableWhiteCount
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.resultState.formation).toBe('pung')
    expect(result.plan.resultState.ranks).toEqual([7, 7, 7])
    expect(result.plan.resultState.whiteSlotIndices).toEqual(whiteCount ? [2] : undefined)
  })

  it('fills two pung slots with white at the deterministic tail', () => {
    const result = planMahjongSynthesis({
      gameStatus: 'building',
      anchor: createTower('a', 'characters', 7, 1),
      materials: [],
      recipe: { formation: 'pung' },
      whiteCount: 2,
      availableWhiteCount: 2
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.resultState).toMatchObject({
      ranks: [7, 7, 7],
      containedTileIds: ['a-tile-0'],
      whiteSlotIndices: [1, 2]
    })
    expect(result.plan.consumedWhiteCount).toBe(2)
  })

  it('preserves both attachment kinds and only active source stats', () => {
    const result = planMahjongSynthesis({
      gameStatus: 'ready',
      anchor: createTower('pair', 'bamboo', 2, 1, {
        formation: 'pair',
        attachments: ['red']
      }),
      materials: [towerMaterial(
        createTower('single', 'bamboo', 2, 2, { attachments: ['green'] })
      )],
      recipe: { formation: 'pung' }
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.resultState.attachments).toEqual(['red', 'green'])
    expect(result.plan.resultState.activeSources.map(source => source.tileId)).toEqual([
      'pair-tile-0',
      'pair-tile-1',
      'single-tile-0'
    ])
  })
})

describe('mahjong kong synthesis', () => {
  it.each([
    {
      name: 'four active singles',
      anchor: createTower('a', 'dots', 9, 1),
      materials: [
        towerMaterial(createTower('b', 'dots', 9, 2)),
        towerMaterial(createTower('c', 'dots', 9, 3)),
        towerMaterial(createTower('d', 'dots', 9, 4))
      ]
    },
    {
      name: 'one pair and two active singles',
      anchor: createTower('pair', 'dots', 9, 1, { formation: 'pair' }),
      materials: [
        towerMaterial(createTower('c', 'dots', 9, 3)),
        towerMaterial(createTower('d', 'dots', 9, 4))
      ]
    },
    {
      name: 'two matching pairs',
      anchor: createTower('pair-a', 'dots', 9, 1, { formation: 'pair' }),
      materials: [towerMaterial(
        createTower('pair-b', 'dots', 9, 3, { formation: 'pair' })
      )]
    },
    {
      name: 'a pung and one active single',
      anchor: createTower('pung', 'dots', 9, 1, { formation: 'pung' }),
      materials: [towerMaterial(createTower('single', 'dots', 9, 4))]
    }
  ])('accepts $name', ({ anchor, materials }) => {
    const result = planMahjongSynthesis({
      gameStatus: 'ready',
      anchor,
      materials,
      recipe: { formation: 'kong' }
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.resultState.formation).toBe('kong')
    expect(result.plan.resultState.ranks).toEqual([9, 9, 9, 9])
  })

  it('allows a white-backed pung to add a real active fourth tile', () => {
    const result = planMahjongSynthesis({
      gameStatus: 'ready',
      anchor: createTower('pung', 'bamboo', 6, 1, {
        formation: 'pung',
        whiteSlotIndices: [2]
      }),
      materials: [towerMaterial(createTower('single', 'bamboo', 6, 4))],
      recipe: { formation: 'kong' }
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.resultState).toMatchObject({
      containedTileIds: ['pung-tile-0', 'pung-tile-1', 'single-tile-0'],
      whiteSlotIndices: [3]
    })
  })

  it('accumulates white when a white-backed pung is topped up with another white', () => {
    const result = planMahjongSynthesis({
      gameStatus: 'ready',
      anchor: createTower('pung', 'bamboo', 6, 1, {
        formation: 'pung',
        whiteSlotIndices: [2]
      }),
      materials: [],
      recipe: { formation: 'kong' },
      whiteCount: 1,
      availableWhiteCount: 1
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.resultState).toMatchObject({
      formation: 'kong',
      containedTileIds: ['pung-tile-0', 'pung-tile-1'],
      whiteSlotIndices: [2, 3]
    })
    expect(result.plan.consumedWhiteCount).toBe(1)
  })

  it.each([
    {
      name: 'a pair and two whites',
      anchor: createTower('pair', 'dots', 9, 1, { formation: 'pair' }),
      materials: [] as MahjongSynthesisMaterial[],
      whiteCount: 2,
      containedTileIds: ['pair-tile-0', 'pair-tile-1'],
      whiteSlotIndices: [2, 3]
    },
    {
      name: 'a pung and one white',
      anchor: createTower('pung', 'dots', 9, 1, { formation: 'pung' }),
      materials: [] as MahjongSynthesisMaterial[],
      whiteCount: 1,
      containedTileIds: ['pung-tile-0', 'pung-tile-1', 'pung-tile-2'],
      whiteSlotIndices: [3]
    },
    {
      name: 'a single anchor and three whites',
      anchor: createTower('single', 'dots', 9, 1),
      materials: [] as MahjongSynthesisMaterial[],
      whiteCount: 3,
      containedTileIds: ['single-tile-0'],
      whiteSlotIndices: [1, 2, 3]
    },
    {
      name: 'a pair, an active single and one white',
      anchor: createTower('pair', 'dots', 9, 1, { formation: 'pair' }),
      materials: [towerMaterial(createTower('single', 'dots', 9, 2))],
      whiteCount: 1,
      containedTileIds: ['pair-tile-0', 'pair-tile-1', 'single-tile-0'],
      whiteSlotIndices: [3]
    }
  ])('grows a kong from $name', ({
    anchor,
    materials,
    whiteCount,
    containedTileIds,
    whiteSlotIndices
  }) => {
    const result = planMahjongSynthesis({
      gameStatus: 'ready',
      anchor,
      materials,
      recipe: { formation: 'kong' },
      whiteCount,
      availableWhiteCount: whiteCount
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.resultState).toMatchObject({
      formation: 'kong',
      ranks: [9, 9, 9, 9],
      containedTileIds,
      whiteSlotIndices
    })
    expect(result.plan.consumedWhiteCount).toBe(whiteCount)
  })
})

describe('mahjong synthesis rejection and atomicity', () => {
  it.each(['deciding', 'resolving_hand', 'playing', 'paused', 'game_over', 'victory'] as const)(
    'rejects synthesis during %s',
    gameStatus => {
      const result = planMahjongSynthesis({
        gameStatus,
        anchor: createTower('a', 'characters', 1, 1),
        materials: [towerMaterial(createTower('b', 'characters', 1, 2))],
        recipe: { formation: 'pair' }
      })

      expect(result).toEqual({ ok: false, reason: 'invalid_phase' })
    }
  )

  it('rejects a chow or kong as a terminal material', () => {
    const chow = createTower('chow', 'characters', 2, 1, {
      formation: 'chow',
      ranks: [2, 3, 4]
    })
    const kong = createTower('kong', 'characters', 2, 2, { formation: 'kong' })

    expect(planMahjongSynthesis({
      gameStatus: 'ready',
      anchor: chow,
      materials: [towerMaterial(createTower('single', 'characters', 2, 3))],
      recipe: { formation: 'pung' }
    })).toEqual({ ok: false, reason: 'terminal_formation' })
    expect(planMahjongSynthesis({
      gameStatus: 'ready',
      anchor: createTower('single', 'characters', 2, 1),
      materials: [towerMaterial(kong)],
      recipe: { formation: 'kong' }
    })).toEqual({ ok: false, reason: 'terminal_formation' })
  })

  it('rejects two walls and a pure wall', () => {
    const anchor = createTower('a', 'characters', 1, 1)
    expect(planMahjongSynthesis({
      gameStatus: 'building',
      anchor,
      materials: [
        wallMaterial(createWall('wall-a', 'characters', 2, 3)),
        wallMaterial(createWall('wall-b', 'characters', 3, 4))
      ],
      recipe: { formation: 'chow', ranks: [1, 2, 3] }
    })).toEqual({ ok: false, reason: 'too_many_walls' })

    expect(planMahjongSynthesis({
      gameStatus: 'building',
      anchor,
      materials: [wallMaterial({
        row: 2,
        col: 3,
        type: 'obstacle',
        mahjongWallKind: 'pure'
      })],
      recipe: { formation: 'pung' },
      whiteCount: 1,
      availableWhiteCount: 1
    })).toEqual({ ok: false, reason: 'invalid_wall' })
  })

  it('rejects a wall for a pair and rejects white for a pair', () => {
    const anchor = createTower('a', 'dots', 4, 1)

    expect(planMahjongSynthesis({
      gameStatus: 'ready',
      anchor,
      materials: [wallMaterial(createWall('wall', 'dots', 4, 4))],
      recipe: { formation: 'pair' }
    })).toEqual({ ok: false, reason: 'wall_not_allowed' })
    expect(planMahjongSynthesis({
      gameStatus: 'ready',
      anchor,
      materials: [towerMaterial(createTower('b', 'dots', 4, 2))],
      recipe: { formation: 'pair' },
      whiteCount: 1,
      availableWhiteCount: 1
    })).toEqual({ ok: false, reason: 'white_not_allowed' })
  })

  it('rejects a wall for a kong but accepts white to complete it', () => {
    const anchor = createTower('a', 'dots', 4, 1)

    expect(planMahjongSynthesis({
      gameStatus: 'ready',
      anchor,
      materials: [
        towerMaterial(createTower('b', 'dots', 4, 2)),
        towerMaterial(createTower('c', 'dots', 4, 3)),
        wallMaterial(createWall('wall', 'dots', 4, 4))
      ],
      recipe: { formation: 'kong' }
    })).toEqual({ ok: false, reason: 'wall_not_allowed' })

    const accepted = planMahjongSynthesis({
      gameStatus: 'ready',
      anchor,
      materials: [
        towerMaterial(createTower('b', 'dots', 4, 2)),
        towerMaterial(createTower('c', 'dots', 4, 3))
      ],
      recipe: { formation: 'kong' },
      whiteCount: 1,
      availableWhiteCount: 1
    })
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    expect(accepted.plan.resultState.whiteSlotIndices).toEqual([3])
  })

  it('rejects too many or unavailable white tiles', () => {
    const baseRequest = {
      gameStatus: 'building' as const,
      anchor: createTower('a', 'characters', 1, 1),
      materials: [towerMaterial(createTower('b', 'characters', 2, 2))],
      recipe: { formation: 'chow' as const, ranks: [1, 2, 3] as const }
    }
    // A full-white chow (all three logical tiles) can never keep a real anchor.
    expect(planMahjongSynthesis({
      ...baseRequest,
      whiteCount: 3,
      availableWhiteCount: 3
    })).toEqual({ ok: false, reason: 'too_many_white' })
    expect(planMahjongSynthesis({
      gameStatus: 'ready',
      anchor: createTower('a', 'dots', 4, 1),
      materials: [],
      recipe: { formation: 'kong' },
      whiteCount: 4,
      availableWhiteCount: 4
    })).toEqual({ ok: false, reason: 'too_many_white' })
    expect(planMahjongSynthesis({
      ...baseRequest,
      whiteCount: 1,
      availableWhiteCount: 0
    })).toEqual({ ok: false, reason: 'white_unavailable' })
    expect(planMahjongSynthesis({
      ...baseRequest,
      whiteCount: 1,
      availableWhiteCount: Number.NaN
    })).toEqual({ ok: false, reason: 'white_unavailable' })
  })

  it('rejects white slot indices that are out of range, duplicated or on a non-composite tower', () => {
    const single = () => towerMaterial(createTower('single', 'dots', 5, 2))

    const outOfRange = createTower('out', 'dots', 5, 1, {
      formation: 'pung',
      whiteSlotIndices: [3]
    })
    expect(planMahjongSynthesis({
      gameStatus: 'ready',
      anchor: outOfRange,
      materials: [single()],
      recipe: { formation: 'kong' }
    })).toEqual({ ok: false, reason: 'invalid_anchor' })

    const duplicated = createTower('dup', 'dots', 5, 1, {
      formation: 'pung',
      whiteSlotIndices: [2, 2]
    })
    expect(planMahjongSynthesis({
      gameStatus: 'ready',
      anchor: duplicated,
      materials: [single()],
      recipe: { formation: 'kong' }
    })).toEqual({ ok: false, reason: 'invalid_anchor' })

    const wrongFormation = createTower('pair', 'dots', 5, 1, {
      formation: 'pair',
      whiteSlotIndices: [1]
    })
    expect(planMahjongSynthesis({
      gameStatus: 'ready',
      anchor: wrongFormation,
      materials: [single()],
      recipe: { formation: 'pung' }
    })).toEqual({ ok: false, reason: 'invalid_anchor' })
  })

  it('rejects missing Mahjong identity and unusable active source stats', () => {
    const missingTile = createTower('missing', 'characters', 1, 1)
    missingTile.mahjongTile = undefined
    expect(planMahjongSynthesis({
      gameStatus: 'building',
      anchor: missingTile,
      materials: [towerMaterial(createTower('other', 'characters', 1, 2))],
      recipe: { formation: 'pair' }
    })).toEqual({ ok: false, reason: 'invalid_anchor' })

    const invalidStats = createTower('invalid', 'characters', 1, 2)
    invalidStats.mahjongState!.activeSources[0].originalStats.attackIntervalMs = 0
    expect(planMahjongSynthesis({
      gameStatus: 'building',
      anchor: createTower('anchor', 'characters', 1, 1),
      materials: [towerMaterial(invalidStats)],
      recipe: { formation: 'pair' }
    })).toEqual({ ok: false, reason: 'invalid_entity_state' })
  })

  it('rejects impossible active-source counts and white-backed pair states', () => {
    const oneSourcePair = createTower('pair', 'characters', 4, 1, {
      formation: 'pair',
      activeSourceCount: 1
    })
    expect(planMahjongSynthesis({
      gameStatus: 'ready',
      anchor: oneSourcePair,
      materials: [towerMaterial(createTower('single', 'characters', 4, 2))],
      recipe: { formation: 'pung' }
    })).toEqual({ ok: false, reason: 'invalid_anchor' })

    const whitePair = createTower('white-pair', 'dots', 6, 1, {
      formation: 'pair',
      whiteSlotIndices: [1]
    })
    expect(planMahjongSynthesis({
      gameStatus: 'ready',
      anchor: whitePair,
      materials: [towerMaterial(createTower('single', 'dots', 6, 2))],
      recipe: { formation: 'pung' }
    })).toEqual({ ok: false, reason: 'invalid_anchor' })

    const twoPassivePung = createTower('pung', 'bamboo', 7, 1, {
      formation: 'pung',
      activeSourceCount: 1
    })
    expect(planMahjongSynthesis({
      gameStatus: 'ready',
      anchor: twoPassivePung,
      materials: [towerMaterial(createTower('single', 'bamboo', 7, 2))],
      recipe: { formation: 'kong' }
    })).toEqual({ ok: false, reason: 'invalid_anchor' })

    const twoPassiveKong = createTower('kong', 'characters', 8, 1, {
      formation: 'kong',
      activeSourceCount: 2
    })
    expect(planMahjongSynthesis({
      gameStatus: 'ready',
      anchor: createTower('single-anchor', 'characters', 8, 2),
      materials: [towerMaterial(twoPassiveKong)],
      recipe: { formation: 'kong' }
    })).toEqual({ ok: false, reason: 'invalid_entity_state' })
  })

  it('requires the displayed anchor entity to be an active source', () => {
    const passiveAnchor = createTower('pung', 'characters', 9, 1, {
      formation: 'pung',
      activeSourceCount: 2
    })
    passiveAnchor.mahjongTile = createTile(
      'pung-tile-2',
      'characters',
      9
    )

    expect(planMahjongSynthesis({
      gameStatus: 'ready',
      anchor: passiveAnchor,
      materials: [towerMaterial(createTower('single', 'characters', 9, 2))],
      recipe: { formation: 'kong' }
    })).toEqual({ ok: false, reason: 'invalid_anchor' })
  })

  it('rejects mismatched faces and invalid chow recipes', () => {
    expect(planMahjongSynthesis({
      gameStatus: 'building',
      anchor: createTower('a', 'characters', 5, 1),
      materials: [
        towerMaterial(createTower('b', 'dots', 5, 2)),
        towerMaterial(createTower('c', 'characters', 5, 3))
      ],
      recipe: { formation: 'pung' }
    })).toEqual({ ok: false, reason: 'invalid_face' })

    expect(planMahjongSynthesis({
      gameStatus: 'building',
      anchor: createTower('a', 'characters', 3, 1),
      materials: [
        towerMaterial(createTower('b', 'characters', 4, 2)),
        towerMaterial(createTower('c', 'characters', 5, 3))
      ],
      recipe: { formation: 'chow', ranks: [3, 5, 6] }
    })).toEqual({ ok: false, reason: 'invalid_chow' })

    expect(planMahjongSynthesis({
      gameStatus: 'building',
      anchor: createTower('a', 'characters', 3, 1),
      materials: [
        towerMaterial(createTower('b', 'characters', 3, 2)),
        towerMaterial(createTower('c', 'characters', 5, 3))
      ],
      recipe: { formation: 'chow', ranks: [3, 4, 5] }
    })).toEqual({ ok: false, reason: 'invalid_chow' })
  })

  it('rejects invalid growth routes', () => {
    expect(planMahjongSynthesis({
      gameStatus: 'ready',
      anchor: createTower('pair', 'bamboo', 3, 1, { formation: 'pair' }),
      materials: [],
      recipe: { formation: 'chow', ranks: [3, 4, 5] },
      whiteCount: 1,
      availableWhiteCount: 1
    })).toEqual({ ok: false, reason: 'invalid_route' })

    expect(planMahjongSynthesis({
      gameStatus: 'ready',
      anchor: createTower('pair', 'bamboo', 3, 1, { formation: 'pair' }),
      materials: [towerMaterial(createTower('single', 'bamboo', 3, 2))],
      recipe: { formation: 'pair' }
    })).toEqual({ ok: false, reason: 'invalid_material_count' })
  })

  it('rejects duplicate towers, positions and physical tile ownership', () => {
    const anchor = createTower('same', 'characters', 1, 1)
    expect(planMahjongSynthesis({
      gameStatus: 'building',
      anchor,
      materials: [towerMaterial({ ...createTower('same', 'characters', 1, 2) })],
      recipe: { formation: 'pair' }
    })).toEqual({ ok: false, reason: 'duplicate_material' })

    const duplicatePosition = createTower('other', 'characters', 1, 1)
    expect(planMahjongSynthesis({
      gameStatus: 'building',
      anchor,
      materials: [towerMaterial(duplicatePosition)],
      recipe: { formation: 'pair' }
    })).toEqual({ ok: false, reason: 'duplicate_material' })

    const duplicateTile = createTower('other', 'characters', 1, 2)
    duplicateTile.mahjongState = {
      ...duplicateTile.mahjongState!,
      containedTileIds: ['same-tile-0'],
      activeSources: [{
        tileId: 'same-tile-0',
        originalStats: { damage: 10, attackIntervalMs: 1000, attackRange: 120 }
      }]
    }
    duplicateTile.mahjongTile = createTile('same-tile-0', 'characters', 1)
    expect(planMahjongSynthesis({
      gameStatus: 'building',
      anchor,
      materials: [towerMaterial(duplicateTile)],
      recipe: { formation: 'pair' }
    })).toEqual({ ok: false, reason: 'duplicate_material' })
  })

  it('does not mutate any input when planning fails', () => {
    const anchor = createTower('anchor', 'characters', 1, 1, { attachments: ['red'] })
    const material = createTower('material', 'dots', 1, 2, { attachments: ['green'] })
    const request = {
      gameStatus: 'building' as const,
      anchor,
      materials: [towerMaterial(material)],
      recipe: { formation: 'pair' as const }
    }
    const before = structuredClone(request)

    expect(planMahjongSynthesis(request)).toEqual({ ok: false, reason: 'invalid_face' })
    expect(request).toEqual(before)
  })
})
