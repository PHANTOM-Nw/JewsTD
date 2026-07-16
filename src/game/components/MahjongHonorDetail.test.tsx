import { Children, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  MAHJONG_HONOR_LABELS,
  MAHJONG_RED_ATTACHMENT_CONFIG
} from '../config/mahjong'
import { MahjongHonorDetail, MahjongHonorDetailView } from './MahjongHonorDetail'

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

describe('MahjongHonorDetail', () => {
  it('presents 中 as a confirmable attachment dialog with config-derived effects', () => {
    const markup = renderToStaticMarkup(
      <MahjongHonorDetail honor="red" canAttach onConfirm={vi.fn()} onClose={vi.fn()} />
    )

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('aria-labelledby="mahjong-honor-title"')
    expect(markup).toContain(MAHJONG_HONOR_LABELS.red)
    expect(markup).toContain(`×${MAHJONG_RED_ATTACHMENT_CONFIG.damageMultiplier}`)
    expect(markup).toContain('确认选择')
    expect(markup).toContain('>取消<')
  })

  it('confirms 中 with its honor and closes on cancel', () => {
    const confirm = vi.fn()
    const close = vi.fn()
    const view = MahjongHonorDetailView({
      honor: 'red',
      canAttach: true,
      onConfirm: confirm,
      onClose: close
    })

    const confirmButton = findConfirm(view)
    expect(confirmButton?.props.disabled).toBe(false)
    confirmButton?.props.onClick?.()
    expect(confirm).toHaveBeenCalledOnce()
    expect(confirm).toHaveBeenCalledWith('red')

    const cancelButton = findElement(view, element => element.props.children === '取消')
    expect(cancelButton).not.toBeNull()
    cancelButton?.props.onClick?.()
    expect(close).toHaveBeenCalledOnce()
  })

  it('confirms 發 with its own honor', () => {
    const confirm = vi.fn()
    const view = MahjongHonorDetailView({
      honor: 'green',
      canAttach: true,
      onConfirm: confirm,
      onClose: vi.fn()
    })

    findConfirm(view)?.props.onClick?.()
    expect(confirm).toHaveBeenCalledWith('green')
  })

  it('disables confirmation while attachment is not allowed', () => {
    const markup = renderToStaticMarkup(
      <MahjongHonorDetail honor="green" canAttach={false} onConfirm={vi.fn()} onClose={vi.fn()} />
    )
    expect(markup).toContain('确认选择')
    expect(markup).toContain('disabled=""')

    const view = MahjongHonorDetailView({
      honor: 'green',
      canAttach: false,
      onConfirm: vi.fn(),
      onClose: vi.fn()
    })
    expect(findConfirm(view)?.props.disabled).toBe(true)
  })

  it('shows 白 as a close-only catalyst dialog with no confirmation path', () => {
    const confirm = vi.fn()
    const close = vi.fn()
    const markup = renderToStaticMarkup(
      <MahjongHonorDetail honor="white" canAttach onConfirm={confirm} onClose={close} />
    )

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain(MAHJONG_HONOR_LABELS.white)
    expect(markup).not.toContain('确认选择')
    expect(markup).toContain('>关闭<')

    const view = MahjongHonorDetailView({
      honor: 'white',
      canAttach: true,
      onConfirm: confirm,
      onClose: close
    })
    expect(findConfirm(view)).toBeNull()

    const closeButton = findElement(view, element => element.props.children === '关闭')
    closeButton?.props.onClick?.()
    expect(close).toHaveBeenCalledOnce()
    expect(confirm).not.toHaveBeenCalled()
  })
})
