import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type {
  MahjongAttachment,
  MahjongFormation,
  MahjongSuit,
  Tower
} from '../types/game'
import { MahjongTowerInspection } from './MahjongTowerInspection'

function createTower(
  options: {
    suit?: MahjongSuit
    formation?: MahjongFormation
    attachments?: MahjongAttachment[]
    row?: number
    col?: number
  } = {}
): Tower {
  const suit = options.suit ?? 'characters'
  const formation = options.formation ?? 'pair'
  const attachments = options.attachments ?? ['red']
  const row = options.row ?? 3
  const col = options.col ?? 2
  const ranks = formation === 'single'
    ? [3] as const
    : formation === 'pair'
      ? [3, 3] as const
      : formation === 'chow'
        ? [2, 3, 4] as const
        : formation === 'pung'
          ? [3, 3, 3] as const
          : [3, 3, 3, 3] as const
  const activeSources = [
    {
      tileId: 'opaque-source-a',
      originalStats: { damage: 30, attackIntervalMs: 1000, attackRange: 120 }
    },
    {
      tileId: 'opaque-source-b',
      originalStats: { damage: 30, attackIntervalMs: 1000, attackRange: 120 }
    }
  ]

  return {
    id: 'tower-to-inspect',
    mahjongTile: {
      id: 'opaque-source-a',
      suit,
      rank: 3,
      copy: 1
    },
    mahjongState: {
      formation,
      suit,
      ranks: [...ranks],
      containedTileIds: activeSources.map(source => source.tileId),
      activeSources,
      attachments
    },
    level: 'chipped',
    gridPosition: { row, col },
    position: { x: col * 40 + 20, y: row * 40 + 20 },
    damage: 46.5,
    range: 126,
    attackSpeed: 1000,
    lastAttackTime: 0,
    damageType: suit === 'dots' ? 'magic' : 'physical'
  }
}

describe('MahjongTowerInspection', () => {
  it('shows the runtime base panel and the config-derived ability summary', () => {
    const markup = renderToStaticMarkup(
      <MahjongTowerInspection tower={createTower()} />
    )

    expect(markup).toContain('三萬 · 对子')
    expect(markup).toContain('<dt>伤害</dt><dd>46.5</dd>')
    expect(markup).toContain('<dt>攻击间隔</dt><dd>1000ms</dd>')
    expect(markup).toContain('<dt>射程</dt><dd>126</dd>')
    expect(markup).toContain('能力摘要')
    expect(markup).toContain('物理伤害')
    expect(markup).toContain('暴击25%，暴伤×2')
    expect(markup).toContain('忽略护甲25%')
    expect(markup).toContain('中：总伤害×1.25')
    expect(markup).not.toContain('opaque-source')
  })

  it('renders a non-interactive range circle and an announced status bubble', () => {
    const markup = renderToStaticMarkup(
      <MahjongTowerInspection tower={createTower()} />
    )

    expect(markup).toContain('mahjong-tower-inspection__range')
    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('role="status"')
    expect(markup).toContain('aria-live="polite"')
    expect(markup).toContain('aria-atomic="true"')
  })

  it('places edge bubbles inward from the top-left and bottom-right', () => {
    const topLeft = renderToStaticMarkup(
      <MahjongTowerInspection tower={createTower({ row: 0, col: 0 })} />
    )
    const bottomRight = renderToStaticMarkup(
      <MahjongTowerInspection tower={createTower({ row: 9, col: 7 })} />
    )

    expect(topLeft).toContain('mahjong-tower-inspection__bubble--left')
    expect(topLeft).toContain('mahjong-tower-inspection__bubble--below')
    expect(bottomRight).toContain('mahjong-tower-inspection__bubble--right')
    expect(bottomRight).toContain('mahjong-tower-inspection__bubble--above')
  })
})
