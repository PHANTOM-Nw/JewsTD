import { Children, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { getMahjongTileName, MAHJONG_HONOR_LABELS } from '../config/mahjong'
import type {
  MahjongAttachment,
  MahjongFormation,
  MahjongRank,
  MahjongSuit,
  Tower
} from '../types/game'
import { ATTACHMENT_FAILURE_MESSAGES } from './mahjongUiModel'
import {
  MahjongHonorAttachmentConfirm,
  MahjongHonorAttachmentConfirmView
} from './MahjongHonorAttachmentConfirm'

type ElementProps = {
  children?: ReactNode
  className?: string
  disabled?: boolean
  'aria-label'?: string
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

const findConfirm = (view: ReactNode) => findElement(view, element => (
  element.props.className === 'synthesis-dialog__confirm'
))

function createTower(
  suit: MahjongSuit,
  formation: MahjongFormation,
  attachments: MahjongAttachment[] = []
): Tower {
  const count = formation === 'single'
    ? 1
    : formation === 'pair'
      ? 2
      : formation === 'kong'
        ? 4
        : 3
  const ranks: MahjongRank[] = formation === 'chow'
    ? [3, 4, 5]
    : Array.from({ length: count }, () => 3 as MahjongRank)
  const tileIds = Array.from({ length: count }, (_, index) => `tile-${index}`)

  return {
    id: 'tower-1',
    mahjongTile: { id: tileIds[0], suit, rank: 3, copy: 1 },
    mahjongState: {
      formation,
      suit,
      ranks,
      containedTileIds: tileIds,
      activeSources: tileIds.map(tileId => ({
        tileId,
        originalStats: { damage: 30, attackIntervalMs: 1000, attackRange: 120 }
      })),
      attachments
    },
    level: 'chipped',
    gridPosition: { row: 1, col: 1 },
    position: { x: 60, y: 60 },
    damage: 30,
    range: 120,
    attackSpeed: 1000,
    lastAttackTime: 0,
    damageType: suit === 'dots' ? 'magic' : 'physical'
  }
}

describe('MahjongHonorAttachmentConfirm', () => {
  it('confirms 中 against the concrete target tower with suit-aware effects', () => {
    const tower = createTower('characters', 'pung')
    const confirm = vi.fn()
    const markup = renderToStaticMarkup(
      <MahjongHonorAttachmentConfirm
        tower={tower}
        attachment="red"
        onConfirm={confirm}
        onClose={vi.fn()}
      />
    )

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('aria-labelledby="mahjong-attachment-title"')
    expect(markup).toContain(`将${MAHJONG_HONOR_LABELS.red}附着到${getMahjongTileName(tower.mahjongTile!)}`)
    expect(markup).toContain('确认附着')
    // 万保留自身暴击倍率的花色专属文案。
    expect(markup).toContain('保留自身暴击倍率')

    const view = MahjongHonorAttachmentConfirmView({
      tower,
      attachment: 'red',
      onConfirm: confirm,
      onClose: vi.fn()
    })
    const confirmButton = findConfirm(view)
    expect(confirmButton?.props.disabled).toBe(false)
    confirmButton?.props.onClick?.()
    expect(confirm).toHaveBeenCalledOnce()
  })

  it('offers a cancel action that only closes the dialog', () => {
    const close = vi.fn()
    const confirm = vi.fn()
    const view = MahjongHonorAttachmentConfirmView({
      tower: createTower('bamboo', 'chow'),
      attachment: 'green',
      onConfirm: confirm,
      onClose: close
    })

    const cancelButton = findElement(view, element => element.props.children === '取消')
    expect(cancelButton).not.toBeNull()
    cancelButton?.props.onClick?.()
    expect(close).toHaveBeenCalledOnce()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('disables confirmation and states the reason when the honor is already attached', () => {
    const tower = createTower('dots', 'single', ['red'])
    const confirm = vi.fn()
    const view = MahjongHonorAttachmentConfirmView({
      tower,
      attachment: 'red',
      onConfirm: confirm,
      onClose: vi.fn()
    })

    const confirmButton = findConfirm(view)
    expect(confirmButton?.props.disabled).toBe(true)
    confirmButton?.props.onClick?.()
    expect(confirm).not.toHaveBeenCalled()

    const markup = renderToStaticMarkup(
      <MahjongHonorAttachmentConfirm
        tower={tower}
        attachment="red"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(markup).toContain(ATTACHMENT_FAILURE_MESSAGES.already_attached)
  })

  it('blocks a second attachment when the single-tile capacity is full', () => {
    const tower = createTower('characters', 'single', ['red'])
    const markup = renderToStaticMarkup(
      <MahjongHonorAttachmentConfirm
        tower={tower}
        attachment="green"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(markup).toContain(ATTACHMENT_FAILURE_MESSAGES.attachment_capacity)
    expect(markup).toContain('disabled')

    const view = MahjongHonorAttachmentConfirmView({
      tower,
      attachment: 'green',
      onConfirm: vi.fn(),
      onClose: vi.fn()
    })
    expect(findConfirm(view)?.props.disabled).toBe(true)
  })
})
