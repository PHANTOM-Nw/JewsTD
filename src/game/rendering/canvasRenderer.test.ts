import { describe, expect, it, vi } from 'vitest'
import {
  MAHJONG_BAMBOO_LAYOUTS,
  MAHJONG_DOT_LAYOUTS
} from '../config/mahjong'
import { initializeGrid } from '../config/map'
import type {
  Bullet,
  Enemy,
  MahjongFormation,
  MahjongNumberTile,
  MahjongPresentationEvent,
  MahjongTowerState,
  Tower
} from '../types/game'
import {
  BASE_TOWER_SPRITES,
  GATE_SPRITES,
  OBSTACLE_SPRITES,
  TILE_SPRITE,
  getObstacleSpriteUrl
} from './spriteRegistry'
import {
  getBambooFocusSegmentCount,
  getMahjongFormationTileLayouts,
  getMahjongFormationStartPulseProgresses,
  getMahjongImpactPulseProgresses,
  getMahjongProjectilePresentations,
  renderGameScene
} from './canvasRenderer'

function createCanvasContext() {
  const spies = {
    arc: vi.fn(),
    bezierCurveTo: vi.fn(),
    fillText: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    rotate: vi.fn(),
    roundRect: vi.fn(),
    setLineDash: vi.fn(),
    strokeRect: vi.fn(),
    translate: vi.fn()
  }
  const ctx = {
    arc: spies.arc,
    beginPath: vi.fn(),
    bezierCurveTo: spies.bezierCurveTo,
    clearRect: vi.fn(),
    closePath: vi.fn(),
    drawImage: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: spies.fillText,
    lineTo: spies.lineTo,
    moveTo: spies.moveTo,
    restore: vi.fn(),
    rotate: spies.rotate,
    roundRect: spies.roundRect,
    save: vi.fn(),
    scale: vi.fn(),
    setLineDash: spies.setLineDash,
    stroke: vi.fn(),
    strokeRect: spies.strokeRect,
    translate: spies.translate
  } as unknown as CanvasRenderingContext2D
  return { ctx, spies }
}

function createMahjongState(
  formation: MahjongFormation,
  suit: MahjongNumberTile['suit'] = 'characters',
  attachments: MahjongTowerState['attachments'] = []
): MahjongTowerState {
  const ranks: Record<MahjongFormation, MahjongNumberTile['rank'][]> = {
    single: [5],
    pair: [5, 5],
    chow: [3, 4, 5],
    pung: [5, 5, 5],
    kong: [5, 5, 5, 5]
  }
  return {
    formation,
    suit,
    ranks: ranks[formation],
    containedTileIds: ['tile-1'],
    activeSources: [{
      tileId: 'tile-1',
      originalStats: {
        damage: 24,
        attackIntervalMs: 900,
        attackRange: 125
      }
    }],
    attachments
  }
}

function createMahjongBullet(
  overrides: Partial<Bullet> = {}
): Bullet {
  return {
    id: 'bullet-1',
    position: { x: 90, y: 80 },
    originPosition: { x: 50, y: 80 },
    attackRange: 125,
    targetId: 'enemy-1',
    damage: 24,
    damageType: 'physical',
    speed: 8,
    mahjongVisual: {
      suit: 'characters',
      formation: 'single',
      attachments: [],
      cycleId: 'cycle-1',
      projectileCount: 1
    },
    ...overrides
  }
}

function createEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 'enemy-1',
    spawnSequence: 1,
    type: 'basic',
    position: { x: 100, y: 100 },
    health: 80,
    maxHealth: 100,
    speed: 1,
    armor: 0,
    magicResist: 0,
    pathIndex: 0,
    progress: 0,
    reward: 1,
    mineDamage: 1,
    ...overrides
  }
}

function createMahjongPresentationEvent(
  overrides: Partial<MahjongPresentationEvent> = {}
): MahjongPresentationEvent {
  return {
    id: 'impact-1',
    position: { x: 100, y: 100 },
    suit: 'characters',
    formation: 'single',
    attachments: [],
    projectileCount: 1,
    startedAtGameTimeMs: 1000,
    elapsedMs: 0,
    durationMs: 560,
    executed: false,
    stunTriggered: false,
    ...overrides
  }
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

describe('mahjong formation tile layouts', () => {
  it('fans a chow in exact rank order with the middle tile raised', () => {
    const layouts = getMahjongFormationTileLayouts('chow', [3, 4, 5])

    expect(layouts.map(layout => layout.rank)).toEqual([3, 4, 5])
    expect(layouts.map(layout => layout.offsetX)).toEqual([-9, 0, 9])
    expect(layouts[0].rotationRadians).toBeLessThan(0)
    expect(layouts[1].rotationRadians).toBe(0)
    expect(layouts[2].rotationRadians).toBeGreaterThan(0)
    expect(layouts[1].offsetY).toBeLessThan(layouts[0].offsetY)
  })

  it('stacks a pung back-to-front with three visible depth offsets', () => {
    const layouts = getMahjongFormationTileLayouts('pung', [7, 7, 7])

    expect(layouts.map(layout => layout.rank)).toEqual([7, 7, 7])
    expect(layouts.map(({ offsetX, offsetY }) => [offsetX, offsetY])).toEqual([
      [-5, -4],
      [0, 0],
      [5, 4]
    ])
  })

  it('keeps pair and kong card counts visibly distinct', () => {
    const pair = getMahjongFormationTileLayouts('pair', [2, 2])
    const kong = getMahjongFormationTileLayouts('kong', [9, 9, 9, 9])

    expect(pair).toHaveLength(2)
    expect(new Set(pair.map(layout => layout.offsetX)).size).toBe(2)
    expect(kong).toHaveLength(4)
    expect(new Set(kong.map(layout => `${layout.offsetX},${layout.offsetY}`)).size).toBe(4)
  })
})

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

    const radii = spies.arc.mock.calls.map(([, , radius]) => radius)
    const faceStart = radii.indexOf(8.4)
    expect(radii.slice(faceStart, faceStart + 4)).toEqual([
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

  it('draws a distinct call signature for every mahjong formation', () => {
    const signatures = {
      single: { radius: 2, count: 1 },
      pair: { radius: 2, count: 2 },
      chow: { radius: 1.8, count: 3 },
      pung: { radius: 2.2, count: 3 }
    } as const

    for (const [formation, signature] of Object.entries(signatures)) {
      const { ctx, spies } = createCanvasContext()
      const tower = createMahjongTower(
        `${formation}-tower`,
        { id: `${formation}-tile`, suit: 'characters', rank: 5, copy: 1 },
        100,
        100
      )
      tower.mahjongState = createMahjongState(formation as MahjongFormation)

      renderGameScene(ctx, {
        grid: initializeGrid(),
        currentPath: null,
        placementPreview: null,
        enemies: [],
        towers: [tower],
        bullets: [],
        damageNumbers: [],
        gameTime: 420
      }, { resolveImage: () => null })

      expect(spies.arc.mock.calls.filter(([, , radius]) => (
        radius === signature.radius
      ))).toHaveLength(signature.count)
      expect(spies.fillText).toHaveBeenCalledTimes(signature.count * 2)
    }

    const { ctx, spies } = createCanvasContext()
    const kongTower = createMahjongTower(
      'kong-tower',
      { id: 'kong-tile', suit: 'characters', rank: 5, copy: 1 },
      100,
      100
    )
    kongTower.mahjongState = createMahjongState('kong')
    renderGameScene(ctx, {
      grid: initializeGrid(),
      currentPath: null,
      placementPreview: null,
      enemies: [],
      towers: [kongTower],
      bullets: [],
      damageNumbers: [],
      gameTime: 420
    }, { resolveImage: () => null })

    expect(spies.strokeRect.mock.calls.filter(([, , width, height]) => (
      width === 3 && height === 3
    ))).toHaveLength(4)
    expect(spies.fillText).toHaveBeenCalledTimes(8)
  })

  it('draws every chow face in a three-card fan', () => {
    const { ctx, spies } = createCanvasContext()
    const tower = createMahjongTower(
      'chow-faces',
      { id: 'chow-anchor', suit: 'characters', rank: 4, copy: 1 },
      100,
      100
    )
    tower.mahjongState = {
      ...createMahjongState('chow'),
      ranks: [3, 4, 5]
    }

    renderGameScene(ctx, {
      grid: initializeGrid(),
      currentPath: null,
      placementPreview: null,
      enemies: [],
      towers: [tower],
      bullets: [],
      damageNumbers: [],
      gameTime: 0
    }, { resolveImage: () => null })

    expect(spies.fillText.mock.calls.map(([text]) => text)).toEqual([
      '三', '萬', '四', '萬', '五', '萬'
    ])
    expect(spies.rotate.mock.calls).toContainEqual([-Math.PI / 15])
    expect(spies.rotate.mock.calls).toContainEqual([Math.PI / 15])
    expect(spies.translate.mock.calls).toEqual(expect.arrayContaining([
      [91, 102],
      [100, 99],
      [109, 102]
    ]))
  })

  it('draws a pung as three same-face cards with diagonal depth', () => {
    const { ctx, spies } = createCanvasContext()
    const tower = createMahjongTower(
      'pung-faces',
      { id: 'pung-anchor', suit: 'characters', rank: 7, copy: 1 },
      100,
      100
    )
    tower.mahjongState = {
      ...createMahjongState('pung'),
      ranks: [7, 7, 7]
    }

    renderGameScene(ctx, {
      grid: initializeGrid(),
      currentPath: null,
      placementPreview: null,
      enemies: [],
      towers: [tower],
      bullets: [],
      damageNumbers: [],
      gameTime: 0
    }, { resolveImage: () => null })

    expect(spies.fillText.mock.calls.map(([text]) => text)).toEqual([
      '七', '萬', '七', '萬', '七', '萬'
    ])
    expect(spies.translate.mock.calls).toEqual(expect.arrayContaining([
      [95, 96],
      [100, 100],
      [105, 104]
    ]))
  })

  it('layers suit core, red flame and green seal without hiding the tile face', () => {
    const { ctx, spies } = createCanvasContext()
    const tower = createMahjongTower(
      'attached-tower',
      { id: 'attached-tile', suit: 'characters', rank: 5, copy: 1 },
      100,
      100
    )
    tower.mahjongState = createMahjongState('chow', 'characters', ['red', 'green'])

    renderGameScene(ctx, {
      grid: initializeGrid(),
      currentPath: null,
      placementPreview: null,
      enemies: [],
      towers: [tower],
      bullets: [],
      damageNumbers: [],
      gameTime: 520
    }, { resolveImage: () => null })

    expect(spies.moveTo.mock.calls.some(([x, y]) => (
      x === 100 && y > 74 && y < 78
    ))).toBe(true)
    expect(spies.bezierCurveTo).toHaveBeenCalledTimes(6)
    expect(spies.strokeRect.mock.calls).toContainEqual([-22, -22, 44, 44])
    expect(spies.fillText.mock.calls.map(([text]) => text)).toEqual(
      expect.arrayContaining(['發', '五', '萬'])
    )
  })

  it('uses separate core geometry for characters, bamboo and dots towers', () => {
    const { ctx, spies } = createCanvasContext()
    const characters = createMahjongTower(
      'characters-tower',
      { id: 'characters-tile', suit: 'characters', rank: 5, copy: 1 },
      100,
      100
    )
    characters.mahjongState = createMahjongState('single', 'characters')
    const bamboo = createMahjongTower(
      'bamboo-tower',
      { id: 'bamboo-tile', suit: 'bamboo', rank: 5, copy: 1 },
      140,
      100
    )
    bamboo.mahjongState = createMahjongState('single', 'bamboo')
    const dots = createMahjongTower(
      'dots-tower',
      { id: 'dots-tile', suit: 'dots', rank: 5, copy: 1 },
      180,
      100
    )
    dots.mahjongState = createMahjongState('single', 'dots')

    renderGameScene(ctx, {
      grid: initializeGrid(),
      currentPath: null,
      placementPreview: null,
      enemies: [],
      towers: [characters, bamboo, dots],
      bullets: [],
      damageNumbers: [],
      gameTime: 0
    }, { resolveImage: () => null })

    expect(spies.moveTo.mock.calls).toContainEqual([100, 75.8])
    expect(spies.moveTo.mock.calls).toContainEqual([140, 74])
    expect(spies.arc.mock.calls).toContainEqual([
      180,
      80,
      2.2,
      0,
      Math.PI * 2
    ])
    expect(spies.arc.mock.calls).toContainEqual([
      180,
      80,
      4.7,
      0,
      Math.PI * 2
    ])
  })

  it('draws pure grey mahjong walls without resolving legacy obstacle sprites', () => {
    const resolveImage = vi.fn<(url: string) => CanvasImageSource | null>(() => null)
    const { ctx, spies } = createCanvasContext()
    const grid = initializeGrid()
    grid[0][2] = {
      row: 0,
      col: 2,
      type: 'obstacle',
      mahjongWallKind: 'pure'
    }

    renderGameScene(ctx, {
      grid,
      currentPath: null,
      placementPreview: null,
      enemies: [],
      towers: [],
      bullets: [],
      damageNumbers: [],
      gameTime: 0
    }, { resolveImage })

    expect(resolveImage.mock.calls.map(([url]) => url)).not.toContain(
      getObstacleSpriteUrl(0, 2)
    )
    expect(spies.roundRect.mock.calls.filter(([, , width]) => width === 18)).toHaveLength(2)
    expect(spies.roundRect.mock.calls.filter(([, , width]) => width === 19)).toHaveLength(1)
  })
})

describe('canvas mahjong combat rendering', () => {
  it('stages three chow sub-projectiles from one semantic bullet', () => {
    const bullet = createMahjongBullet({
      mahjongVisual: {
        suit: 'characters',
        formation: 'chow',
        attachments: [],
        cycleId: 'cycle-chow',
        projectileCount: 3,
        attackStartedAtMs: 1000
      }
    })

    const atLaunch = getMahjongProjectilePresentations(bullet, 1000)
    const afterFirstStagger = getMahjongProjectilePresentations(bullet, 1060)
    const afterSecondStagger = getMahjongProjectilePresentations(bullet, 1120)
    const caughtUp = getMahjongProjectilePresentations(bullet, 1210)

    expect(atLaunch.map(item => item.index)).toEqual([0])
    expect(afterFirstStagger.map(item => item.index)).toEqual([0, 1])
    expect(afterSecondStagger.map(item => item.index)).toEqual([0, 1, 2])
    expect(afterFirstStagger[0].x).toBeGreaterThan(afterFirstStagger[1].x)
    expect(caughtUp.map(item => item.x)).toEqual([90, 90, 90])
    expect(bullet.damage).toBe(24)
    expect(bullet.targetId).toBe('enemy-1')
  })

  it('derives formation start and impact rhythms without adding semantic hits', () => {
    expect(getMahjongFormationStartPulseProgresses('pung', 1000, 1000)).toHaveLength(1)
    expect(getMahjongFormationStartPulseProgresses('pung', 1000, 1045)).toHaveLength(2)
    expect(getMahjongFormationStartPulseProgresses('pung', 1000, 1090)).toHaveLength(3)
    expect(getMahjongFormationStartPulseProgresses('kong', 1000, 1140)).toEqual([.5])

    const chowImpact = createMahjongPresentationEvent({
      formation: 'chow',
      projectileCount: 3,
      elapsedMs: 120
    })
    const pungImpact = createMahjongPresentationEvent({
      formation: 'pung',
      elapsedMs: 90
    })
    const kongImpact = createMahjongPresentationEvent({
      formation: 'kong',
      elapsedMs: 60
    })

    expect(getMahjongImpactPulseProgresses(chowImpact)).toHaveLength(3)
    expect(getMahjongImpactPulseProgresses(pungImpact)).toHaveLength(3)
    expect(getMahjongImpactPulseProgresses(kongImpact)).toHaveLength(1)
    expect(getMahjongImpactPulseProgresses({
      ...kongImpact,
      elapsedMs: kongImpact.durationMs
    })).toEqual([])
  })

  it('maps bamboo focus stacks to five visible arrow-feather segments', () => {
    expect([
      getBambooFocusSegmentCount(0),
      getBambooFocusSegmentCount(1),
      getBambooFocusSegmentCount(2),
      getBambooFocusSegmentCount(3),
      getBambooFocusSegmentCount(8),
      getBambooFocusSegmentCount(10),
      getBambooFocusSegmentCount(99)
    ]).toEqual([0, 1, 1, 2, 4, 5, 5])
  })

  it('draws suit-specific projectiles and fans out visual projectile count', () => {
    const { ctx, spies } = createCanvasContext()
    const bullets = [
      createMahjongBullet(),
      createMahjongBullet({
        id: 'bamboo-bullet',
        position: { x: 100, y: 90 },
        mahjongVisual: {
          suit: 'bamboo',
          formation: 'single',
          attachments: [],
          cycleId: 'cycle-2',
          projectileCount: 1
        }
      }),
      createMahjongBullet({
        id: 'dots-bullet',
        position: { x: 110, y: 100 },
        mahjongVisual: {
          suit: 'dots',
          formation: 'kong',
          attachments: ['red', 'green'],
          cycleId: 'cycle-3',
          projectileCount: 3
        }
      })
    ]

    renderGameScene(ctx, {
      grid: initializeGrid(),
      currentPath: null,
      placementPreview: null,
      enemies: [],
      towers: [],
      bullets,
      damageNumbers: [],
      gameTime: 0
    }, { resolveImage: () => null })

    expect(spies.rotate).toHaveBeenCalledTimes(2)
    expect(spies.arc.mock.calls.filter(([, , radius]) => radius === 2.1)).toHaveLength(3)
    expect(spies.arc.mock.calls.filter(([, , radius]) => radius === 7.5 * 1.35)).toHaveLength(3)
    expect(spies.strokeRect.mock.calls.filter(([, , width]) => width === 13 * 1.35)).toHaveLength(3)
  })

  it('keeps every simultaneous enemy status on an independent draw channel', () => {
    const { ctx, spies } = createCanvasContext()
    const enemy = createEnemy({
      slowTimer: 400,
      isStunned: true,
      mahjongVisualEffects: {
        armorBreakTimer: 500,
        poisonStacks: 4,
        burnTimer: 300
      }
    })

    renderGameScene(ctx, {
      grid: initializeGrid(),
      currentPath: null,
      placementPreview: null,
      enemies: [enemy],
      towers: [],
      bullets: [],
      damageNumbers: [],
      gameTime: 0
    }, { resolveImage: () => null })

    expect(spies.setLineDash.mock.calls).toContainEqual([[2, 2]])
    expect(spies.fillText.mock.calls).toContainEqual(['4', expect.any(Number), expect.any(Number)])
    expect(spies.arc.mock.calls.map(([, , radius]) => radius)).toEqual(
      expect.arrayContaining([2.2, 2.5, 1.8, 1.6])
    )
    expect(spies.moveTo.mock.calls.length).toBeGreaterThanOrEqual(5)
    expect(spies.lineTo.mock.calls.length).toBeGreaterThanOrEqual(30)
  })

  it('layers a red spark trail and red impact ring over the suit core', () => {
    const { ctx, spies } = createCanvasContext()
    const bullet = createMahjongBullet({
      mahjongVisual: {
        suit: 'characters',
        formation: 'single',
        attachments: ['red'],
        cycleId: 'cycle-red',
        projectileCount: 1,
        attackStartedAtMs: 900
      }
    })
    const impact = createMahjongPresentationEvent({
      attachments: ['red'],
      elapsedMs: 90
    })

    renderGameScene(ctx, {
      grid: initializeGrid(),
      currentPath: null,
      placementPreview: null,
      enemies: [],
      towers: [],
      bullets: [bullet],
      damageNumbers: [],
      gameTime: 1000,
      mahjongPresentationEvents: [impact]
    }, { resolveImage: () => null })

    expect(spies.bezierCurveTo).toHaveBeenCalledOnce()
    expect(spies.arc.mock.calls.some(([, , radius]) => radius === 1.2)).toBe(true)
    expect(spies.arc.mock.calls.some(([, , radius]) => radius > 7 && radius < 28)).toBe(true)
  })

  it('draws green execute and dot-stun trigger channels independently', () => {
    const { ctx, spies } = createCanvasContext()
    const execute = createMahjongPresentationEvent({
      id: 'execute',
      attachments: ['green'],
      executed: true,
      elapsedMs: 80
    })
    const stun = createMahjongPresentationEvent({
      id: 'stun',
      suit: 'dots',
      attachments: ['green'],
      stunTriggered: true,
      position: { x: 140, y: 100 },
      elapsedMs: 80
    })

    renderGameScene(ctx, {
      grid: initializeGrid(),
      currentPath: null,
      placementPreview: null,
      enemies: [],
      towers: [],
      bullets: [],
      damageNumbers: [],
      gameTime: 1080,
      mahjongPresentationEvents: [execute, stun]
    }, { resolveImage: () => null })

    expect(spies.fillText.mock.calls).toContainEqual(['發', 100, 100])
    expect(
      spies.strokeRect.mock.calls.filter(([, , width]) => width !== 39)
    ).toHaveLength(2)
    expect(spies.moveTo.mock.calls).toContainEqual([
      expect.any(Number),
      expect.any(Number)
    ])
    expect(spies.lineTo.mock.calls.length).toBeGreaterThanOrEqual(16)
  })

  it('draws five green arrow-feather segments for ten bamboo focus stacks', () => {
    const tower = createMahjongTower(
      'focus-tower',
      { id: 'focus-tile', suit: 'bamboo', rank: 5, copy: 1 },
      100,
      100
    )
    tower.mahjongState = createMahjongState('single', 'bamboo', ['green'])
    const withoutFocus = createCanvasContext()
    const withFocus = createCanvasContext()
    const scene = {
      grid: initializeGrid(),
      currentPath: null,
      placementPreview: null,
      enemies: [],
      towers: [tower],
      bullets: [],
      damageNumbers: [],
      gameTime: 1000
    }

    renderGameScene(withoutFocus.ctx, scene, { resolveImage: () => null })
    renderGameScene(withFocus.ctx, {
      ...scene,
      mahjongBambooFocus: new Map([[
        tower.id,
        { stacks: 10, lastHitAtMs: 900 }
      ]])
    }, { resolveImage: () => null })

    expect(
      withFocus.spies.lineTo.mock.calls.length
      - withoutFocus.spies.lineTo.mock.calls.length
    ).toBe(15)
  })

  it('preserves the round legacy bullet fallback without mahjong metadata', () => {
    const { ctx, spies } = createCanvasContext()
    const bullet = createMahjongBullet()
    delete bullet.mahjongVisual

    renderGameScene(ctx, {
      grid: initializeGrid(),
      currentPath: null,
      placementPreview: null,
      enemies: [],
      towers: [],
      bullets: [bullet],
      damageNumbers: [],
      gameTime: 0
    }, { resolveImage: () => null })

    expect(spies.arc.mock.calls.filter(([, , radius]) => radius === 2.3)).toHaveLength(1)
  })
})
