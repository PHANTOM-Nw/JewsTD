import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { GridCell } from '../types/game'
import {
  MahjongWallDetail
} from './MahjongWallDetail'
import { submitMahjongWallRemoval } from './mahjongUiModel'

const tileWall: GridCell = {
  row: 4,
  col: 2,
  type: 'obstacle',
  mahjongWallKind: 'tile',
  mahjongTile: {
    id: 'opaque-wall',
    suit: 'bamboo',
    rank: 6,
    copy: 3
  }
}

const pureWall: GridCell = {
  row: 5,
  col: 3,
  type: 'obstacle',
  mahjongWallKind: 'pure'
}

describe('MahjongWallDetail', () => {
  it('shows the 60-gold tile return semantics', () => {
    const markup = renderToStaticMarkup(
      <MahjongWallDetail
        wall={tileWall}
        gold={120}
        gameStatus="building"
        onRemove={vi.fn(() => ({ ok: true as const, returnedTileId: 'opaque-wall' }))}
        onClose={vi.fn()}
      />
    )

    expect(markup).toContain('六条牌墙')
    expect(markup).toContain('60 金币')
    expect(markup).toContain('牌面实体返回发牌池')
    expect(markup).toContain('<dd>是</dd>')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('aria-live="polite"')
  })

  it('shows the 30-gold pure-wall semantics without a returned tile', () => {
    const markup = renderToStaticMarkup(
      <MahjongWallDetail
        wall={pureWall}
        gold={50}
        gameStatus="ready"
        onRemove={vi.fn(() => ({ ok: true as const, returnedTileId: null }))}
        onClose={vi.fn()}
      />
    )

    expect(markup).toContain('纯墙体')
    expect(markup).toContain('30 金币')
    expect(markup).toContain('不会向牌池返还数牌')
    expect(markup).toContain('<dd>否</dd>')
  })

  it('disables removal when gold is insufficient', () => {
    const markup = renderToStaticMarkup(
      <MahjongWallDetail
        wall={tileWall}
        gold={59}
        gameStatus="building"
        onRemove={vi.fn(() => ({ ok: true as const, returnedTileId: 'opaque-wall' }))}
        onClose={vi.fn()}
      />
    )

    expect(markup).toContain('还需要 1 金币')
    expect(markup).toContain('disabled=""')
  })

  it('closes only when the engine accepts the removal', () => {
    const close = vi.fn()
    const remove = vi.fn(() => ({ ok: true as const, returnedTileId: null }))

    expect(submitMahjongWallRemoval({ row: 5, col: 3 }, remove, close)).toEqual({
      ok: true,
      returnedTileId: null
    })
    expect(remove).toHaveBeenCalledWith({ row: 5, col: 3 })
    expect(close).toHaveBeenCalledOnce()

    close.mockClear()
    submitMahjongWallRemoval(
      { row: 5, col: 3 },
      vi.fn(() => ({ ok: false as const, reason: 'invalid_phase' as const })),
      close
    )
    expect(close).not.toHaveBeenCalled()
  })
})
