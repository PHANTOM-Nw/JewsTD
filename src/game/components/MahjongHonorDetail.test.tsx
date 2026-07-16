import { Children, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  MAHJONG_HONOR_LABELS,
  MAHJONG_WHITE_CATALYST_CONFIG
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

describe('MahjongHonorDetail', () => {
  it('shows 白 as a close-only catalyst dialog derived from the white config', () => {
    const markup = renderToStaticMarkup(<MahjongHonorDetail onClose={vi.fn()} />)

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('aria-labelledby="mahjong-honor-title"')
    expect(markup).toContain(MAHJONG_HONOR_LABELS.white)
    expect(markup).toContain(`${MAHJONG_WHITE_CATALYST_CONFIG.maxPerSynthesis} 张`)
    // 白没有附着流程，因此没有确认选择/确认附着按钮。
    expect(markup).not.toContain('确认选择')
    expect(markup).not.toContain('确认附着')
    expect(markup).toContain('>关闭<')
  })

  it('closes when the sole action is pressed', () => {
    const close = vi.fn()
    const view = MahjongHonorDetailView({ onClose: close })

    const closeButton = findElement(view, element => element.props.children === '关闭')
    expect(closeButton).not.toBeNull()
    closeButton?.props.onClick?.()
    expect(close).toHaveBeenCalledOnce()
  })
})
