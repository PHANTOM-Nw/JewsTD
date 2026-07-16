import { describe, expect, it } from 'vitest'
import type {
  GridCell,
  MahjongAttachment,
  MahjongFormation,
  MahjongRank,
  MahjongSuit,
  MahjongTowerState,
  Tower
} from '../types/game'
import {
  getAvailableMahjongSynthesisOptions,
  getMahjongAbilitySummary,
  getMahjongPairRouteHint,
  getMahjongStateFinalStats,
  getMahjongTowerActionLabel,
  getMahjongTowerComparisonLabel
} from './mahjongUiModel'

function createSynthesisTower(
  id: string,
  rank: MahjongRank,
  col: number,
  formation: MahjongFormation = 'single'
): Tower {
  const logicalTileCount = formation === 'single'
    ? 1
    : formation === 'pair'
      ? 2
      : formation === 'kong'
        ? 4
        : 3
  const ranks = formation === 'chow'
    ? [rank, (rank + 1) as MahjongRank, (rank + 2) as MahjongRank]
    : Array.from({ length: logicalTileCount }, () => rank)
  const tileIds = Array.from(
    { length: logicalTileCount },
    (_, index) => `${id}-tile-${index}`
  )
  const state: MahjongTowerState = {
    formation,
    suit: 'characters',
    ranks,
    containedTileIds: tileIds,
    activeSources: tileIds.map(tileId => ({
      tileId,
      originalStats: {
        damage: 30,
        attackIntervalMs: 1000,
        attackRange: 120
      }
    })),
    attachments: []
  }

  return {
    id,
    mahjongTile: {
      id: tileIds[0],
      suit: 'characters',
      rank,
      copy: 1
    },
    mahjongState: state,
    level: 'chipped',
    gridPosition: { row: 1, col },
    position: { x: col * 40 + 20, y: 60 },
    damage: 30,
    range: 120,
    attackSpeed: 1000,
    lastAttackTime: 0,
    damageType: 'physical'
  }
}

function createSynthesisWall(
  rank: MahjongRank,
  col: number
): GridCell {
  return {
    row: 2,
    col,
    type: 'obstacle',
    mahjongWallKind: 'tile',
    mahjongTile: {
      id: `wall-${rank}-${col}`,
      suit: 'characters',
      rank,
      copy: 2
    }
  }
}

function createState(
  suit: MahjongSuit,
  formation: MahjongFormation,
  attachments: MahjongAttachment[] = []
): MahjongTowerState {
  const sourceCount = formation === 'single'
    ? 1
    : formation === 'pair'
      ? 2
      : formation === 'kong'
        ? 4
        : 3
  const rank = formation === 'chow' ? [3, 4, 5] : Array(sourceCount).fill(3)
  return {
    formation,
    suit,
    ranks: rank as MahjongTowerState['ranks'],
    containedTileIds: Array.from({ length: sourceCount }, (_, index) => `tile-${index}`),
    activeSources: Array.from({ length: sourceCount }, (_, index) => ({
      tileId: `tile-${index}`,
      originalStats: {
        damage: suit === 'bamboo' ? 15 : suit === 'dots' ? 24 : 30,
        attackIntervalMs: suit === 'bamboo' ? 500 : 1000,
        attackRange: 120
      }
    })),
    attachments
  }
}

function createTower(state: MahjongTowerState): Tower {
  return {
    id: 'tower',
    mahjongTile: {
      id: state.containedTileIds[0],
      suit: state.suit,
      rank: state.ranks[0],
      copy: 1
    },
    mahjongState: state,
    level: 'chipped',
    gridPosition: { row: 1, col: 1 },
    position: { x: 60, y: 60 },
    damage: 1,
    range: 1,
    attackSpeed: 1,
    lastAttackTime: 0,
    damageType: state.suit === 'dots' ? 'magic' : 'physical'
  }
}

describe('mahjong final UI presentation', () => {
  it('recomputes a pair from all sources and exposes its actual crit, armor and waits', () => {
    const state = createState('characters', 'pair')

    expect(getMahjongStateFinalStats(state)).toEqual({
      damage: 46.5,
      attackIntervalMs: 1000,
      attackRange: 126
    })
    expect(getMahjongAbilitySummary(state)).toEqual([
      '物理伤害',
      '暴击15%，暴伤×2',
      '忽略护甲25%'
    ])
    expect(getMahjongPairRouteHint(state)).toBe(
      '听碰：缺1张三萬（主动单牌、同牌牌墙或白）；听杠：缺2张主动三萬，或1组相同对子。'
    )

    const tower = createTower(state)
    const comparison = getMahjongTowerComparisonLabel(tower)
    expect(comparison).toContain('对子；伤害46.5；攻击间隔1000毫秒；攻击距离126')
    expect(comparison).toContain('暴击15%，暴伤×2；忽略护甲25%')
    expect(comparison).not.toContain('伤害1')

    const actionLabel = getMahjongTowerActionLabel(tower, 'red')
    expect(actionLabel).toContain('将中附着到三萬；对子；伤害46.5')
    expect(actionLabel).toContain('听碰：缺1张三萬')
    expect(actionLabel).not.toContain('tile-0')
  })

  it('summarizes a bamboo kong with its poison plus simultaneous 中 and 發', () => {
    const state = createState('bamboo', 'kong', ['red', 'green'])
    const summary = getMahjongAbilitySummary(state)

    expect(summary).toContain('物理伤害')
    expect(summary).toContain('暴击10%，暴伤×2')
    expect(summary).toContain('毒伤12/秒，持续5秒，同来源最多4层')
    expect(summary).toContain('中：总伤害×1.25，暴击率已增加10%，灼烧6/秒持续3秒（不叠层）')
    expect(summary).toContain('發：同目标每次命中攻击频率+3%，最多10层，2秒未命中或换目标重置')
  })

  it('summarizes chow damage distribution and dot control with both attachments', () => {
    const state = createState('dots', 'chow', ['red', 'green'])
    const summary = getMahjongAbilitySummary(state)

    expect(summary).toContain('魔法伤害')
    expect(summary).toContain('顺子3发，最多3个目标，总伤害按实际目标数均分')
    expect(summary).toContain('减速25%，持续1.5秒')
    expect(summary).toContain('暴击10%，暴伤×2')
    expect(summary).toContain('中：总伤害×1.25，暴击率已增加10%，灼烧6/秒持续3秒（不叠层）')
    expect(summary).toContain('發：12%眩晕，普通敌人0.8秒、Boss 0.35秒')
    expect(getMahjongPairRouteHint(state)).toBeNull()
  })

  it('includes the final dot splash ratio and slow for a kong', () => {
    const summary = getMahjongAbilitySummary(createState('dots', 'kong'))

    expect(summary).toContain('魔法伤害')
    expect(summary).toContain('溅射55像素，周围敌人承受100%伤害')
    expect(summary).toContain('减速55%，持续2.5秒')
  })
})

describe('available Mahjong synthesis options', () => {
  const getFormations = (options: ReturnType<typeof getAvailableMahjongSynthesisOptions>) => (
    new Set(options.map(option => option.recipe.formation))
  )

  it('publishes pair only when a matching active single can complete it', () => {
    const anchor = createSynthesisTower('anchor', 3, 1)
    const mate = createSynthesisTower('mate', 3, 2)
    const available = getAvailableMahjongSynthesisOptions({
      gameStatus: 'ready',
      anchorTower: anchor,
      fieldTowers: [anchor, mate],
      walls: [],
      availableWhiteCount: 0
    })
    const unavailable = getAvailableMahjongSynthesisOptions({
      gameStatus: 'ready',
      anchorTower: anchor,
      fieldTowers: [anchor],
      walls: [createSynthesisWall(3, 3)],
      availableWhiteCount: 1
    })

    expect(getFormations(available)).toContain('pair')
    expect(available).toContainEqual({
      recipe: { formation: 'pair' },
      materialTowerIds: ['mate'],
      wallPosition: null,
      useWhite: false
    })
    expect(getFormations(unavailable)).not.toContain('pair')
  })

  it('keeps a chow that can be completed by one matching wall plus white', () => {
    const anchor = createSynthesisTower('anchor', 4, 1)
    const wall = createSynthesisWall(3, 3)
    const available = getAvailableMahjongSynthesisOptions({
      gameStatus: 'building',
      anchorTower: anchor,
      fieldTowers: [anchor],
      walls: [wall],
      availableWhiteCount: 1
    })
    const unavailable = getAvailableMahjongSynthesisOptions({
      gameStatus: 'building',
      anchorTower: anchor,
      fieldTowers: [anchor],
      walls: [wall],
      availableWhiteCount: 0
    })

    expect(available).toContainEqual({
      recipe: { formation: 'chow', ranks: [3, 4, 5] },
      materialTowerIds: [],
      wallPosition: { row: 2, col: 3 },
      useWhite: true
    })
    expect(getFormations(available)).toContain('chow')
    expect(getFormations(unavailable)).not.toContain('chow')
  })

  it('publishes pung for a matching pair but not for the wrong face', () => {
    const anchor = createSynthesisTower('anchor', 3, 1)
    const matchingPair = createSynthesisTower('matching-pair', 3, 2, 'pair')
    const wrongPair = createSynthesisTower('wrong-pair', 4, 3, 'pair')
    const matchingWall = createSynthesisWall(3, 4)
    const available = getAvailableMahjongSynthesisOptions({
      gameStatus: 'ready',
      anchorTower: anchor,
      fieldTowers: [anchor, matchingPair],
      walls: [],
      availableWhiteCount: 0
    })
    const unavailable = getAvailableMahjongSynthesisOptions({
      gameStatus: 'ready',
      anchorTower: anchor,
      fieldTowers: [anchor, wrongPair],
      walls: [],
      availableWhiteCount: 0
    })
    const wallAndWhite = getAvailableMahjongSynthesisOptions({
      gameStatus: 'ready',
      anchorTower: anchor,
      fieldTowers: [anchor],
      walls: [matchingWall],
      availableWhiteCount: 1
    })

    expect(getFormations(available)).toContain('pung')
    expect(wallAndWhite).toContainEqual({
      recipe: { formation: 'pung' },
      materialTowerIds: [],
      wallPosition: { row: 2, col: 4 },
      useWhite: true
    })
    expect(getFormations(unavailable)).not.toContain('pung')
  })

  it('publishes kong for pung plus a matching active single, never a wall or white', () => {
    const pung = createSynthesisTower('anchor-pung', 3, 1, 'pung')
    const single = createSynthesisTower('matching-single', 3, 2)
    const available = getAvailableMahjongSynthesisOptions({
      gameStatus: 'ready',
      anchorTower: pung,
      fieldTowers: [pung, single],
      walls: [],
      availableWhiteCount: 0
    })
    const unavailable = getAvailableMahjongSynthesisOptions({
      gameStatus: 'ready',
      anchorTower: pung,
      fieldTowers: [pung],
      walls: [createSynthesisWall(3, 3)],
      availableWhiteCount: 1
    })

    expect(getFormations(available)).toContain('kong')
    expect(getFormations(unavailable)).not.toContain('kong')
  })
})
