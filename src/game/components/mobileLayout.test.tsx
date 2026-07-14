/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ECONOMY_CONFIG } from '../config/economy'
import { BuildPanel } from './BuildPanel'
import { GameUI } from './GameUI'

vi.mock('../services/audio', () => ({
  soundManager: { setEnabled: vi.fn() }
}))

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
          selectedGem: null,
          canPlaceTowers: true,
          gameLevel: 1
        }}
        onUpgradeGameLevel={vi.fn()}
        onResetGame={vi.fn()}
      />
    )

    expect(markup.match(/class="game-ui__resource /g)).toHaveLength(5)
    expect(markup).toContain('剩余建造')
    expect(markup).toContain('矿坑生命')
    expect(markup).toContain('波次')
    expect(markup).toContain('Lv.1')
    expect(markup).not.toContain('🎮')
  })

  it('derives the three-build action deck from the economy config', () => {
    const markup = renderToStaticMarkup(
      <BuildPanel
        wood={1}
        gold={20}
        placedCount={2}
        gameStatus="building"
        currentWave={0}
      />
    )
    const gameStyles = readFileSync(new URL('./TowerDefenseGame.css', import.meta.url), 'utf8')

    expect(ECONOMY_CONFIG.towersPerRound).toBe(3)
    expect(markup).toContain('建造 2/3')
    expect(markup).toContain('再放 1 座塔')
    expect(markup).toContain('松开后建塔')
    expect(markup).toContain('剩余建造 1 次')
    expect(markup).toContain(`清障 ${ECONOMY_CONFIG.obstacleRemovalGoldCost}`)
    expect(gameStyles).toMatch(/width:\s*min\(100%,\s*430px\)/)
    expect(gameStyles).toMatch(/aspect-ratio:\s*4\s*\/\s*5/)
  })
})
