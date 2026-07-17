import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  GridCell,
  MahjongAttachment,
  MahjongFormation,
  MahjongRank,
  MahjongSuit,
  Tower
} from '../types/game'
import {
  MahjongSynthesisDialog
} from './MahjongSynthesisDialog'
import {
  submitMahjongSynthesis,
  type MahjongSynthesisSubmitRequest
} from './mahjongUiModel'

function createTower(
  id: string,
  suit: MahjongSuit,
  rank: MahjongRank,
  col: number,
  options: {
    formation?: MahjongFormation
    attachments?: MahjongAttachment[]
  } = {}
): Tower {
  const formation = options.formation ?? 'single'
  const sourceCount = formation === 'single'
    ? 1
    : formation === 'pair'
      ? 2
      : formation === 'kong'
        ? 4
        : 3
  const tileIds = Array.from({ length: sourceCount }, (_, index) => `opaque-${id}-${index}`)
  const tileId = tileIds[0]
  const stats = {
    damage: rank === 3 ? 30 : 38,
    attackIntervalMs: rank === 3 ? 1000 : 800,
    attackRange: rank === 3 ? 120 : 140
  }
  return {
    id,
    mahjongTile: { id: tileId, suit, rank, copy: 1 },
    mahjongState: {
      formation,
      suit,
      ranks: Array.from({ length: sourceCount }, () => rank),
      containedTileIds: tileIds,
      activeSources: tileIds.map(sourceTileId => ({
        tileId: sourceTileId,
        originalStats: { ...stats }
      })),
      attachments: options.attachments ?? (id === 'anchor' ? ['red'] : [])
    },
    level: 'chipped',
    gridPosition: { row: 1, col },
    position: { x: col * 40 + 20, y: 60 },
    damage: stats.damage,
    range: stats.attackRange,
    attackSpeed: stats.attackIntervalMs,
    lastAttackTime: 0,
    damageType: suit === 'dots' ? 'magic' : 'physical'
  }
}

function tileWall(rank: MahjongRank, col: number): GridCell {
  return {
    row: 2,
    col,
    type: 'obstacle',
    mahjongWallKind: 'tile',
    mahjongTile: {
      id: `opaque-wall-${rank}`,
      suit: 'characters',
      rank,
      copy: 2
    }
  }
}

const pureWall: GridCell = {
  row: 2,
  col: 7,
  type: 'obstacle',
  mahjongWallKind: 'pure'
}

describe('MahjongSynthesisDialog', () => {
  it('shows only completable routes and materials for the selected route', () => {
    const anchor = createTower('anchor', 'characters', 3, 1)
    const mate = createTower('mate', 'characters', 3, 2)
    const wrongMate = createTower('wrong-mate', 'characters', 6, 4)
    const markup = renderToStaticMarkup(
      <MahjongSynthesisDialog
        gameStatus="building"
        anchorTower={anchor}
        fieldTowers={[anchor, mate, wrongMate]}
        walls={[tileWall(3, 3), tileWall(6, 5), pureWall]}
        availableWhiteCount={1}
        initialSelection={{ formation: 'pung' }}
        onConfirm={vi.fn(() => ({ ok: true as const, towerId: anchor.id }))}
        onClose={vi.fn()}
      />
    )

    expect(markup).toContain('麻将合成工作台')
    expect(markup).toContain(
      'synthesis-dialog-backdrop synthesis-dialog-backdrop--board-visible'
    )
    expect(markup).toContain('对子')
    expect(markup).toContain('碰（明刻）')
    expect(markup).not.toContain('吃（顺子）')
    expect(markup).not.toContain('>杠<')
    expect(markup).toContain('选择主动材料三萬')
    expect(markup).toContain('选择牌墙材料三萬')
    expect(markup).not.toContain('选择主动材料六萬')
    expect(markup).not.toContain('选择牌墙材料六萬')
    expect(markup).not.toContain('type="checkbox"')
    expect(markup).not.toContain('纯墙体')
    expect(markup).toContain('产物固定保留在这里')
    expect(markup).toContain('mahjong-synthesis__anchor--target')
    expect(markup).toContain('aria-live="polite"')
    expect(markup).not.toContain('aria-modal="true"')
  })

  it('previews final stats, attachment inheritance and pure-wall positions', () => {
    const anchor = createTower('anchor', 'characters', 3, 1)
    const mate = createTower('mate', 'characters', 3, 2)
    const markup = renderToStaticMarkup(
      <MahjongSynthesisDialog
        gameStatus="ready"
        anchorTower={anchor}
        fieldTowers={[anchor, mate]}
        walls={[]}
        availableWhiteCount={0}
        initialSelection={{ formation: 'pair', materialTowerIds: [mate.id] }}
        onConfirm={vi.fn(() => ({ ok: true as const, towerId: anchor.id }))}
        onClose={vi.fn()}
      />
    )

    expect(markup).toContain('伤害 46.5')
    expect(markup).toContain('攻击间隔 1000ms')
    expect(markup).toContain('攻击距离 126.0')
    expect(markup).toContain('继承：中')
    expect(markup).toContain('消耗主动棋子 1 座')
    expect(markup).toContain('变为纯墙：2行3列')
    expect(markup).toContain('完整能力')
    expect(markup).toContain('物理伤害')
    expect(markup).toContain('暴击25%，暴伤×2')
    expect(markup).toContain('忽略护甲25%')
    expect(markup).toContain('中：总伤害×1.25')
    expect(markup).toContain('听碰：缺1张三萬')
    expect(markup).toContain('听杠：缺2张主动三萬')
    expect(markup).toContain('aria-label="产物完整能力"')
    expect(markup).not.toContain('disabled="" class="synthesis-dialog__confirm"')
  })

  it('auto-derives white to fill a chow gap and previews the white face', () => {
    const anchor = createTower('anchor', 'characters', 3, 1)
    const wall = tileWall(4, 3)
    const markup = renderToStaticMarkup(
      <MahjongSynthesisDialog
        gameStatus="building"
        anchorTower={anchor}
        fieldTowers={[anchor]}
        walls={[wall]}
        availableWhiteCount={1}
        initialSelection={{
          formation: 'chow',
          chowStart: 3,
          wallPosition: wall
        }}
        onConfirm={vi.fn(() => ({ ok: true as const, towerId: anchor.id }))}
        onClose={vi.fn()}
      />
    )

    // 复选框已移除，改为按缺口自动推导的只读展示。
    expect(markup).not.toContain('type="checkbox"')
    expect(markup).not.toContain('使用 1 张白替代缺牌')
    expect(markup).toContain('本次将使用 1 张白板替代缺失牌位')
    expect(markup).toContain('功能牌区现有 1 张')
    expect(markup).toContain('确认成功后才消耗')
    expect(markup).toContain('吃（顺子）')
    expect(markup).toContain('变为纯墙：3行4列')
    expect(markup).toContain('顺子3发，最多3个目标，总伤害按实际目标数均分')
    expect(markup).toContain('暴击25%，暴伤×2')
    expect(markup).toContain('中：总伤害×1.25')
    // 缺口牌位在产物预览区画白板脸（空心蓝描边矩形，与 MahjongTile honor="white" 一致）。
    const preview = markup.slice(markup.indexOf('产物预览'))
    expect(preview).toContain('width="24" height="38"')
  })

  it('auto-derives white for a pung and describes the read-only stock line', () => {
    const anchor = createTower('anchor', 'characters', 3, 1)
    const markup = renderToStaticMarkup(
      <MahjongSynthesisDialog
        gameStatus="ready"
        anchorTower={anchor}
        fieldTowers={[anchor]}
        walls={[]}
        availableWhiteCount={2}
        initialSelection={{ formation: 'pung' }}
        onConfirm={vi.fn(() => ({ ok: true as const, towerId: anchor.id }))}
        onClose={vi.fn()}
      />
    )

    expect(markup).toContain('碰（明刻）')
    expect(markup).not.toContain('type="checkbox"')
    // 单牌锚补 2 张白凑碰。
    expect(markup).toContain('本次将使用 2 张白板替代缺失牌位')
    expect(markup).toContain('功能牌区现有 2 张')
    // 两个排尾白位在产物预览区都画白板脸。
    const preview = markup.slice(markup.indexOf('产物预览'))
    expect(preview.split('width="24" height="38"').length - 1).toBe(2)
  })

  it('fills a kong with white and never offers a wall for it', () => {
    const pungAnchor = createTower('anchor', 'characters', 3, 1, { formation: 'pung' })
    const markup = renderToStaticMarkup(
      <MahjongSynthesisDialog
        gameStatus="ready"
        anchorTower={pungAnchor}
        fieldTowers={[pungAnchor]}
        walls={[tileWall(3, 5)]}
        availableWhiteCount={1}
        initialSelection={{ formation: 'kong' }}
        onConfirm={vi.fn(() => ({ ok: true as const, towerId: pungAnchor.id }))}
        onClose={vi.fn()}
      />
    )

    expect(markup).toContain('杠')
    expect(markup).toContain('本次将使用 1 张白板替代缺失牌位')
    expect(markup).toContain('功能牌区现有 1 张')
    // 杠不吸墙：即便场上有同点牌墙也不出现牌墙材料区。
    expect(markup).not.toContain('选择具体普通牌墙')
    expect(markup).not.toContain('type="checkbox"')
    // 杠的排尾白位在产物预览区画白板脸。
    const preview = markup.slice(markup.indexOf('产物预览'))
    expect(preview).toContain('width="24" height="38"')
  })

  it('previews kong poison and both inherited 中發 effects', () => {
    const pung = createTower('anchor', 'bamboo', 3, 1, {
      formation: 'pung',
      attachments: ['red']
    })
    const single = createTower('single', 'bamboo', 3, 2, {
      attachments: ['green']
    })
    const markup = renderToStaticMarkup(
      <MahjongSynthesisDialog
        gameStatus="ready"
        anchorTower={pung}
        fieldTowers={[pung, single]}
        walls={[]}
        availableWhiteCount={0}
        initialSelection={{ formation: 'kong', materialTowerIds: [single.id] }}
        onConfirm={vi.fn(() => ({ ok: true as const, towerId: pung.id }))}
        onClose={vi.fn()}
      />
    )

    expect(markup).toContain('杠')
    expect(markup).toContain('继承：中、發')
    expect(markup).toContain('毒伤12/秒，持续5秒，同来源最多4层')
    expect(markup).toContain('暴击10%，暴伤×2')
    expect(markup).toContain('中：总伤害×1.25')
    expect(markup).toContain('發：同目标每次命中攻击频率+3%')
  })

  it('closes only after the engine accepts the exact request', () => {
    const request: MahjongSynthesisSubmitRequest = {
      anchorTowerId: 'anchor',
      materialTowerIds: ['mate'],
      wallPositions: [],
      recipe: { formation: 'pair' },
      whiteCount: 0
    }
    const close = vi.fn()
    const confirm = vi.fn(() => ({ ok: true as const, towerId: 'anchor' }))

    expect(submitMahjongSynthesis(request, confirm, close)).toEqual({
      ok: true,
      towerId: 'anchor'
    })
    expect(confirm).toHaveBeenCalledWith(request)
    expect(close).toHaveBeenCalledOnce()

    close.mockClear()
    const rejected = vi.fn(() => ({
      ok: false as const,
      reason: 'invalid_phase' as const
    }))
    submitMahjongSynthesis(request, rejected, close)
    expect(close).not.toHaveBeenCalled()
  })
})
