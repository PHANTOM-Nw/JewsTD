/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ECONOMY_CONFIG } from '../config/economy'
import { BuildPanel, GamePhaseHint } from './BuildPanel'
import { CombatSpeedControl, GameUI } from './GameUI'

vi.mock('../services/audio', () => ({
  soundManager: { setEnabled: vi.fn() }
}))

function getCssRule(styles: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = Array.from(
    styles.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'g'))
  )

  expect(matches.length).toBeGreaterThan(0)
  return matches.map(match => match[1]).join('\n')
}

describe('mobile game layout', () => {
  it('renders the five resource cards from the selected mobile concept', () => {
    const markup = renderToStaticMarkup(
      <GameUI
        uiState={{
          wood: 3,
          gold: 50,
          mineHealth: 15,
          maxMineHealth: 15,
          wave: 0,
          gameStatus: 'building',
          canPlaceTowers: true,
          gameLevel: 1,
          mahjongPoolCount: 103,
          roundTiles: [],
          heldTileSuit: null,
          functionTiles: [],
          honorDrawScheduled: false,
          lastHonorDraw: null
        }}
        combatSpeed={1}
        onCycleCombatSpeed={vi.fn()}
        onResetGame={vi.fn()}
        phaseHint={(
          <GamePhaseHint
            placedCount={1}
            gameStatus="building"
            honorDrawScheduled={false}
          />
        )}
        fullscreen={{
          isSupported: true,
          isFullscreen: false,
          onToggle: vi.fn()
        }}
      />
    )

    expect(markup.match(/class="game-ui__resource /g)).toHaveLength(5)
    expect(markup).toContain('建造')
    expect(markup).toContain('矿坑生命')
    expect(markup).toContain('波次')
    expect(markup).toContain('牌池')
    expect(markup).toContain('103')
    expect(markup).not.toContain('🎮')
    expect(markup).toContain('aria-label="麻将 TD 游戏资源与快捷操作"')
    expect(markup).not.toContain('game-title')
    expect(markup).not.toContain('<h1')
    expect(markup).toContain('game-header')
    expect(markup).toContain('game-phase-hint')
    expect(markup.indexOf('game-phase-hint')).toBeLessThan(markup.indexOf('game-ui__utilities'))
    expect(markup).toContain('aria-label="进入全屏"')
    expect(markup).toContain('当前战斗速度 1 倍，点击切换到 1.5 倍')
    expect(markup).toContain('1×')
    expect(markup).toContain('aria-label="重新开始"')
    expect(markup).toMatch(/aria-label="(关闭音效|开启音效)"/)
  })

  it('derives the three-build action deck from the economy config', () => {
    const markup = renderToStaticMarkup(
      <BuildPanel
        placedCount={2}
        gameStatus="building"
        roundTiles={[]}
        heldTileSuit={null}
        functionTiles={[]}
        honorDrawScheduled={false}
        lastHonorDraw={null}
        currentWave={0}
      />
    )
    const gameStyles = readFileSync(new URL('./TowerDefenseGame.css', import.meta.url), 'utf8')

    expect(ECONOMY_CONFIG.towersPerRound).toBe(3)
    expect(markup).not.toContain('game-phase-hint')
    expect(markup).not.toContain('清牌墙')
    expect(gameStyles).toMatch(/width:\s*min\(100%,\s*430px\)/)
    expect(gameStyles).toMatch(/aspect-ratio:\s*4\s*\/\s*5/)
    expect(gameStyles).not.toMatch(/mahjong-board-access/)
    expect(gameStyles).toMatch(/\.game-header\s*\{/)
    expect(gameStyles).not.toMatch(/\.game-title\b/)
    expect(gameStyles).toMatch(/\.wave-complete-notice\s*\{[^}]*position:\s*absolute/s)
    expect(gameStyles).toMatch(/\.mahjong-action-message--global\s*\{[^}]*position:\s*absolute/s)
    expect(gameStyles).toMatch(/\.action-deck__primary\s*\{[^}]*min-height:\s*48px/s)
    expect(gameStyles).toMatch(/\.action-deck__primary\s*\{[^}]*font-size:\s*clamp\(16px,\s*4\.5vw,\s*19px\)/s)
    expect(gameStyles).toMatch(/\.action-deck__primary--action:not\(:disabled\):active\s*\{/)
    expect(gameStyles).toMatch(/\.game-phase-hint\s*\{[^}]*flex:\s*1 1 auto/s)
    expect(gameStyles).not.toMatch(/\.game-phase-hint\s*\{[^}]*position:\s*absolute/s)
    expect(gameStyles).toMatch(/\.game-shell:fullscreen\s*\{[^}]*height:\s*100dvh/s)
    expect(gameStyles).toMatch(/\.game-shell:fullscreen\s*\{[^}]*env\(safe-area-inset-top\)/s)
    expect(gameStyles).toMatch(/@media \(max-width:\s*699px\)\s*\{[^}]*\.game-ui__fullscreen\s*\{\s*display:\s*grid/s)
    expect(gameStyles).not.toMatch(/\.action-deck__phase/)
    expect(gameStyles).not.toMatch(/\.action-deck__primary--status/)
    expect(gameStyles).not.toMatch(/\.action-deck__primary:not\(\.action-deck__primary--status\)/)
    expect(gameStyles).toMatch(/\.board-cell-highlight\s*\{[^}]*position:\s*absolute/s)
    expect(gameStyles).toMatch(/\.tower-decision-restore\s*\{[^}]*position:\s*absolute/s)
    expect(gameStyles).toMatch(/\.game-ui__speed\s*\{[^}]*flex:\s*0 0 44px/s)
    expect(gameStyles).toMatch(/@media \(max-width:\s*380px\)[\s\S]*?\.game-header\s*\{\s*gap:\s*4px/)
  })

  it('keeps the shared inventory row compact and horizontally scrollable', () => {
    const gameStyles = readFileSync(new URL('./TowerDefenseGame.css', import.meta.url), 'utf8')
    const inventoryRule = getCssRule(gameStyles, '.mahjong-inventory-row')
    const functionListRule = getCssRule(gameStyles, '.mahjong-functions > div')
    const compactTileRule = getCssRule(
      gameStyles,
      '.mahjong-inventory-row .mahjong-tile--compact'
    )
    const functionButtonRule = getCssRule(gameStyles, '.mahjong-function-tile')
    const buttonHeight = functionButtonRule.match(/min-height:\s*(\d+)px/)
    const narrowMediaStart = gameStyles.indexOf('@media (max-width: 380px)')

    expect(inventoryRule).toMatch(/display:\s*grid/)
    expect(inventoryRule).toMatch(/min-width:\s*0/)
    expect(inventoryRule).toMatch(/grid-template-columns:\s*\d+px\s+minmax\(0,\s*1fr\)/)
    expect(functionListRule).toMatch(/flex-wrap:\s*nowrap/)
    expect(functionListRule).toMatch(/overflow-x:\s*auto/)
    expect(compactTileRule).toMatch(/width:\s*28px/)
    expect(compactTileRule).toMatch(/height:\s*38px/)
    expect(buttonHeight).not.toBeNull()
    expect(Number(buttonHeight?.[1])).toBeGreaterThanOrEqual(44)
    expect(narrowMediaStart).toBeGreaterThanOrEqual(0)

    const narrowStyles = gameStyles.slice(narrowMediaStart)
    const narrowCompactTileRule = getCssRule(
      narrowStyles,
      '.mahjong-inventory-row .mahjong-tile--compact'
    )

    expect(narrowCompactTileRule).toMatch(/width:\s*26px/)
    expect(narrowCompactTileRule).toMatch(/height:\s*36px/)
  })

  it('hides an unsupported fullscreen action and labels the active state as exit', () => {
    const uiState = {
      wood: 3,
      gold: 50,
      mineHealth: 15,
      maxMineHealth: 15,
      wave: 0,
      gameStatus: 'building' as const,
      canPlaceTowers: true,
      gameLevel: 1,
      mahjongPoolCount: 103,
      roundTiles: [],
      heldTileSuit: null,
      functionTiles: [],
      honorDrawScheduled: false,
      lastHonorDraw: null
    }
    const unsupportedMarkup = renderToStaticMarkup(
      <GameUI
        uiState={uiState}
        combatSpeed={1}
        onCycleCombatSpeed={vi.fn()}
        onResetGame={vi.fn()}
        fullscreen={{ isSupported: false, isFullscreen: false, onToggle: vi.fn() }}
      />
    )
    const activeMarkup = renderToStaticMarkup(
      <GameUI
        uiState={uiState}
        combatSpeed={3}
        onCycleCombatSpeed={vi.fn()}
        onResetGame={vi.fn()}
        fullscreen={{ isSupported: true, isFullscreen: true, onToggle: vi.fn() }}
      />
    )

    expect(unsupportedMarkup).not.toContain('game-ui__fullscreen')
    expect(activeMarkup).toContain('aria-label="退出全屏"')
    expect(activeMarkup).toContain('当前战斗速度 3 倍，点击切换到 1 倍')
  })

  it('cycles combat speed through the engine-owned action', () => {
    const cycleCombatSpeed = vi.fn()
    const control = CombatSpeedControl({
      combatSpeed: 1.5,
      onCycle: cycleCombatSpeed
    })
    const markup = renderToStaticMarkup(control)

    expect(markup).toContain('当前战斗速度 1.5 倍，点击切换到 3 倍')
    expect(markup).toContain('1.5×')

    control.props.onClick()
    expect(cycleCombatSpeed).toHaveBeenCalledOnce()
  })
})
