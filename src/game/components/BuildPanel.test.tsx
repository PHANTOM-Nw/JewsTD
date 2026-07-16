import { Children, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { GameStatus, MahjongRoundTileView } from '../types/game'
import { BuildPanel, FunctionTileStrip, GamePhaseHint } from './BuildPanel'

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

// 进入 resolving_hand 后所有剩余牌的花色都已公开，点数永远保密。
const gambleTiles: MahjongRoundTileView[] = [
  {
    id: 'characters-2-1',
    source: 'hand',
    visibility: 'suit',
    suit: 'characters'
  },
  {
    id: 'bamboo-5-1',
    source: 'draw',
    visibility: 'suit',
    suit: 'bamboo'
  },
  {
    id: 'dots-8-1',
    source: 'draw',
    visibility: 'suit',
    suit: 'dots'
  }
]

const twoMatchingGambleTiles: MahjongRoundTileView[] = [
  gambleTiles[0],
  {
    id: 'two-matching-draw',
    source: 'draw',
    visibility: 'suit',
    suit: 'characters'
  },
  gambleTiles[2]
]

const keepOnlyTiles: MahjongRoundTileView[] = [
  gambleTiles[1],
  gambleTiles[2]
]

function renderHandPanel({
  roundTiles,
  canGambleForHonor,
  honorGambleChance,
  onKeepHand,
  onGambleForHonor
}: {
  roundTiles: MahjongRoundTileView[]
  canGambleForHonor: boolean
  honorGambleChance: number | null
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
    honorGambleChance,
    lastHonorGamble: null,
    onKeepHand,
    onGambleForHonor
  })
}

describe('BuildPanel hand resolution choice', () => {
  it('reveals every remaining suit while hiding ranks and offers the gamble by composition', () => {
    const keepHand = vi.fn()
    const gamble = vi.fn()
    const panel = renderHandPanel({
      roundTiles: gambleTiles,
      canGambleForHonor: true,
      honorGambleChance: .5,
      onKeepHand: keepHand,
      onGambleForHonor: gamble
    })
    const markup = renderToStaticMarkup(panel)

    expect(markup).toContain('选择下一回合手牌')
    expect(markup).toContain('万 · 点数未知')
    expect(markup).toContain('条 · 点数未知')
    expect(markup).toContain('筒 · 点数未知')
    expect(markup).toContain('赌中發白（成功率 50%）')
    expect(markup.match(/新牌/g)).toHaveLength(2)
    expect(markup).toContain('旧手牌')
    // 点数信息边界：没有任何正面牌，点数永远只以「未知」呈现。
    expect(markup).not.toContain('mahjong-tile--face')

    const keepBamboo = findElement(panel, element => (
      element.props['aria-label'] === '保留条花色手牌，点数未知'
    ))
    keepBamboo?.props.onClick?.()

    expect(keepHand).toHaveBeenCalledOnce()
    expect(keepHand).toHaveBeenCalledWith('bamboo-5-1')

    const gambleButton = findElement(panel, element => (
      element.props.className === 'mahjong-gamble'
    ))
    gambleButton?.props.onClick?.()

    expect(gamble).toHaveBeenCalledOnce()
  })

  it('shows the raised success rate for a two-matching composition', () => {
    const panel = renderHandPanel({
      roundTiles: twoMatchingGambleTiles,
      canGambleForHonor: true,
      honorGambleChance: .75,
      onGambleForHonor: vi.fn()
    })
    const markup = renderToStaticMarkup(panel)

    expect(markup).toContain('赌中發白（成功率 75%）')
    expect(markup).toContain('三张全部回池；成功等概率获得中／發／白之一')
  })

  it('drops the gamble when only two fresh tiles remain and still keeps ranks hidden', () => {
    const keepHand = vi.fn()
    const gamble = vi.fn()
    const panel = renderHandPanel({
      roundTiles: keepOnlyTiles,
      canGambleForHonor: false,
      honorGambleChance: null,
      onKeepHand: keepHand,
      onGambleForHonor: gamble
    })
    const markup = renderToStaticMarkup(panel)

    expect(markup).toContain('选择下一回合手牌')
    expect(markup).toContain('条 · 点数未知')
    expect(markup).toContain('筒 · 点数未知')
    expect(markup).not.toContain('赌中發白')
    expect(markup).not.toContain('mahjong-tile--face')

    const gambleButton = findElement(panel, element => (
      element.props.className === 'mahjong-gamble'
    ))
    expect(gambleButton).toBeNull()

    const keepDots = findElement(panel, element => (
      element.props['aria-label'] === '保留筒花色手牌，点数未知'
    ))
    keepDots?.props.onClick?.()

    expect(keepHand).toHaveBeenCalledOnce()
    expect(keepHand).toHaveBeenCalledWith('dots-8-1')
    expect(gamble).not.toHaveBeenCalled()
  })
})

describe('BuildPanel function tile actions', () => {
  it('offers accessible red and green target actions and a clickable white detail entry', () => {
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
      honorGambleChance: null,
      lastHonorGamble: null,
      onSelectFunctionTile: selectFunctionTile
    })
    const markup = renderToStaticMarkup(panel)

    expect(markup).toContain('功能牌区')
    expect(markup).toContain('选择中，然后选择一座激活棋子附着')
    expect(markup).toContain('选择發，然后选择一座激活棋子附着')
    expect(markup).toContain('查看白板的合成催化说明')

    const strip = FunctionTileStrip({
      tiles: ['red', 'green', 'white'],
      onSelect: selectFunctionTile
    })
    const selectRed = findElement(strip, element => (
      element.props['aria-label'] === '选择中，然后选择一座激活棋子附着'
    ))
    selectRed?.props.onClick?.()

    expect(selectFunctionTile).toHaveBeenCalledWith('red')

    const selectWhite = findElement(strip, element => (
      element.props['aria-label'] === '查看白板的合成催化说明'
    ))
    selectWhite?.props.onClick?.()

    expect(selectFunctionTile).toHaveBeenCalledWith('white')
    expect(selectFunctionTile).toHaveBeenCalledTimes(2)
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
        honorGambleChance={null}
        lastHonorGamble={null}
        onSelectFunctionTile={vi.fn()}
      />
    )

    expect(markup).toContain('功能牌区')
    expect(markup).toContain('选择中，然后选择一座激活棋子附着')
    expect(markup).toContain('查看白板的合成催化说明')

    const strip = FunctionTileStrip({
      tiles: ['red', 'white'],
      onSelect: vi.fn()
    })
    const selectRed = findElement(strip, element => (
      element.props['aria-label'] === '选择中，然后选择一座激活棋子附着'
    ))
    expect(selectRed?.props.disabled).toBe(false)
  })
})

describe('BuildPanel primary action by phase', () => {
  const renderPhase = (gameStatus: GameStatus) => renderToStaticMarkup(
    <BuildPanel
      wood={0}
      gold={50}
      placedCount={3}
      gameStatus={gameStatus}
      roundTiles={[]}
      heldTileSuit={null}
      functionTiles={[]}
      canGambleForHonor={false}
      honorGambleChance={null}
      lastHonorGamble={null}
      currentWave={0}
      onStartWave={vi.fn()}
      onPause={vi.fn()}
      onResume={vi.fn()}
      onReset={vi.fn()}
    />
  )

  it('does not render a false primary action while tiles are being placed', () => {
    expect(renderPhase('building')).not.toContain('action-deck__primary')
  })

  it.each(['building', 'deciding', 'resolving_hand'] as const)(
    'leaves %s guidance to the board-top hint instead of taking deck space', gameStatus => {
    const markup = renderPhase(gameStatus)

    expect(markup).not.toContain('action-deck__primary')
    expect(markup).not.toContain('game-phase-hint')
  })

  it.each([
    ['ready', '开始第 1 波'],
    ['playing', '暂停'],
    ['paused', '继续'],
    ['game_over', '重新开始'],
    ['victory', '再玩一局']
  ] as const)('renders %s with the shared compact action style', (gameStatus, label) => {
    const markup = renderPhase(gameStatus)

    expect(markup).toContain('action-deck__primary action-deck__primary--action')
    expect(markup).toContain(label)
  })

  it('places the first-wave action before auxiliary rows', () => {
    const markup = renderPhase('ready')

    expect(markup.indexOf('action-deck__primary--action'))
      .toBeLessThan(markup.indexOf('mahjong-functions'))
  })
})

describe('GamePhaseHint compact copy', () => {
  const renderHint = (
    gameStatus: GameStatus,
    canGambleForHonor = false
  ) => renderToStaticMarkup(
    <GamePhaseHint
      placedCount={2}
      gameStatus={gameStatus}
      canGambleForHonor={canGambleForHonor}
    />
  )

  it.each([
    ['building', '建造 2/3', '拖牌到地图，落地即翻开'],
    ['deciding', '三选一', '激活 1 张，其余 2 张变牌墙'],
    ['ready', '备战完成', '可整备，或开始下一波'],
    ['playing', '战斗中', '棋子正在自动攻击'],
    ['paused', '已暂停', '检查路线后继续'],
    ['game_over', '矿坑失守', '调整落牌和留牌策略再来'],
    ['victory', '胜利', '全部波次完成']
  ] as const)('renders concise %s guidance', (gameStatus, eyebrow, detail) => {
    const markup = renderHint(gameStatus)

    expect(markup).toContain(`game-phase-hint--${gameStatus}`)
    expect(markup).toContain(eyebrow)
    expect(markup).toContain(detail)
    expect(markup).toContain('aria-live="polite"')
  })

  it('keeps hand ranks private in both hand-resolution variants', () => {
    const keepMarkup = renderHint('resolving_hand')
    const gambleMarkup = renderHint('resolving_hand', true)

    expect(keepMarkup).toContain('看花色留 1 张，点数仍保密')
    expect(gambleMarkup).toContain('点数保密：留 1 张或三张赌功能牌')
    expect(`${keepMarkup}${gambleMarkup}`).not.toMatch(/[一二三四五六七八九][万条筒]/)
  })
})
