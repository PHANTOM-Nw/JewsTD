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

function getDirectElements(node: ReactNode): ReactElement<ElementProps>[] {
  return Children.toArray(node).filter(isValidElement) as ReactElement<ElementProps>[]
}

function hasClass(element: ReactElement<ElementProps>, className: string) {
  return element.props.className?.split(/\s+/).includes(className) ?? false
}

// 进入 resolving_hand 后所有剩余牌的花色都已公开，点数永远保密。
const handTiles: MahjongRoundTileView[] = [
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

const keepOnlyTiles: MahjongRoundTileView[] = [
  handTiles[1],
  handTiles[2]
]

function renderHandPanel({
  roundTiles,
  honorDrawScheduled,
  onKeepHand
}: {
  roundTiles: MahjongRoundTileView[]
  honorDrawScheduled: boolean
  onKeepHand?: (tileId: string) => void
}) {
  return BuildPanel({
    placedCount: 3,
    gameStatus: 'resolving_hand',
    roundTiles,
    heldTileSuit: null,
    functionTiles: [],
    honorDrawScheduled,
    lastHonorDraw: null,
    onKeepHand
  })
}

describe('BuildPanel hand resolution and scheduled honor draw', () => {
  it('reveals every remaining suit, keeps ranks hidden and announces the independent draw', () => {
    const keepHand = vi.fn()
    const panel = renderHandPanel({
      roundTiles: handTiles,
      honorDrawScheduled: true,
      onKeepHand: keepHand
    })
    const markup = renderToStaticMarkup(panel)

    expect(markup).toContain('选择下一回合手牌')
    expect(markup).toContain('万 · 点数未知')
    expect(markup).toContain('条 · 点数未知')
    expect(markup).toContain('筒 · 点数未知')
    expect(markup).toContain('选定手牌后自动进行 50% 功能牌抽取')
    expect(markup).toContain('手牌不会被消耗')
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
    expect(markup).not.toContain('赌中發白')
    expect(markup).not.toContain('三张全部回池')
  })

  it('keeps ordinary hand resolution free of an honor draw notice on odd rounds', () => {
    const panel = renderHandPanel({
      roundTiles: keepOnlyTiles,
      honorDrawScheduled: false
    })
    const markup = renderToStaticMarkup(panel)

    expect(markup).toContain('选择下一回合手牌')
    expect(markup).not.toContain('功能牌抽取')
    expect(markup).not.toContain('赌')
  })

  it('keeps selection working when only two fresh tiles remain', () => {
    const keepHand = vi.fn()
    const panel = renderHandPanel({
      roundTiles: keepOnlyTiles,
      honorDrawScheduled: true,
      onKeepHand: keepHand
    })
    const markup = renderToStaticMarkup(panel)

    expect(markup).toContain('选择下一回合手牌')
    expect(markup).toContain('条 · 点数未知')
    expect(markup).toContain('筒 · 点数未知')
    expect(markup).not.toContain('赌中發白')
    expect(markup).not.toContain('mahjong-tile--face')

    const keepDots = findElement(panel, element => (
      element.props['aria-label'] === '保留筒花色手牌，点数未知'
    ))
    keepDots?.props.onClick?.()

    expect(keepHand).toHaveBeenCalledOnce()
    expect(keepHand).toHaveBeenCalledWith('dots-8-1')
  })

  it.each([
    ['success', '功能牌抽取成功，已获得一张中／發／白。'],
    ['failure', '功能牌抽取未中，本次没有获得功能牌。']
  ] as const)('shows the automatic draw %s result without gambling copy', (result, copy) => {
    const markup = renderToStaticMarkup(
      <BuildPanel
        placedCount={3}
        gameStatus="ready"
        roundTiles={[]}
        heldTileSuit="characters"
        functionTiles={result === 'success' ? ['red'] : []}
        honorDrawScheduled={false}
        lastHonorDraw={result}
      />
    )

    expect(markup).toContain(copy)
    expect(markup).toContain(`mahjong-honor-draw-result--${result}`)
    expect(markup).not.toContain('mahjong-gamble')
    expect(markup).not.toContain('赌博')
  })
})

describe('BuildPanel function tile actions', () => {
  it('offers accessible red and green target actions and a clickable white detail entry', () => {
    const selectFunctionTile = vi.fn()
    const panel = BuildPanel({
      placedCount: 0,
      gameStatus: 'building',
      roundTiles: [],
      heldTileSuit: null,
      functionTiles: ['red', 'green', 'white'],
      honorDrawScheduled: false,
      lastHonorDraw: null,
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
        placedCount={3}
        gameStatus="ready"
        roundTiles={[]}
        heldTileSuit={null}
        functionTiles={['red', 'white']}
        honorDrawScheduled={false}
        lastHonorDraw={null}
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

describe('BuildPanel inventory row', () => {
  it('groups the private held tile and a crowded function strip in one ready row', () => {
    const panel = BuildPanel({
      placedCount: 3,
      gameStatus: 'ready',
      roundTiles: [],
      heldTileSuit: 'dots',
      functionTiles: ['red', 'green', 'white', 'red', 'green', 'white'],
      honorDrawScheduled: false,
      lastHonorDraw: null,
      currentWave: 1,
      onSelectFunctionTile: vi.fn(),
      onStartWave: vi.fn()
    })
    const inventoryRow = findElement(panel, element => (
      hasClass(element, 'mahjong-inventory-row')
    ))
    const rowChildren = getDirectElements(inventoryRow?.props.children)
    const heldSummary = rowChildren.find(element => (
      hasClass(element, 'mahjong-held-summary')
    ))
    const markup = renderToStaticMarkup(panel)
    const heldMarkup = heldSummary ? renderToStaticMarkup(heldSummary) : ''

    expect(inventoryRow).not.toBeNull()
    expect(heldSummary).toBeDefined()
    expect(rowChildren.some(element => element.type === FunctionTileStrip)).toBe(true)
    expect(markup.match(/class="mahjong-function-tile(?:\s|")/g)).toHaveLength(6)
    expect(markup).toContain('aria-label="功能牌区"')
    expect(heldMarkup).toContain('mahjong-tile--back')
    expect(heldMarkup).toContain('mahjong-tile--known-suit')
    expect(heldMarkup).toContain('mahjong-tile--compact')
    expect(heldMarkup).not.toContain('mahjong-tile--face')
    expect(heldMarkup).not.toMatch(/[一二三四五六七八九][万条筒]/)
  })

  it('keeps a single relevant inventory block in building and playing phases', () => {
    const buildingPanel = BuildPanel({
      placedCount: 0,
      gameStatus: 'building',
      roundTiles: [],
      heldTileSuit: 'characters',
      functionTiles: ['red'],
      honorDrawScheduled: false,
      lastHonorDraw: null,
      onSelectFunctionTile: vi.fn()
    })
    const playingPanel = BuildPanel({
      placedCount: 3,
      gameStatus: 'playing',
      roundTiles: [],
      heldTileSuit: 'bamboo',
      functionTiles: ['green'],
      honorDrawScheduled: false,
      lastHonorDraw: null,
      onPause: vi.fn()
    })
    const buildingRow = findElement(buildingPanel, element => (
      hasClass(element, 'mahjong-inventory-row')
    ))
    const playingRow = findElement(playingPanel, element => (
      hasClass(element, 'mahjong-inventory-row')
    ))
    const buildingChildren = getDirectElements(buildingRow?.props.children)
    const playingChildren = getDirectElements(playingRow?.props.children)

    expect(buildingChildren).toHaveLength(1)
    expect(buildingChildren[0]?.type).toBe(FunctionTileStrip)
    expect(playingChildren).toHaveLength(1)
    expect(hasClass(playingChildren[0], 'mahjong-held-summary')).toBe(true)
    expect(renderToStaticMarkup(playingPanel)).not.toContain('aria-label="功能牌区"')
  })
})

describe('BuildPanel primary action by phase', () => {
  const renderPhase = (gameStatus: GameStatus) => renderToStaticMarkup(
    <BuildPanel
      placedCount={3}
      gameStatus={gameStatus}
      roundTiles={[]}
      heldTileSuit={null}
      functionTiles={[]}
      honorDrawScheduled={false}
      lastHonorDraw={null}
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
    honorDrawScheduled = false
  ) => renderToStaticMarkup(
    <GamePhaseHint
      placedCount={2}
      gameStatus={gameStatus}
      honorDrawScheduled={honorDrawScheduled}
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

  it('keeps hand ranks private while announcing the scheduled independent draw', () => {
    const keepMarkup = renderHint('resolving_hand')
    const drawMarkup = renderHint('resolving_hand', true)

    expect(keepMarkup).toContain('看花色留 1 张，点数仍保密')
    expect(drawMarkup).toContain('留牌后自动以 50% 概率抽取中／發／白')
    expect(drawMarkup).not.toContain('或赌')
    expect(`${keepMarkup}${drawMarkup}`).not.toMatch(/[一二三四五六七八九][万条筒]/)
  })
})
