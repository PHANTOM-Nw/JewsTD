import { Children, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { GridCell, MahjongSuit, Tower } from '../types/game'
import { MahjongActivationDecision } from './MahjongActivationDecision'

type ElementProps = {
  children?: ReactNode
  'aria-label'?: string
  className?: string
  onClick?: () => void
}

function findElement(
  node: ReactNode,
  predicate: (element: ReactElement<ElementProps>) => boolean
): ReactElement<ElementProps> | null {
  let match: ReactElement<ElementProps> | null = null
  Children.forEach(node, child => {
    if (match || !isValidElement(child)) return
    const element = child as ReactElement<ElementProps>
    if (predicate(element)) {
      match = element
      return
    }
    match = findElement(element.props.children, predicate)
  })
  return match
}

function tower(
  id: string,
  suit: MahjongSuit,
  rank: 2 | 5 | 8,
  stats: { damage: number; attackIntervalMs: number; attackRange: number }
): Tower {
  const tileId = `opaque-${id}`
  return {
    id,
    mahjongTile: { id: tileId, suit, rank, copy: 1 },
    mahjongState: {
      formation: 'single',
      suit,
      ranks: [rank],
      containedTileIds: [tileId],
      activeSources: [{ tileId, originalStats: stats }],
      attachments: []
    },
    level: 'chipped',
    gridPosition: { row: 1, col: rank },
    position: { x: 20, y: 20 },
    damage: stats.damage,
    range: stats.attackRange,
    attackSpeed: stats.attackIntervalMs,
    lastAttackTime: 0,
    damageType: suit === 'dots' ? 'magic' : 'physical'
  }
}

const candidates = [
  tower('wan', 'characters', 2, { damage: 31, attackIntervalMs: 920, attackRange: 118 }),
  tower('tiao', 'bamboo', 5, { damage: 17, attackIntervalMs: 510, attackRange: 149 }),
  tower('tong', 'dots', 8, { damage: 26, attackIntervalMs: 1100, attackRange: 132 })
]

function tileWall(rank: 2 | 5 | 8, col: number): GridCell {
  return {
    row: 4,
    col,
    type: 'obstacle',
    mahjongWallKind: 'tile',
    mahjongTile: { id: `opaque-wall-${rank}`, suit: 'characters', rank, copy: 2 }
  }
}

const pureWall: GridCell = {
  row: 5,
  col: 3,
  type: 'obstacle',
  mahjongWallKind: 'pure'
}

describe('MahjongActivationDecision', () => {
  it('compares all three random stats and the suit mechanic on every candidate', () => {
    const markup = renderToStaticMarkup(
      <MahjongActivationDecision
        towers={candidates}
        fieldTowers={[]}
        fieldWalls={[]}
        selectedTowerId="wan"
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    expect(markup).toContain('伤害 31')
    expect(markup).toContain('间隔 920ms')
    expect(markup).toContain('距离 118')
    expect(markup).toContain('暴击15%，2倍伤害')
    expect(markup).toContain('毒素4点/秒，持续3秒')
    expect(markup).toContain('减速25%，持续1.5秒')
    expect(markup).toContain('选择二萬作为激活牌；单牌；伤害31；攻击间隔920毫秒；攻击距离118；物理伤害；暴击15%，暴伤×2')
    expect(markup).toContain('选择五条作为激活牌；单牌；伤害17；攻击间隔510毫秒；攻击距离149；物理伤害；毒伤4/秒，持续3秒，同来源最多1层')
    expect(markup).toContain('选择八筒作为激活牌；单牌；伤害26；攻击间隔1100毫秒；攻击距离132；魔法伤害；减速25%，持续1.5秒')
    expect(markup).not.toContain('opaque-wan')
    expect(markup).not.toContain('opaque-tiao')
    expect(markup).not.toContain('opaque-tong')
  })

  it('routes candidate selection and confirmation without changing game state itself', () => {
    const select = vi.fn()
    const confirm = vi.fn()
    const panel = MahjongActivationDecision({
      towers: candidates,
      fieldTowers: [],
      fieldWalls: [],
      selectedTowerId: 'wan',
      onSelect: select,
      onConfirm: confirm
    })
    const selectBamboo = findElement(panel, element => (
      element.props['aria-label']?.startsWith('选择五条作为激活牌') ?? false
    ))
    const confirmButton = findElement(panel, element => (
      element.props.className === 'tower-decision__confirm'
    ))

    selectBamboo?.props.onClick?.()
    confirmButton?.props.onClick?.()

    expect(select).toHaveBeenCalledWith(candidates[1])
    expect(confirm).toHaveBeenCalledWith('wan')
  })

  it('lists the field faces in a default-collapsed block that highlights the current round', () => {
    const history = tower('history', 'bamboo', 5, {
      damage: 22,
      attackIntervalMs: 700,
      attackRange: 130
    })
    const markup = renderToStaticMarkup(
      <MahjongActivationDecision
        towers={candidates}
        fieldTowers={[history]}
        fieldWalls={[tileWall(8, 2), pureWall]}
        selectedTowerId="wan"
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    // 折叠标题与总数：本轮 3 + 历史激活塔 1 + 带牌面墙 1（纯墙不计）。
    expect(markup).toContain('场上牌面（5）')
    // 默认收起：<details> 不带 open 属性。
    expect(markup).toContain('<details class="tower-decision__field">')
    expect(markup).not.toMatch(/<details[^>]*\bopen\b/)
    // 本轮 3 张高亮。
    expect(markup.match(/field-tile--current/g)).toHaveLength(3)
    // 历史激活塔以普通 field-tile 渲染（既非 current 也非 wall）。
    expect(markup.match(/class="field-tile"/g)).toHaveLength(1)
    // 只有 1 面带牌面墙，纯墙被忽略。
    expect(markup.match(/field-tile--wall/g)).toHaveLength(1)
  })
})
