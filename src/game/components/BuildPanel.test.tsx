import { Children, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { MahjongRoundTileView } from '../types/game'
import { BuildPanel, FunctionTileStrip } from './BuildPanel'

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

const choosingTiles: MahjongRoundTileView[] = [
  {
    id: 'characters-2-1',
    source: 'hand',
    visibility: 'suit',
    suit: 'characters'
  },
  {
    id: 'bamboo-5-1',
    source: 'draw',
    visibility: 'hidden'
  },
  {
    id: 'dots-8-1',
    source: 'draw',
    visibility: 'hidden'
  }
]

const keepingTiles: MahjongRoundTileView[] = [
  choosingTiles[0],
  {
    ...choosingTiles[1],
    visibility: 'suit',
    suit: 'bamboo'
  },
  {
    ...choosingTiles[2],
    visibility: 'suit',
    suit: 'dots'
  }
]

function renderHandPanel({
  roundTiles,
  canGambleForHonor,
  onRevealHandSuits,
  onKeepHand,
  onGambleForHonor
}: {
  roundTiles: MahjongRoundTileView[]
  canGambleForHonor: boolean
  onRevealHandSuits?: () => void
  onKeepHand?: (tileId: string) => void
  onGambleForHonor?: () => void
}) {
  return BuildPanel({
    wood: 0,
    gold: 50,
    placedCount: 3,
    gameStatus: 'resolving_hand',
    roundTiles,
    heldTileSuit: null,
    functionTiles: [],
    canGambleForHonor,
    lastHonorGamble: null,
    onRevealHandSuits,
    onKeepHand,
    onGambleForHonor
  })
}

describe('BuildPanel hand resolution choice', () => {
  it('keeps both new suits hidden and requires a strategy choice before keeping a tile', () => {
    const revealSuits = vi.fn()
    const keepHand = vi.fn()
    const gamble = vi.fn()
    const panel = renderHandPanel({
      roundTiles: choosingTiles,
      canGambleForHonor: true,
      onRevealHandSuits: revealSuits,
      onKeepHand: keepHand,
      onGambleForHonor: gamble
    })
    const markup = renderToStaticMarkup(panel)

    expect(markup).toContain('选择剩余牌处理方式')
    expect(markup).toContain('看花色选牌')
    expect(markup).toContain('赌中發白')
    expect(markup.match(/新暗牌/g)).toHaveLength(2)
    expect(markup).not.toContain('选择下一回合手牌')
    expect(markup).not.toContain('条 · 点数未知')
    expect(markup).not.toContain('筒 · 点数未知')
    expect(findElement(panel, element => (
      element.props['aria-label']?.startsWith('保留') ?? false
    ))).toBeNull()

    const inspectButton = findElement(panel, element => (
      element.props.className === 'mahjong-inspect'
    ))
    inspectButton?.props.onClick?.()

    expect(revealSuits).toHaveBeenCalledOnce()
    expect(keepHand).not.toHaveBeenCalled()
    expect(gamble).not.toHaveBeenCalled()
  })

  it('routes the gamble choice directly to resolution without revealing or keeping first', () => {
    const revealSuits = vi.fn()
    const keepHand = vi.fn()
    const gamble = vi.fn()
    const panel = renderHandPanel({
      roundTiles: choosingTiles,
      canGambleForHonor: true,
      onRevealHandSuits: revealSuits,
      onKeepHand: keepHand,
      onGambleForHonor: gamble
    })
    const gambleButton = findElement(panel, element => (
      element.props.className === 'mahjong-gamble'
    ))

    gambleButton?.props.onClick?.()

    expect(gamble).toHaveBeenCalledOnce()
    expect(revealSuits).not.toHaveBeenCalled()
    expect(keepHand).not.toHaveBeenCalled()
  })

  it('reveals all three suits and enables keeping only after choosing inspection', () => {
    const keepHand = vi.fn()
    const panel = renderHandPanel({
      roundTiles: keepingTiles,
      canGambleForHonor: false,
      onKeepHand: keepHand
    })
    const markup = renderToStaticMarkup(panel)

    expect(markup).toContain('选择下一回合手牌')
    expect(markup).toContain('万 · 点数未知')
    expect(markup).toContain('条 · 点数未知')
    expect(markup).toContain('筒 · 点数未知')
    expect(markup).not.toContain('看花色选牌')
    expect(markup).not.toContain('赌中發白')

    const keepBamboo = findElement(panel, element => (
      element.props['aria-label'] === '保留条花色手牌'
    ))
    keepBamboo?.props.onClick?.()

    expect(keepHand).toHaveBeenCalledOnce()
    expect(keepHand).toHaveBeenCalledWith('bamboo-5-1')
  })
})

describe('BuildPanel function tile actions', () => {
  it('offers accessible red and green target actions while reserving white for synthesis', () => {
    const selectFunctionTile = vi.fn()
    const panel = BuildPanel({
      wood: 3,
      gold: 50,
      placedCount: 0,
      gameStatus: 'building',
      roundTiles: [],
      heldTileSuit: null,
      functionTiles: ['red', 'green', 'white'],
      canGambleForHonor: false,
      lastHonorGamble: null,
      onSelectFunctionTile: selectFunctionTile
    })
    const markup = renderToStaticMarkup(panel)

    expect(markup).toContain('功能牌区')
    expect(markup).toContain('选择中，然后选择一座激活棋子附着')
    expect(markup).toContain('选择發，然后选择一座激活棋子附着')
    expect(markup).toContain('白，只能在吃或碰的合成工作台中作为材料')

    const strip = FunctionTileStrip({
      tiles: ['red', 'green', 'white'],
      canAttach: true,
      onSelect: selectFunctionTile
    })
    const selectRed = findElement(strip, element => (
      element.props['aria-label'] === '选择中，然后选择一座激活棋子附着'
    ))
    selectRed?.props.onClick?.()

    expect(selectFunctionTile).toHaveBeenCalledOnce()
    expect(selectFunctionTile).toHaveBeenCalledWith('red')
  })

  it('keeps target actions enabled in ready before the wave starts', () => {
    const markup = renderToStaticMarkup(
      <BuildPanel
        wood={0}
        gold={50}
        placedCount={3}
        gameStatus="ready"
        roundTiles={[]}
        heldTileSuit={null}
        functionTiles={['red', 'white']}
        canGambleForHonor={false}
        lastHonorGamble={null}
        onSelectFunctionTile={vi.fn()}
      />
    )

    expect(markup).toContain('功能牌区')
    expect(markup).toContain('选择中，然后选择一座激活棋子附着')
    expect(markup).toContain('白，只能在吃或碰的合成工作台中作为材料')

    const strip = FunctionTileStrip({
      tiles: ['red', 'white'],
      canAttach: true,
      onSelect: vi.fn()
    })
    const selectRed = findElement(strip, element => (
      element.props['aria-label'] === '选择中，然后选择一座激活棋子附着'
    ))
    expect(selectRed?.props.disabled).toBe(false)
  })
})
