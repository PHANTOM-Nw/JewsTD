import { describe, expect, it, vi } from 'vitest'
import {
  MAHJONG_BAMBOO_LAYOUTS,
  MAHJONG_DOT_LAYOUTS
} from '../config/mahjong'
import { initializeGrid } from '../config/map'
import type { MahjongNumberTile, Tower } from '../types/game'
import {
  BASE_TOWER_SPRITES,
  GATE_SPRITES,
  OBSTACLE_SPRITES,
  TILE_SPRITE,
  getObstacleSpriteUrl
} from './spriteRegistry'
import { renderGameScene } from './canvasRenderer'

function createCanvasContext() {
  const spies = {
    arc: vi.fn(),
    fillText: vi.fn(),
    roundRect: vi.fn()
  }
  const ctx = {
    arc: spies.arc,
    beginPath: vi.fn(),
    bezierCurveTo: vi.fn(),
    clearRect: vi.fn(),
    closePath: vi.fn(),
    drawImage: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: spies.fillText,
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    restore: vi.fn(),
    rotate: vi.fn(),
    roundRect: spies.roundRect,
    save: vi.fn(),
    scale: vi.fn(),
    setLineDash: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    translate: vi.fn()
  } as unknown as CanvasRenderingContext2D
  return { ctx, spies }
}

function createMahjongTower(
  id: string,
  tile: MahjongNumberTile,
  x: number,
  y: number
): Tower {
  return {
    id,
    gemType: 'ruby',
    mahjongTile: tile,
    level: 'normal',
    gridPosition: { row: Math.floor(y / 40), col: Math.floor(x / 40) },
    position: { x, y },
    damage: 24,
    range: 125,
    attackSpeed: 900,
    lastAttackTime: 0,
    damageType: 'physical'
  }
}

describe('canvas placement preview', () => {
  it('renders its hidden tile back without resolving tower or obstacle sprites', () => {
    const resolveImage = vi.fn<(url: string) => CanvasImageSource | null>(() => null)
    const { ctx, spies } = createCanvasContext()

    renderGameScene(
      ctx,
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
    expect(spies.roundRect.mock.calls).toContainEqual([
      expect.any(Number),
      expect.any(Number),
      26 * 40 / 54,
      26,
      3
    ])
  })
})

describe('canvas mahjong rendering', () => {
  it('draws the standard concentric one-dot face', () => {
    const resolveImage = vi.fn<(url: string) => CanvasImageSource | null>(() => null)
    const { ctx, spies } = createCanvasContext()

    renderGameScene(
      ctx,
      {
        grid: initializeGrid(),
        currentPath: null,
        placementPreview: null,
        enemies: [],
        towers: [createMahjongTower(
          'one-dot-tower',
          { id: 'dots-1-1', suit: 'dots', rank: 1, copy: 1 },
          60,
          20
        )],
        bullets: [],
        damageNumbers: [],
        gameTime: 0
      },
      { resolveImage }
    )

    expect(spies.arc.mock.calls.map(([, , radius]) => radius).slice(-4)).toEqual([
      8.4,
      6.1,
      3.8,
      1.4
    ])
  })

  it('draws dot and bamboo mark counts from the shared tile layouts', () => {
    const resolveImage = vi.fn<(url: string) => CanvasImageSource | null>(() => null)
    const { ctx, spies } = createCanvasContext()
    const dotRank = 9
    const bambooRank = 8

    renderGameScene(
      ctx,
      {
        grid: initializeGrid(),
        currentPath: null,
        placementPreview: null,
        enemies: [],
        towers: [
          createMahjongTower(
            'dot-tower',
            { id: 'dots-9-1', suit: 'dots', rank: dotRank, copy: 1 },
            60,
            20
          ),
          createMahjongTower(
            'bamboo-tower',
            { id: 'bamboo-8-1', suit: 'bamboo', rank: bambooRank, copy: 1 },
            100,
            20
          )
        ],
        bullets: [],
        damageNumbers: [],
        gameTime: 0
      },
      { resolveImage }
    )

    const dotOuterMarks = spies.arc.mock.calls.filter(([, , radius]) => radius === 2.6)
    const bambooMarks = spies.roundRect.mock.calls.filter(([, , width]) => width === 3.6)
    expect(dotOuterMarks).toHaveLength(MAHJONG_DOT_LAYOUTS[dotRank].length)
    expect(bambooMarks).toHaveLength(MAHJONG_BAMBOO_LAYOUTS[bambooRank].length)
  })

  it('does not resolve a gem sprite when a tower has an exact mahjong tile', () => {
    const resolveImage = vi.fn<(url: string) => CanvasImageSource | null>(() => null)
    const { ctx } = createCanvasContext()

    renderGameScene(
      ctx,
      {
        grid: initializeGrid(),
        currentPath: null,
        placementPreview: null,
        enemies: [],
        towers: [createMahjongTower(
          'mahjong-tower',
          { id: 'characters-5-1', suit: 'characters', rank: 5, copy: 1 },
          60,
          20
        )],
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
    expect(resolvedUrls).not.toContain(BASE_TOWER_SPRITES.ruby)
  })

  it('draws an exact face on a mahjong wall without resolving an obstacle sprite', () => {
    const resolveImage = vi.fn<(url: string) => CanvasImageSource | null>(() => null)
    const { ctx, spies } = createCanvasContext()
    const grid = initializeGrid()
    grid[0][2] = {
      row: 0,
      col: 2,
      type: 'obstacle',
      mahjongTile: {
        id: 'characters-9-1',
        suit: 'characters',
        rank: 9,
        copy: 1
      }
    }

    renderGameScene(
      ctx,
      {
        grid,
        currentPath: null,
        placementPreview: null,
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
    expect(spies.fillText.mock.calls.map(([text]) => text)).toEqual(['九', '萬'])
    expect(spies.roundRect.mock.calls.filter(([, , width]) => width === 18)).toHaveLength(2)
  })

  it('keeps legacy gem towers and obstacles on the sprite fallback path', () => {
    const resolveImage = vi.fn<(url: string) => CanvasImageSource | null>(() => null)
    const { ctx } = createCanvasContext()
    const grid = initializeGrid()
    grid[0][2] = { row: 0, col: 2, type: 'obstacle' }
    const legacyTower = createMahjongTower(
      'legacy-tower',
      { id: 'dots-1-1', suit: 'dots', rank: 1, copy: 1 },
      60,
      20
    )
    delete legacyTower.mahjongTile

    renderGameScene(
      ctx,
      {
        grid,
        currentPath: null,
        placementPreview: null,
        enemies: [],
        towers: [legacyTower],
        bullets: [],
        damageNumbers: [],
        gameTime: 0
      },
      { resolveImage }
    )

    expect(resolveImage.mock.calls.map(([url]) => url)).toEqual([
      TILE_SPRITE,
      GATE_SPRITES.entrance,
      GATE_SPRITES.exit,
      getObstacleSpriteUrl(0, 2),
      BASE_TOWER_SPRITES.ruby
    ])
  })
})
