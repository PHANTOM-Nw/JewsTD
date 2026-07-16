import { Children, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { MahjongSuit, Tower } from '../types/game'
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

describe('MahjongActivationDecision', () => {
  it('compares all three random stats and the suit mechanic on every candidate', () => {
    const markup = renderToStaticMarkup(
      <MahjongActivationDecision
        towers={candidates}
        selectedTowerId="wan"
        minimized={false}
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        onToggleMinimized={vi.fn()}
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

  it('routes candidate selection, confirmation and minimize without changing game state itself', () => {
    const select = vi.fn()
    const confirm = vi.fn()
    const toggle = vi.fn()
    const panel = MahjongActivationDecision({
      towers: candidates,
      selectedTowerId: 'wan',
      minimized: false,
      onSelect: select,
      onConfirm: confirm,
      onToggleMinimized: toggle
    })
    const selectBamboo = findElement(panel, element => (
      element.props['aria-label']?.startsWith('选择五条作为激活牌') ?? false
    ))
    const confirmButton = findElement(panel, element => (
      element.props.className === 'tower-decision__confirm'
    ))
    const minimizeButton = findElement(panel, element => (
      element.props.className === 'tower-decision__minimize'
    ))

    selectBamboo?.props.onClick?.()
    confirmButton?.props.onClick?.()
    minimizeButton?.props.onClick?.()

    expect(select).toHaveBeenCalledWith(candidates[1])
    expect(confirm).toHaveBeenCalledWith('wan')
    expect(toggle).toHaveBeenCalledTimes(1)
  })

  it('renders only a floating restore button when minimized and routes it back to the toggle', () => {
    const markup = renderToStaticMarkup(
      <MahjongActivationDecision
        towers={candidates}
        selectedTowerId="wan"
        minimized={true}
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        onToggleMinimized={vi.fn()}
      />
    )

    expect(markup).toContain('tower-decision-restore')
    expect(markup).toContain('aria-label="展开三选一面板"')
    expect(markup).not.toContain('tower-choice')
    expect(markup).not.toContain('role="dialog"')

    const toggle = vi.fn()
    const panel = MahjongActivationDecision({
      towers: candidates,
      selectedTowerId: 'wan',
      minimized: true,
      onSelect: vi.fn(),
      onConfirm: vi.fn(),
      onToggleMinimized: toggle
    })
    const restoreButton = findElement(panel, element => (
      element.props.className === 'tower-decision-restore'
    ))
    restoreButton?.props.onClick?.()

    expect(toggle).toHaveBeenCalledTimes(1)
  })
})
