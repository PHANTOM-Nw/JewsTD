import { describe, expect, it } from 'vitest'
import type {
  MahjongAttachment,
  MahjongFormation,
  MahjongSuit,
  MahjongTowerState,
  Tower
} from '../types/game'
import {
  getMahjongAbilitySummary,
  getMahjongPairRouteHint,
  getMahjongStateFinalStats,
  getMahjongTowerActionLabel,
  getMahjongTowerComparisonLabel
} from './mahjongUiModel'

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
