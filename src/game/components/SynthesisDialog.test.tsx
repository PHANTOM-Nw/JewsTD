import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { GemType, Tower } from '../types/game'
import { SynthesisDialog } from './SynthesisDialog'

function createTower(id: string, gemType: GemType, col: number): Tower {
  return {
    id,
    gemType,
    level: 'chipped',
    gridPosition: { row: 1, col },
    position: { x: col * 40 + 20, y: 60 },
    damage: 10,
    range: 100,
    attackSpeed: 1000,
    lastAttackTime: 0,
    damageType: 'physical'
  }
}

const storedTowers = [
  createTower('diamond-1', 'diamond', 1),
  createTower('diamond-2', 'diamond', 2),
  createTower('topaz-1', 'topaz', 3)
]

describe('SynthesisDialog', () => {
  it('shows available recipes without synthesis actions during combat', () => {
    const markup = renderToStaticMarkup(
      <SynthesisDialog
        storedTowers={storedTowers}
        canSynthesize={false}
        onSynthesize={vi.fn(() => true)}
        onSynthesizeSpecial={vi.fn(() => true)}
        onClose={vi.fn()}
      />
    )

    expect(markup).toContain('当前仅可查看合成列表')
    expect(markup).toContain('可合成的塔对 (1)')
    expect(markup).toContain('材料已集齐')
    expect(markup).not.toContain('合成银塔')
    expect(markup).not.toContain('确认合成')
  })

  it('shows synthesis actions during preparation', () => {
    const markup = renderToStaticMarkup(
      <SynthesisDialog
        storedTowers={storedTowers}
        canSynthesize
        onSynthesize={vi.fn(() => true)}
        onSynthesizeSpecial={vi.fn(() => true)}
        onClose={vi.fn()}
      />
    )

    expect(markup).not.toContain('当前仅可查看合成列表')
    expect(markup).toContain('合成银塔')
  })
})
