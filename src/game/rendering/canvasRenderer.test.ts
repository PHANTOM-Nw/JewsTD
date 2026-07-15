import { describe, expect, it, vi } from 'vitest'
import { initializeGrid } from '../config/map'
import {
  BASE_TOWER_SPRITES,
  GATE_SPRITES,
  OBSTACLE_SPRITES,
  TILE_SPRITE
} from './spriteRegistry'
import { renderGameScene } from './canvasRenderer'

function createCanvasContext(): CanvasRenderingContext2D {
  return {
    arc: vi.fn(),
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    restore: vi.fn(),
    roundRect: vi.fn(),
    save: vi.fn(),
    setLineDash: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    translate: vi.fn()
  } as unknown as CanvasRenderingContext2D
}

describe('canvas placement preview', () => {
  it('renders its neutral marker without resolving tower or obstacle sprites', () => {
    const resolveImage = vi.fn<(url: string) => CanvasImageSource | null>(() => null)

    renderGameScene(
      createCanvasContext(),
      {
        grid: initializeGrid(),
        currentPath: null,
        placementPreview: {
          position: { row: 0, col: 2 },
          path: null,
          status: 'valid'
        },
        enemies: [],
        towers: [],
        bullets: [],
        damageNumbers: [],
        gameTime: 0
      },
      { resolveImage }
    )

    const resolvedUrls = resolveImage.mock.calls.map(([url]) => url)
    expect(resolvedUrls).toEqual([
      TILE_SPRITE,
      GATE_SPRITES.entrance,
      GATE_SPRITES.exit
    ])
    const identitySprites = new Set([
      ...Object.values(BASE_TOWER_SPRITES),
      ...OBSTACLE_SPRITES
    ])
    expect(resolvedUrls.filter(url => identitySprites.has(url))).toEqual([])
  })
})
