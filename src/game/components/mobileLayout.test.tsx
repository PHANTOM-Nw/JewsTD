/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { BuildPanel } from './BuildPanel'
import { GameUI } from './GameUI'

vi.mock('../services/audio', () => ({
  soundManager: { setEnabled: vi.fn() }
}))

describe('mobile game layout', () => {
  it('provides six compact top-scoreboard cells', () => {
    const markup = renderToStaticMarkup(
      <GameUI
        uiState={{
          wood: 5,
          gold: 50,
          mineHealth: 15,
          maxMineHealth: 15,
          wave: 0,
          gameStatus: 'building',
          selectedGem: null,
          canPlaceTowers: true,
          gameLevel: 1
        }}
        onStartWave={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onUpgradeGameLevel={vi.fn()}
        onResetGame={vi.fn()}
      />
    )

    expect(markup.match(/class="game-ui__resource"/g)).toHaveLength(2)
    expect(markup.match(/class="game-ui__stat"/g)).toHaveLength(2)
    expect(markup).toContain('class="game-ui__level"')
    expect(markup).toContain('class="game-ui__upgrade"')
  })

  it('groups the secondary resource scoreboard so mobile CSS can remove it', () => {
    const markup = renderToStaticMarkup(
      <BuildPanel wood={3} gold={20} placedCount={2} gameStatus="building" />
    )
    const gameStyles = readFileSync(new URL('./TowerDefenseGame.css', import.meta.url), 'utf8')
    const mobileRules = gameStyles.slice(
      gameStyles.indexOf('@media (max-width: 760px)'),
      gameStyles.indexOf('@media (max-width: 380px)')
    )

    expect(markup).toContain('class="build-panel__scoreboard"')
    expect(markup).toContain('剩余木材')
    expect(mobileRules).toMatch(/\.build-panel__scoreboard\s*{\s*display:\s*none;/)
  })
})
