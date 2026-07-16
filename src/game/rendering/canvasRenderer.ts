import type {
  Bullet,
  DamageNumber,
  Enemy,
  GridCell,
  MahjongFormation,
  MahjongNumberTile,
  MahjongPresentationEvent,
  MahjongSuit,
  PlacementPreview,
  PlacementPreviewStatus,
  Tower
} from '../types/game'
import { ENEMY_TYPES } from '../config/enemies'
import {
  MAHJONG_BAMBOO_LAYOUTS,
  MAHJONG_CHARACTER_NUMERALS,
  MAHJONG_DOT_LAYOUTS,
  MAHJONG_GREEN_ATTACHMENT_CONFIG
} from '../config/mahjong'
import type { FaceMark } from '../config/mahjong'
import { MAP_CONFIG, WAYPOINTS } from '../config/map'
import { getDamageNumberPresentation } from './damageNumberPresentation'
import { getPlacementPreviewPresentation } from './placementPreviewPresentation'
import {
  ENEMY_SPRITES,
  GATE_SPRITES,
  TILE_SPRITE,
  getObstacleSpriteUrl,
  getTowerSpriteUrl,
  resolveSprite
} from './spriteRegistry'

export interface CanvasScene {
  grid: GridCell[][]
  currentPath: Array<{ row: number; col: number }> | null
  placementPreview: PlacementPreview | null
  enemies: Enemy[]
  towers: Tower[]
  bullets: Bullet[]
  damageNumbers: DamageNumber[]
  gameTime: number
  mahjongBambooFocus?: ReadonlyMap<string, {
    stacks: number
    lastHitAtMs: number
  }>
  mahjongPresentationEvents?: readonly MahjongPresentationEvent[]
}

type SpriteResolver = (url: string) => CanvasImageSource | null

interface CanvasRendererOptions {
  resolveImage?: SpriteResolver
}

const ENEMY_SPRITE_PADDING = 2

const MAHJONG_MARK_COLORS = {
  red: '#c83228',
  green: '#208653',
  blue: '#24589a'
} as const

const MAHJONG_TILE_ASPECT_RATIO = 40 / 54
const MAHJONG_TOWER_HEIGHT = 30
const MAHJONG_WALL_FACE_HEIGHT = 26
const MAHJONG_CHOW_PROJECTILE_STAGGER_MS = 60
const MAHJONG_CHOW_PROJECTILE_CATCHUP_MS = 90
const MAHJONG_IMPACT_PULSE_DURATION_MS = 220

export interface MahjongFormationTileLayout {
  rank: MahjongNumberTile['rank']
  isWhite: boolean
  offsetX: number
  offsetY: number
  rotationRadians: number
  height: number
}

const MAHJONG_FORMATION_TILE_GEOMETRY: Record<
  MahjongFormation,
  readonly Omit<MahjongFormationTileLayout, 'rank' | 'isWhite'>[]
> = {
  single: [
    { offsetX: 0, offsetY: 0, rotationRadians: 0, height: MAHJONG_TOWER_HEIGHT }
  ],
  pair: [
    { offsetX: -6, offsetY: 1, rotationRadians: -Math.PI / 45, height: 25 },
    { offsetX: 6, offsetY: 1, rotationRadians: Math.PI / 45, height: 25 }
  ],
  chow: [
    { offsetX: -9, offsetY: 2, rotationRadians: -Math.PI / 15, height: 23 },
    { offsetX: 0, offsetY: -1, rotationRadians: 0, height: 23 },
    { offsetX: 9, offsetY: 2, rotationRadians: Math.PI / 15, height: 23 }
  ],
  pung: [
    { offsetX: -5, offsetY: -4, rotationRadians: 0, height: 26 },
    { offsetX: 0, offsetY: 0, rotationRadians: 0, height: 26 },
    { offsetX: 5, offsetY: 4, rotationRadians: 0, height: 26 }
  ],
  kong: [
    { offsetX: -7, offsetY: -7, rotationRadians: -Math.PI / 90, height: 20 },
    { offsetX: 7, offsetY: -7, rotationRadians: Math.PI / 90, height: 20 },
    { offsetX: -7, offsetY: 7, rotationRadians: Math.PI / 90, height: 20 },
    { offsetX: 7, offsetY: 7, rotationRadians: -Math.PI / 90, height: 20 }
  ]
}

/**
 * Maps the authoritative logical faces stored on a Mahjong tower to a compact
 * formation layout. Rendering order is back-to-front, which gives pung its
 * visible stacked depth without inventing or duplicating tile entities.
 */
export function getMahjongFormationTileLayouts(
  formation: MahjongFormation,
  ranks: readonly MahjongNumberTile['rank'][],
  whiteSlotIndices: readonly number[] = []
): MahjongFormationTileLayout[] {
  return MAHJONG_FORMATION_TILE_GEOMETRY[formation]
    .slice(0, ranks.length)
    .map((geometry, index) => ({
      ...geometry,
      rank: ranks[index],
      isWhite: whiteSlotIndices.includes(index)
    }))
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export interface MahjongProjectilePresentation {
  index: number
  x: number
  y: number
  alpha: number
}

/**
 * Expands one already-resolved semantic bullet into presentation-only sub-shots.
 * The returned count and timing never feed back into collision or damage code.
 */
export function getMahjongProjectilePresentations(
  bullet: Bullet,
  gameTime: number
): MahjongProjectilePresentation[] {
  const visual = bullet.mahjongVisual
  if (!visual) return []

  const count = Math.max(1, Math.floor(visual.projectileCount))
  const isChow = visual.formation === 'chow'
  const fallbackStartedAt = gameTime
    - (count - 1) * MAHJONG_CHOW_PROJECTILE_STAGGER_MS
    - MAHJONG_CHOW_PROJECTILE_CATCHUP_MS
  const startedAt = visual.attackStartedAtMs ?? fallbackStartedAt
  const elapsed = Math.max(0, gameTime - startedAt)
  const dx = bullet.position.x - bullet.originPosition.x
  const dy = bullet.position.y - bullet.originPosition.y
  const distance = Math.hypot(dx, dy) || 1
  const perpendicularX = -dy / distance
  const perpendicularY = dx / distance
  const presentations: MahjongProjectilePresentation[] = []

  for (let index = 0; index < count; index += 1) {
    const delay = isChow ? index * MAHJONG_CHOW_PROJECTILE_STAGGER_MS : 0
    const releaseAge = elapsed - delay
    if (releaseAge < 0) continue

    const catchup = isChow
      ? clamp01(releaseAge / MAHJONG_CHOW_PROJECTILE_CATCHUP_MS)
      : 1
    const offset = (index - (count - 1) / 2) * 4
    presentations.push({
      index,
      x: bullet.originPosition.x + dx * catchup + perpendicularX * offset,
      y: bullet.originPosition.y + dy * catchup + perpendicularY * offset,
      alpha: clamp01(.35 + releaseAge / 80)
    })
  }

  return presentations
}

export function getMahjongFormationStartPulseProgresses(
  formation: MahjongFormation,
  lastAttackTime: number,
  gameTime: number
): number[] {
  if (lastAttackTime <= 0 || gameTime < lastAttackTime) return []
  const elapsed = gameTime - lastAttackTime

  if (formation === 'pung') {
    return [0, 45, 90]
      .map(delay => elapsed - delay)
      .filter(age => age >= 0 && age < 180)
      .map(age => clamp01(age / 180))
  }
  if (formation === 'kong' && elapsed < 280) {
    return [clamp01(elapsed / 280)]
  }
  return []
}

export function getMahjongImpactPulseProgresses(
  event: Pick<MahjongPresentationEvent, 'formation' | 'projectileCount' | 'elapsedMs'>
): number[] {
  const count = event.formation === 'chow'
    ? Math.max(1, Math.floor(event.projectileCount))
    : event.formation === 'pung'
      ? 3
      : 1
  const stagger = event.formation === 'chow'
    ? MAHJONG_CHOW_PROJECTILE_STAGGER_MS
    : event.formation === 'pung'
      ? 45
      : 0

  return Array.from({ length: count }, (_, index) => event.elapsedMs - index * stagger)
    .filter(age => age >= 0 && age < MAHJONG_IMPACT_PULSE_DURATION_MS)
    .map(age => clamp01(age / MAHJONG_IMPACT_PULSE_DURATION_MS))
}

export function getBambooFocusSegmentCount(stacks: number): number {
  if (!Number.isFinite(stacks)) return 0
  return Math.min(5, Math.ceil(Math.max(0, stacks) / 2))
}

const MAHJONG_SUIT_COLORS: Record<MahjongSuit, {
  core: string
  glow: string
}> = {
  characters: {
    core: '#f2b632',
    glow: 'rgba(255, 196, 57, 0.82)'
  },
  bamboo: {
    core: '#54d77d',
    glow: 'rgba(73, 220, 124, 0.82)'
  },
  dots: {
    core: '#62dff2',
    glow: 'rgba(75, 211, 247, 0.82)'
  }
}

interface PathStyle {
  glow: string
  outer: string
  inner: string
  outerWidth: number
  innerWidth: number
  dash?: number[]
}

const CURRENT_PATH_STYLE: PathStyle = {
  glow: 'rgba(46, 218, 225, 0.82)',
  outer: 'rgba(55, 220, 225, 0.28)',
  inner: '#73f4ed',
  outerWidth: 10,
  innerWidth: 3.4
}

const MUTED_PATH_STYLE: PathStyle = {
  glow: 'rgba(46, 218, 225, 0.24)',
  outer: 'rgba(55, 220, 225, 0.12)',
  inner: 'rgba(115, 244, 237, 0.48)',
  outerWidth: 8,
  innerWidth: 2.2,
  dash: [5, 5]
}

const PREVIEW_PATH_STYLES: Record<PlacementPreviewStatus, PathStyle> = {
  valid: {
    glow: 'rgba(94, 255, 137, 0.88)',
    outer: 'rgba(65, 222, 111, 0.32)',
    inner: '#9affad',
    outerWidth: 11,
    innerWidth: 3.8
  },
  path_blocked: {
    glow: 'rgba(255, 83, 78, 0.88)',
    outer: 'rgba(255, 83, 78, 0.3)',
    inner: '#ff7772',
    outerWidth: 11,
    innerWidth: 3.8
  },
  insufficient_capacity: {
    glow: 'rgba(255, 181, 58, 0.88)',
    outer: 'rgba(255, 174, 47, 0.3)',
    inner: '#ffd071',
    outerWidth: 11,
    innerWidth: 3.8
  }
}

function cellCenter(row: number, col: number) {
  const { cellSize } = MAP_CONFIG
  return {
    x: col * cellSize + cellSize / 2,
    y: row * cellSize + cellSize / 2
  }
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource | null,
  x: number,
  y: number,
  width: number,
  height = width
) {
  if (!image) return
  ctx.drawImage(image, x - width / 2, y - height / 2, width, height)
}

function drawMahjongDotFace(
  ctx: CanvasRenderingContext2D,
  rank: MahjongNumberTile['rank'],
  marks: readonly FaceMark[]
) {
  if (rank === 1) {
    const rings = [
      { radius: 8.4, color: MAHJONG_MARK_COLORS.blue, width: 2.2 },
      { radius: 6.1, color: MAHJONG_MARK_COLORS.green, width: 2 },
      { radius: 3.8, color: MAHJONG_MARK_COLORS.red, width: 2 }
    ]
    rings.forEach(ring => {
      ctx.beginPath()
      ctx.arc(20, 27, ring.radius, 0, Math.PI * 2)
      ctx.strokeStyle = ring.color
      ctx.lineWidth = ring.width
      ctx.stroke()
    })
    ctx.beginPath()
    ctx.arc(20, 27, 1.4, 0, Math.PI * 2)
    ctx.fillStyle = MAHJONG_MARK_COLORS.green
    ctx.fill()
    return
  }

  const radius = marks.length >= 8 ? 2.6 : 3.6

  marks.forEach(faceMark => {
    const x = faceMark.x * 40
    const y = faceMark.y * 54
    const color = MAHJONG_MARK_COLORS[faceMark.color]

    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = radius > 5 ? 3 : 1.7
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(x, y, Math.max(1.1, radius * 0.28), 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  })
}

function drawMahjongBirdFace(
  ctx: CanvasRenderingContext2D,
  faceMark: FaceMark
) {
  const x = faceMark.x * 40
  const y = faceMark.y * 54

  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = MAHJONG_MARK_COLORS.green
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-8, 6)
  ctx.bezierCurveTo(-8, -2, -3, -10, 4, -11)
  ctx.bezierCurveTo(9, -11, 11, -6, 9, -2)
  ctx.bezierCurveTo(7, 2, 3, 4, -1, 5)
  ctx.lineTo(-1, 12)
  ctx.stroke()

  ctx.strokeStyle = MAHJONG_MARK_COLORS.red
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-4, -3)
  ctx.bezierCurveTo(0, -1, 4, -1, 7, -4)
  ctx.stroke()

  ctx.fillStyle = MAHJONG_MARK_COLORS.blue
  ctx.beginPath()
  ctx.arc(5, -7, 1.3, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#c99a24'
  ctx.beginPath()
  ctx.moveTo(9, -5)
  ctx.lineTo(14, -3)
  ctx.lineTo(9, -1)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = MAHJONG_MARK_COLORS.red
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(-1, 12)
  ctx.lineTo(-5, 16)
  ctx.moveTo(-1, 12)
  ctx.lineTo(3, 16)
  ctx.stroke()
  ctx.restore()
}

function drawMahjongBambooFace(
  ctx: CanvasRenderingContext2D,
  marks: readonly FaceMark[]
) {
  if (marks.length === 1) {
    drawMahjongBirdFace(ctx, marks[0])
    return
  }

  const height = marks.length >= 8 ? 7 : marks.length >= 6 ? 8 : 10
  marks.forEach(faceMark => {
    const x = faceMark.x * 40
    const y = faceMark.y * 54
    ctx.save()
    ctx.translate(x, y)
    if (faceMark.rotation) ctx.rotate(faceMark.rotation * Math.PI / 180)
    roundedRect(ctx, -1.8, -height / 2, 3.6, height, 1.8)
    ctx.fillStyle = MAHJONG_MARK_COLORS[faceMark.color]
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(-3, 0)
    ctx.lineTo(3, 0)
    ctx.strokeStyle = '#f5d56a'
    ctx.lineWidth = 1.2
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.restore()
  })
}

export type MahjongTileFaceDescriptor =
  | { kind: 'number'; suit: MahjongSuit; rank: MahjongNumberTile['rank'] }
  | { kind: 'white' }

function drawMahjongFace(
  ctx: CanvasRenderingContext2D,
  face: MahjongTileFaceDescriptor
) {
  if (face.kind === 'white') {
    roundedRect(ctx, 8, 8, 24, 38, 2)
    ctx.strokeStyle = MAHJONG_MARK_COLORS.blue
    ctx.lineWidth = 2.2
    ctx.stroke()
    return
  }

  if (face.suit === 'characters') {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = "800 18px KaiTi, STKaiti, 'Songti SC', serif"
    ctx.fillStyle = '#18212b'
    ctx.fillText(MAHJONG_CHARACTER_NUMERALS[face.rank], 20, 18)
    ctx.fillStyle = MAHJONG_MARK_COLORS.red
    ctx.fillText('萬', 20, 39)
    return
  }

  if (face.suit === 'dots') {
    drawMahjongDotFace(ctx, face.rank, MAHJONG_DOT_LAYOUTS[face.rank])
    return
  }

  drawMahjongBambooFace(ctx, MAHJONG_BAMBOO_LAYOUTS[face.rank])
}

function drawMahjongTileBody(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  height: number,
  face: MahjongTileFaceDescriptor,
  rotationRadians = 0
) {
  const width = height * MAHJONG_TILE_ASPECT_RATIO

  ctx.save()
  ctx.translate(centerX, centerY)
  if (rotationRadians !== 0) ctx.rotate(rotationRadians)
  ctx.translate(-width / 2, -height / 2)
  ctx.scale(width / 40, height / 54)
  ctx.shadowColor = 'rgba(48, 39, 24, 0.28)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 2
  roundedRect(ctx, 1, 3, 38, 50, 5)
  ctx.fillStyle = '#b8b9ad'
  ctx.fill()

  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  roundedRect(ctx, 1, 1, 38, 49, 5)
  ctx.fillStyle = '#f7f1df'
  ctx.strokeStyle = '#6c6a60'
  ctx.lineWidth = 1.4
  ctx.fill()
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(5, 5)
  ctx.lineTo(35, 5)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)'
  ctx.lineWidth = 1.2
  ctx.stroke()
  drawMahjongFace(ctx, face)
  ctx.restore()
}

function drawGreyWallTile(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number
) {
  ctx.save()
  roundedRect(ctx, centerX - width / 2, centerY - height / 2, width, height, 3)
  ctx.fillStyle = '#a9aaa5'
  ctx.strokeStyle = '#5c5d59'
  ctx.lineWidth = 1.2
  ctx.shadowColor = 'rgba(48, 39, 24, 0.26)'
  ctx.shadowBlur = 3
  ctx.shadowOffsetY = 2
  ctx.fill()
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  ctx.beginPath()
  ctx.moveTo(centerX - width / 2 + 3, centerY - height / 2 + 3)
  ctx.lineTo(centerX + width / 2 - 3, centerY - height / 2 + 3)
  ctx.strokeStyle = 'rgba(244, 244, 237, 0.66)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

function drawMahjongWall(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  tile: Pick<MahjongNumberTile, 'suit' | 'rank'>
) {
  // 两张灰色叠牌构成紧凑牌墙轮廓，前方牌面继续显示被锁住的实体牌。
  drawGreyWallTile(ctx, centerX - 7, centerY + 3, 18, 25)
  drawGreyWallTile(ctx, centerX + 7, centerY + 3, 18, 25)
  drawMahjongTileBody(
    ctx,
    centerX,
    centerY - 2,
    MAHJONG_WALL_FACE_HEIGHT,
    { kind: 'number', suit: tile.suit, rank: tile.rank }
  )
}

function drawPureMahjongWall(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number
) {
  drawGreyWallTile(ctx, centerX - 7, centerY + 3, 18, 25)
  drawGreyWallTile(ctx, centerX + 7, centerY + 3, 18, 25)
  drawGreyWallTile(ctx, centerX, centerY - 3, 19, 26)
}

function drawMahjongTileBack(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number
) {
  const height = 26
  const width = height * MAHJONG_TILE_ASPECT_RATIO
  const left = centerX - width / 2
  const top = centerY - height / 2

  ctx.save()
  ctx.shadowColor = 'rgba(21, 28, 49, 0.35)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 2
  roundedRect(ctx, left, top + 2, width, height, 3)
  ctx.fillStyle = '#202b49'
  ctx.fill()

  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  roundedRect(ctx, left, top, width, height - 2, 3)
  ctx.fillStyle = '#142b54'
  ctx.strokeStyle = '#07152e'
  ctx.lineWidth = 1.2
  ctx.fill()
  ctx.stroke()
  roundedRect(ctx, left + 3, top + 3, width - 6, height - 8, 1.5)
  ctx.strokeStyle = '#8091b2'
  ctx.lineWidth = 0.8
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(centerX, top + 5)
  ctx.lineTo(left + width - 4, centerY - 1)
  ctx.lineTo(centerX, top + height - 5)
  ctx.lineTo(left + 4, centerY - 1)
  ctx.closePath()
  ctx.strokeStyle = '#395681'
  ctx.stroke()
  ctx.restore()
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  grid: GridCell[][],
  resolveImage: SpriteResolver
) {
  const { rows, cols, cellSize } = MAP_CONFIG
  const tile = resolveImage(TILE_SPRITE)

  ctx.fillStyle = '#f7e7b8'
  ctx.fillRect(0, 0, cols * cellSize, rows * cellSize)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  grid.forEach(row => {
    row.forEach(cell => {
      const x = cell.col * cellSize
      const y = cell.row * cellSize
      if (tile) {
        ctx.drawImage(tile, x, y, cellSize, cellSize)
      }

      ctx.strokeStyle = 'rgba(143, 112, 49, 0.28)'
      ctx.lineWidth = 0.8
      ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1)
    })
  })
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  path: CanvasScene['currentPath'],
  style: PathStyle = CURRENT_PATH_STYLE
) {
  if (!path || path.length === 0) return

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.setLineDash(style.dash ?? [])
  ctx.beginPath()
  path.forEach((point, index) => {
    const { x, y } = cellCenter(point.row, point.col)
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.strokeStyle = style.outer
  ctx.lineWidth = style.outerWidth
  ctx.shadowColor = style.glow
  ctx.shadowBlur = 8
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.strokeStyle = style.inner
  ctx.lineWidth = style.innerWidth
  ctx.stroke()
  ctx.restore()
}

function drawWaypointMarkers(ctx: CanvasRenderingContext2D) {
  WAYPOINTS.slice(1, -1).forEach(waypoint => {
    const { x, y } = cellCenter(waypoint.row, waypoint.col)
    ctx.save()
    ctx.shadowColor = 'rgba(29, 188, 255, 0.8)'
    ctx.shadowBlur = 7
    ctx.fillStyle = '#147bd1'
    ctx.strokeStyle = '#fff3b0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y, 6.8, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#8ef7ff'
    ctx.beginPath()
    ctx.arc(x, y, 2.7, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  })
}

function drawGates(
  ctx: CanvasRenderingContext2D,
  resolveImage: SpriteResolver
) {
  const start = cellCenter(MAP_CONFIG.startPos.row, MAP_CONFIG.startPos.col)
  const end = cellCenter(MAP_CONFIG.endPos.row, MAP_CONFIG.endPos.col)
  drawSprite(ctx, resolveImage(GATE_SPRITES.entrance), start.x, start.y, 40)
  drawSprite(ctx, resolveImage(GATE_SPRITES.exit), end.x, end.y, 40)
}

function drawObstacles(
  ctx: CanvasRenderingContext2D,
  grid: GridCell[][],
  resolveImage: SpriteResolver
) {
  grid.forEach(row => {
    row.forEach(cell => {
      if (cell.type !== 'obstacle') return
      const { x, y } = cellCenter(cell.row, cell.col)
      if (cell.mahjongTile) {
        drawMahjongWall(ctx, x, y, cell.mahjongTile)
        return
      }
      if (cell.mahjongWallKind === 'pure') {
        drawPureMahjongWall(ctx, x, y)
        return
      }
      drawSprite(
        ctx,
        resolveImage(getObstacleSpriteUrl(cell.row, cell.col)),
        x,
        y,
        37
      )
    })
  })
}

function drawMahjongSuitCore(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  suit: MahjongSuit,
  gameTime: number
) {
  const colors = MAHJONG_SUIT_COLORS[suit]
  const pulse = 1 + Math.sin(gameTime / 260) * 0.08

  ctx.save()
  ctx.strokeStyle = colors.core
  ctx.fillStyle = colors.core
  ctx.shadowColor = colors.glow
  ctx.shadowBlur = 7
  ctx.lineWidth = 1.7

  if (suit === 'characters') {
    const radius = 4.2 * pulse
    ctx.beginPath()
    ctx.moveTo(x, y - 20 - radius)
    ctx.lineTo(x + radius, y - 20)
    ctx.lineTo(x, y - 20 + radius)
    ctx.lineTo(x - radius, y - 20)
    ctx.closePath()
    ctx.fill()
  } else if (suit === 'bamboo') {
    ctx.beginPath()
    ctx.moveTo(x, y - 26)
    ctx.lineTo(x, y - 15)
    ctx.moveTo(x, y - 22)
    ctx.lineTo(x - 4.5, y - 25)
    ctx.moveTo(x, y - 19)
    ctx.lineTo(x + 4.5, y - 22)
    ctx.stroke()
  } else {
    for (const radius of [2.2, 4.7]) {
      ctx.beginPath()
      ctx.arc(x, y - 20, radius * pulse, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawMahjongFormationMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  formation: MahjongFormation,
  suit: MahjongSuit,
  gameTime: number
) {
  const colors = MAHJONG_SUIT_COLORS[suit]
  const phase = gameTime / 420
  const markerY = y + 19

  ctx.save()
  ctx.strokeStyle = colors.core
  ctx.fillStyle = colors.core
  ctx.shadowColor = colors.glow
  ctx.shadowBlur = 4
  ctx.lineWidth = 1.4

  if (formation === 'single') {
    ctx.beginPath()
    ctx.arc(x, markerY, 2, 0, Math.PI * 2)
    ctx.fill()
  } else if (formation === 'pair') {
    for (const offset of [-3.5, 3.5]) {
      ctx.beginPath()
      ctx.arc(x + offset, markerY, 2, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else if (formation === 'chow') {
    for (let index = 0; index < 3; index += 1) {
      const angle = phase + index * Math.PI * 2 / 3
      ctx.beginPath()
      ctx.arc(
        x + Math.cos(angle) * 15,
        y + Math.sin(angle) * 19,
        1.8,
        0,
        Math.PI * 2
      )
      ctx.fill()
    }
  } else if (formation === 'pung') {
    for (const [offsetX, offsetY] of [[-4, 1], [4, 1], [0, -4]]) {
      ctx.beginPath()
      ctx.arc(x + offsetX, markerY + offsetY, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    for (const [offsetX, offsetY] of [[-5, -3], [5, -3], [-5, 4], [5, 4]]) {
      ctx.strokeRect(x + offsetX - 1.5, markerY + offsetY - 1.5, 3, 3)
    }
  }
  ctx.restore()
}

function drawMahjongFormationAttackStart(
  ctx: CanvasRenderingContext2D,
  tower: Tower,
  formation: MahjongFormation,
  suit: MahjongSuit,
  gameTime: number
) {
  const progresses = getMahjongFormationStartPulseProgresses(
    formation,
    tower.lastAttackTime,
    gameTime
  )
  if (progresses.length === 0) return

  const colors = MAHJONG_SUIT_COLORS[suit]
  ctx.save()
  ctx.strokeStyle = colors.core
  ctx.shadowColor = colors.glow
  ctx.shadowBlur = formation === 'kong' ? 10 : 6
  ctx.lineWidth = formation === 'kong' ? 2.4 : 1.5
  progresses.forEach(progress => {
    ctx.globalAlpha = 1 - progress
    ctx.beginPath()
    ctx.arc(
      tower.position.x,
      tower.position.y,
      formation === 'kong' ? 26 - progress * 10 : 9 + progress * 13,
      0,
      Math.PI * 2
    )
    ctx.stroke()
    if (formation === 'kong') {
      ctx.beginPath()
      ctx.arc(
        tower.position.x,
        tower.position.y,
        18 - progress * 5,
        0,
        Math.PI * 2
      )
      ctx.stroke()
    }
  })
  ctx.restore()
}

function drawRedAttachment(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gameTime: number
) {
  const pulse = 0.9 + (Math.sin(gameTime / 180) + 1) * 0.08

  ctx.save()
  ctx.strokeStyle = '#f04a35'
  ctx.fillStyle = 'rgba(255, 79, 48, 0.22)'
  ctx.shadowColor = 'rgba(255, 74, 38, 0.88)'
  ctx.shadowBlur = 8
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.arc(x, y, 19.5 * pulse, Math.PI * 0.12, Math.PI * 0.88)
  ctx.stroke()
  for (const offset of [-9, 0, 9]) {
    ctx.beginPath()
    ctx.moveTo(x + offset - 3, y + 17)
    ctx.bezierCurveTo(
      x + offset - 5,
      y + 11,
      x + offset + 1,
      y + 8,
      x + offset,
      y + 3
    )
    ctx.bezierCurveTo(
      x + offset + 7,
      y + 10,
      x + offset + 5,
      y + 15,
      x + offset + 3,
      y + 17
    )
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

function drawGreenAttachment(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gameTime: number
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(gameTime / 2600)
  ctx.strokeStyle = '#31c878'
  ctx.shadowColor = 'rgba(57, 226, 137, 0.78)'
  ctx.shadowBlur = 6
  ctx.lineWidth = 1.3
  ctx.strokeRect(-22, -22, 44, 44)
  ctx.restore()

  ctx.save()
  ctx.fillStyle = '#31c878'
  ctx.shadowColor = 'rgba(57, 226, 137, 0.78)'
  ctx.shadowBlur = 5
  ctx.font = "800 8px KaiTi, STKaiti, 'Songti SC', serif"
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('發', x + 19, y - 17)
  ctx.restore()
}

function drawBambooFocusArrows(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  stacks: number
) {
  const segmentCount = getBambooFocusSegmentCount(stacks)
  if (segmentCount === 0) return

  ctx.save()
  ctx.strokeStyle = '#55e59b'
  ctx.shadowColor = 'rgba(57, 226, 137, 0.82)'
  ctx.shadowBlur = 5
  ctx.lineWidth = 1.5
  for (let index = 0; index < segmentCount; index += 1) {
    const angle = -Math.PI * .86 + index * Math.PI * .18
    const innerX = x + Math.cos(angle) * 23
    const innerY = y + Math.sin(angle) * 23
    const outerX = x + Math.cos(angle) * 29
    const outerY = y + Math.sin(angle) * 29
    const wingX = Math.cos(angle + Math.PI / 2) * 2.4
    const wingY = Math.sin(angle + Math.PI / 2) * 2.4
    ctx.beginPath()
    ctx.moveTo(innerX, innerY)
    ctx.lineTo(outerX, outerY)
    ctx.moveTo(innerX, innerY)
    ctx.lineTo(innerX + wingX, innerY + wingY)
    ctx.moveTo(innerX, innerY)
    ctx.lineTo(innerX - wingX, innerY - wingY)
    ctx.stroke()
  }
  ctx.restore()
}

function drawMahjongTowerVisuals(
  ctx: CanvasRenderingContext2D,
  tower: Tower,
  gameTime: number,
  bambooFocus?: { stacks: number; lastHitAtMs: number }
) {
  const state = tower.mahjongState
  const suit = state?.suit ?? tower.mahjongTile?.suit
  if (!suit) return

  const formation = state?.formation ?? 'single'
  const attachments = state?.attachments ?? []
  drawMahjongSuitCore(ctx, tower.position.x, tower.position.y, suit, gameTime)
  drawMahjongFormationAttackStart(ctx, tower, formation, suit, gameTime)
  if (attachments.includes('red')) {
    drawRedAttachment(ctx, tower.position.x, tower.position.y, gameTime)
  }
  if (attachments.includes('green')) {
    drawGreenAttachment(ctx, tower.position.x, tower.position.y, gameTime)
  }
  if (
    suit === 'bamboo'
    && attachments.includes('green')
    && bambooFocus
    && gameTime - bambooFocus.lastHitAtMs
      < MAHJONG_GREEN_ATTACHMENT_CONFIG.bamboo.resetAfterMs
  ) {
    drawBambooFocusArrows(
      ctx,
      tower.position.x,
      tower.position.y,
      bambooFocus.stacks
    )
  }
}

function drawTower(
  ctx: CanvasRenderingContext2D,
  tower: Tower,
  resolveImage: SpriteResolver,
  gameTime: number,
  bambooFocus?: { stacks: number; lastHitAtMs: number }
) {
  if (tower.mahjongTile) {
    const qualityScale = {
      chipped: 0.92,
      flawed: 0.96,
      normal: 1,
      flawless: 1.04
    }[tower.level]
    drawMahjongTowerVisuals(ctx, tower, gameTime, bambooFocus)
    const state = tower.mahjongState
    const formation = state?.formation ?? 'single'
    const suit = state?.suit ?? tower.mahjongTile.suit
    const ranks = state?.ranks ?? [tower.mahjongTile.rank]
    const whiteSlotIndices = state?.whiteSlotIndices ?? []
    const layouts = getMahjongFormationTileLayouts(formation, ranks, whiteSlotIndices)
    layouts.forEach(layout => {
      drawMahjongTileBody(
        ctx,
        tower.position.x + layout.offsetX * qualityScale,
        tower.position.y + layout.offsetY * qualityScale,
        layout.height * qualityScale,
        layout.isWhite
          ? { kind: 'white' }
          : { kind: 'number', suit, rank: layout.rank },
        layout.rotationRadians
      )
    })
    drawMahjongFormationMark(
      ctx,
      tower.position.x,
      tower.position.y,
      formation,
      suit,
      gameTime
    )
    return
  }

  const spriteUrl = getTowerSpriteUrl(tower)
  if (!spriteUrl) return

  const qualityScale = {
    chipped: 0.91,
    flawed: 0.96,
    normal: 1,
    flawless: 1.06
  }[tower.level]
  drawSprite(
    ctx,
    resolveImage(spriteUrl),
    tower.position.x,
    tower.position.y,
    40 * qualityScale
  )
}

function drawPlacementPreview(
  ctx: CanvasRenderingContext2D,
  preview: PlacementPreview
) {
  const { cellSize } = MAP_CONFIG
  const x = preview.position.col * cellSize
  const y = preview.position.row * cellSize
  const center = cellCenter(preview.position.row, preview.position.col)
  const style = getPlacementPreviewPresentation(preview.status)

  ctx.save()
  roundedRect(ctx, x + 3, y + 3, cellSize - 6, cellSize - 6, 9)
  ctx.fillStyle = style.fill
  ctx.fill()
  ctx.setLineDash([4, 3])
  ctx.lineWidth = 2.2
  ctx.strokeStyle = style.stroke
  ctx.shadowColor = style.stroke
  ctx.shadowBlur = 7
  ctx.stroke()
  ctx.setLineDash([])

  // 未落地前只显示统一深蓝牌背，不泄露具体花色或点数。
  drawMahjongTileBack(ctx, center.x, center.y + 1)
  ctx.shadowColor = style.stroke
  ctx.shadowBlur = 4
  ctx.fillStyle = style.stroke
  ctx.strokeStyle = '#fff8dc'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(x + cellSize - 9, y + 9, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.fillStyle = '#4c3217'
  ctx.font = "900 12px ui-rounded, 'PingFang SC', sans-serif"
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(style.badge, x + cellSize - 9, y + 9.4)
  ctx.restore()
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
}

function drawEnemyHealth(ctx: CanvasRenderingContext2D, enemy: Enemy, size: number) {
  const percent = Math.max(0, Math.min(enemy.health / enemy.maxHealth, 1))
  const width = Math.max(20, size * 0.92)
  const x = enemy.position.x - width / 2
  const y = enemy.position.y - size / 2 - 5

  ctx.save()
  roundedRect(ctx, x, y, width, 3.6, 2)
  ctx.fillStyle = 'rgba(70, 42, 23, 0.82)'
  ctx.fill()
  if (percent > 0) {
    roundedRect(ctx, x + 0.8, y + 0.8, (width - 1.6) * percent, 2, 1)
    ctx.fillStyle = percent > 0.35 ? '#ef4b32' : '#ffb02e'
    ctx.fill()
  }
  ctx.restore()
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number
) {
  ctx.beginPath()
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + index * Math.PI / 5
    const pointRadius = index % 2 === 0 ? radius : radius * 0.42
    const pointX = x + Math.cos(angle) * pointRadius
    const pointY = y + Math.sin(angle) * pointRadius
    if (index === 0) ctx.moveTo(pointX, pointY)
    else ctx.lineTo(pointX, pointY)
  }
  ctx.closePath()
  ctx.fill()
}

function drawEnemyEffects(ctx: CanvasRenderingContext2D, enemy: Enemy, size: number) {
  const visualEffects = enemy.mahjongVisualEffects

  if ((visualEffects?.armorBreakTimer ?? 0) > 0) {
    const x = enemy.position.x - size * 0.62
    const y = enemy.position.y - size * 0.18
    ctx.save()
    ctx.strokeStyle = '#d7d9df'
    ctx.shadowColor = 'rgba(225, 231, 244, 0.75)'
    ctx.shadowBlur = 4
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(x - 4, y - 4)
    ctx.lineTo(x + 4, y - 4)
    ctx.lineTo(x + 3, y + 3)
    ctx.lineTo(x, y + 6)
    ctx.lineTo(x - 3, y + 3)
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + 1, y - 4)
    ctx.lineTo(x - 2, y)
    ctx.lineTo(x + 2, y + 2)
    ctx.lineTo(x - 1, y + 5)
    ctx.stroke()
    ctx.restore()
  }

  if ((enemy.slowTimer ?? 0) > 0) {
    ctx.save()
    ctx.strokeStyle = 'rgba(77, 211, 255, 0.9)'
    ctx.fillStyle = 'rgba(97, 224, 255, 0.14)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(enemy.position.x, enemy.position.y, size * 0.55, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  const poisonStacks = Math.max(
    visualEffects?.poisonStacks ?? 0,
    enemy.poisonEffects?.length ?? 0
  )
  if (poisonStacks > 0) {
    ctx.save()
    ctx.strokeStyle = 'rgba(82, 214, 77, 0.9)'
    ctx.lineWidth = 1.6
    ctx.setLineDash([2, 2])
    ctx.beginPath()
    ctx.arc(enemy.position.x, enemy.position.y, size * 0.57, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#78e263'
    ctx.beginPath()
    ctx.arc(
      enemy.position.x + size * 0.5,
      enemy.position.y - size * 0.34,
      3.2,
      0,
      Math.PI * 2
    )
    ctx.fill()
    if (poisonStacks > 1) {
      ctx.fillStyle = '#ecffdc'
      ctx.font = "800 8px ui-rounded, 'PingFang SC', sans-serif"
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(poisonStacks), enemy.position.x + size * 0.5, enemy.position.y - size * 0.34)
    }
    ctx.restore()
  }

  if (enemy.isStunned) {
    ctx.save()
    ctx.fillStyle = '#ffd84d'
    ctx.strokeStyle = '#8a4f18'
    ctx.lineWidth = 0.8
    const y = enemy.position.y - size * 0.65
    for (const offset of [-5, 0, 5]) {
      drawStar(ctx, enemy.position.x + offset, y - Math.abs(offset) * 0.18, 2.6)
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()
  }

  if ((visualEffects?.burnTimer ?? 0) > 0) {
    ctx.save()
    ctx.fillStyle = '#ff6a2e'
    ctx.shadowColor = 'rgba(255, 73, 26, 0.9)'
    ctx.shadowBlur = 6
    for (const [offsetX, offsetY, radius] of [
      [-0.42, 0.28, 2.2],
      [0.38, 0.23, 2.5],
      [-0.22, -0.46, 1.8],
      [0.48, -0.34, 1.6]
    ]) {
      ctx.beginPath()
      ctx.arc(
        enemy.position.x + size * offsetX,
        enemy.position.y + size * offsetY,
        radius,
        0,
        Math.PI * 2
      )
      ctx.fill()
    }
    ctx.restore()
  }
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  resolveImage: SpriteResolver
) {
  const size = ENEMY_TYPES[enemy.type].radius * 2 + ENEMY_SPRITE_PADDING
  drawSprite(
    ctx,
    resolveImage(ENEMY_SPRITES[enemy.type]),
    enemy.position.x,
    enemy.position.y,
    size
  )
  drawEnemyEffects(ctx, enemy, size)
  drawEnemyHealth(ctx, enemy, size)
}

function drawMahjongBulletCore(
  ctx: CanvasRenderingContext2D,
  bullet: Bullet,
  x: number,
  y: number,
  alpha = 1
) {
  const visual = bullet.mahjongVisual
  if (!visual) return

  const colors = MAHJONG_SUIT_COLORS[visual.suit]
  const dx = bullet.position.x - bullet.originPosition.x
  const dy = bullet.position.y - bullet.originPosition.y
  const angle = Math.atan2(dy, dx)
  const formationScale = visual.formation === 'kong'
    ? 1.35
    : visual.formation === 'pung'
      ? 1.2
      : 1

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = colors.core
  ctx.fillStyle = colors.core
  ctx.shadowColor = colors.glow
  ctx.shadowBlur = 7
  ctx.lineWidth = 1.7 * formationScale

  if (visual.suit === 'characters') {
    const radius = 3.4 * formationScale
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.beginPath()
    ctx.moveTo(radius, 0)
    ctx.lineTo(0, radius)
    ctx.lineTo(-radius, 0)
    ctx.lineTo(0, -radius)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(-8, 0)
    ctx.lineTo(-radius, 0)
    ctx.stroke()
    ctx.restore()
  } else if (visual.suit === 'bamboo') {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.beginPath()
    ctx.moveTo(-6 * formationScale, 0)
    ctx.lineTo(5 * formationScale, 0)
    ctx.lineTo(1 * formationScale, -3 * formationScale)
    ctx.moveTo(5 * formationScale, 0)
    ctx.lineTo(1 * formationScale, 3 * formationScale)
    ctx.stroke()
    ctx.restore()
  } else {
    for (const radius of [2.1, 4.1 * formationScale]) {
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  if (visual.formation === 'pair') {
    ctx.beginPath()
    ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.stroke()
  } else if (visual.formation === 'pung') {
    for (const offset of [-4, 0, 4]) {
      ctx.beginPath()
      ctx.arc(x + offset, y + 6, 1.2, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (visual.formation === 'kong') {
    for (const [offsetX, offsetY] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
      ctx.strokeRect(x + offsetX - 1, y + offsetY - 1, 2, 2)
    }
  }

  if (visual.attachments.includes('red')) {
    ctx.strokeStyle = '#ff593d'
    ctx.fillStyle = '#ff7a3d'
    ctx.shadowColor = 'rgba(255, 73, 26, 0.92)'
    ctx.shadowBlur = 7
    ctx.beginPath()
    ctx.arc(x, y, 7.5 * formationScale, Math.PI * 0.1, Math.PI * 0.9)
    ctx.stroke()
    const directionX = Math.cos(angle)
    const directionY = Math.sin(angle)
    const normalX = -directionY
    const normalY = directionX
    ctx.beginPath()
    ctx.moveTo(x - directionX * 4, y - directionY * 4)
    ctx.bezierCurveTo(
      x - directionX * 8 + normalX * 2,
      y - directionY * 8 + normalY * 2,
      x - directionX * 11 - normalX * 2,
      y - directionY * 11 - normalY * 2,
      x - directionX * 15,
      y - directionY * 15
    )
    ctx.stroke()
    for (const [distance, side, radius] of [[8, 2, 1.2], [12, -2, .9]] as const) {
      ctx.beginPath()
      ctx.arc(
        x - directionX * distance + normalX * side,
        y - directionY * distance + normalY * side,
        radius,
        0,
        Math.PI * 2
      )
      ctx.fill()
    }
  }
  if (visual.attachments.includes('green')) {
    ctx.strokeStyle = '#31c878'
    ctx.strokeRect(x - 6.5 * formationScale, y - 6.5 * formationScale, 13 * formationScale, 13 * formationScale)
  }
  ctx.restore()
}

function drawBullet(
  ctx: CanvasRenderingContext2D,
  bullet: Bullet,
  gameTime: number
) {
  if (bullet.mahjongVisual) {
    const presentations = getMahjongProjectilePresentations(bullet, gameTime)
    presentations.forEach(presentation => {
      drawMahjongBulletCore(
        ctx,
        bullet,
        presentation.x,
        presentation.y,
        presentation.alpha
      )
    })
    return
  }

  const color = bullet.damageType === 'magic'
    ? '#62e7ff'
    : bullet.damageType === 'pure'
      ? '#ff78d4'
      : '#ffd44f'

  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = 6
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(bullet.position.x, bullet.position.y, 2.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawAngularShockWave(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number
) {
  ctx.beginPath()
  for (let index = 0; index < 16; index += 1) {
    const angle = index * Math.PI / 8
    const pointRadius = index % 2 === 0 ? radius : radius * .72
    const pointX = x + Math.cos(angle) * pointRadius
    const pointY = y + Math.sin(angle) * pointRadius
    if (index === 0) ctx.moveTo(pointX, pointY)
    else ctx.lineTo(pointX, pointY)
  }
  ctx.closePath()
  ctx.stroke()
}

function drawMahjongImpactEvent(
  ctx: CanvasRenderingContext2D,
  event: MahjongPresentationEvent,
  gameTime: number
) {
  const elapsedMs = Math.max(
    event.elapsedMs,
    Math.max(0, gameTime - event.startedAtGameTimeMs)
  )
  if (elapsedMs >= event.durationMs) return

  const activeEvent = { ...event, elapsedMs }
  const progresses = getMahjongImpactPulseProgresses(activeEvent)
  const colors = MAHJONG_SUIT_COLORS[event.suit]

  ctx.save()
  ctx.strokeStyle = colors.core
  ctx.fillStyle = colors.core
  ctx.shadowColor = colors.glow
  ctx.shadowBlur = event.formation === 'kong' ? 12 : 7
  ctx.lineWidth = event.formation === 'kong' ? 2.8 : 1.7
  progresses.forEach(progress => {
    ctx.globalAlpha = 1 - progress
    const radius = event.formation === 'kong'
      ? 8 + progress * 26
      : 4 + progress * 17
    ctx.beginPath()
    ctx.arc(event.position.x, event.position.y, radius, 0, Math.PI * 2)
    ctx.stroke()
    if (progress < .22) {
      ctx.beginPath()
      ctx.arc(event.position.x, event.position.y, 3.6 - progress * 8, 0, Math.PI * 2)
      ctx.fill()
    }
    if (event.formation === 'kong') {
      ctx.beginPath()
      ctx.arc(event.position.x, event.position.y, radius * .68, 0, Math.PI * 2)
      ctx.stroke()
    }
  })
  ctx.restore()

  if (event.attachments.includes('red') && elapsedMs < 360) {
    const progress = clamp01(elapsedMs / 360)
    ctx.save()
    ctx.globalAlpha = 1 - progress
    ctx.strokeStyle = '#ff593d'
    ctx.fillStyle = '#ff7a3d'
    ctx.shadowColor = 'rgba(255, 73, 26, 0.9)'
    ctx.shadowBlur = 8
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(
      event.position.x,
      event.position.y,
      7 + progress * 21,
      0,
      Math.PI * 2
    )
    ctx.stroke()
    for (const angle of [-Math.PI * .75, -Math.PI / 2, -Math.PI * .25]) {
      const distance = 7 + progress * 15
      ctx.beginPath()
      ctx.arc(
        event.position.x + Math.cos(angle) * distance,
        event.position.y + Math.sin(angle) * distance,
        1.7 - progress,
        0,
        Math.PI * 2
      )
      ctx.fill()
    }
    ctx.restore()
  }

  if (
    event.executed
    && event.suit === 'characters'
    && event.attachments.includes('green')
    && elapsedMs < 460
  ) {
    const progress = clamp01(elapsedMs / 460)
    ctx.save()
    ctx.globalAlpha = 1 - progress
    ctx.strokeStyle = '#38d681'
    ctx.fillStyle = '#38d681'
    ctx.shadowColor = 'rgba(57, 226, 137, 0.9)'
    ctx.shadowBlur = 8
    ctx.lineWidth = 1.7
    const sealRadius = 13 - progress * 5
    ctx.strokeRect(
      event.position.x - sealRadius,
      event.position.y - sealRadius,
      sealRadius * 2,
      sealRadius * 2
    )
    ctx.font = "900 12px KaiTi, STKaiti, 'Songti SC', serif"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('發', event.position.x, event.position.y)
    ctx.strokeStyle = '#ffd45a'
    ctx.shadowColor = 'rgba(255, 211, 68, 0.94)'
    ctx.shadowBlur = 10
    ctx.lineWidth = 3
    const slashOffset = 18 * (1 - progress)
    ctx.beginPath()
    ctx.moveTo(event.position.x - 15 - slashOffset, event.position.y + 13)
    ctx.lineTo(event.position.x + 15 - slashOffset, event.position.y - 13)
    ctx.stroke()
    ctx.restore()
  }

  if (
    event.stunTriggered
    && event.suit === 'dots'
    && event.attachments.includes('green')
    && elapsedMs < 420
  ) {
    const progress = clamp01(elapsedMs / 420)
    ctx.save()
    ctx.globalAlpha = 1 - progress
    ctx.strokeStyle = '#38d681'
    ctx.shadowColor = 'rgba(57, 226, 137, 0.86)'
    ctx.shadowBlur = 7
    ctx.lineWidth = 1.7
    const sealRadius = 18 - progress * 12
    ctx.strokeRect(
      event.position.x - sealRadius,
      event.position.y - sealRadius,
      sealRadius * 2,
      sealRadius * 2
    )
    ctx.strokeStyle = '#f7fff0'
    ctx.shadowColor = 'rgba(255, 255, 255, 0.92)'
    ctx.shadowBlur = 9
    ctx.lineWidth = 2
    drawAngularShockWave(
      ctx,
      event.position.x,
      event.position.y,
      8 + progress * 22
    )
    ctx.restore()
  }
}

function drawDamageNumber(
  ctx: CanvasRenderingContext2D,
  damageNumber: DamageNumber
) {
  const presentation = getDamageNumberPresentation(damageNumber)

  ctx.save()
  ctx.globalAlpha = presentation.opacity
  ctx.translate(presentation.x, presentation.y)
  ctx.scale(presentation.scale, presentation.scale)
  ctx.font = `900 ${presentation.fontSize}px ui-rounded, 'PingFang SC', 'Microsoft YaHei', sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.lineWidth = presentation.lineWidth
  ctx.strokeStyle = presentation.stroke
  ctx.fillStyle = presentation.fill
  ctx.shadowColor = presentation.shadow
  ctx.shadowBlur = damageNumber.critical ? 6 : 4
  ctx.strokeText(presentation.text, 0, 0)
  ctx.shadowBlur = 1.5
  ctx.fillText(presentation.text, 0, 0)
  ctx.restore()
}

export function renderGameScene(
  ctx: CanvasRenderingContext2D,
  scene: CanvasScene,
  options: CanvasRendererOptions = {}
) {
  const { cols, rows, cellSize } = MAP_CONFIG
  const resolveImage = options.resolveImage ?? resolveSprite
  ctx.clearRect(0, 0, cols * cellSize, rows * cellSize)

  drawGrid(ctx, scene.grid, resolveImage)
  drawPath(
    ctx,
    scene.currentPath,
    scene.placementPreview ? MUTED_PATH_STYLE : CURRENT_PATH_STYLE
  )
  if (scene.placementPreview?.path) {
    drawPath(
      ctx,
      scene.placementPreview.path,
      PREVIEW_PATH_STYLES[scene.placementPreview.status]
    )
  }
  drawWaypointMarkers(ctx)
  drawGates(ctx, resolveImage)
  drawObstacles(ctx, scene.grid, resolveImage)
  scene.enemies.forEach(enemy => {
    if (!enemy.reachedEnd) drawEnemy(ctx, enemy, resolveImage)
  })
  scene.towers.forEach(tower => drawTower(
    ctx,
    tower,
    resolveImage,
    scene.gameTime,
    scene.mahjongBambooFocus?.get(tower.id)
  ))
  if (scene.placementPreview) {
    drawPlacementPreview(ctx, scene.placementPreview)
  }
  scene.bullets.forEach(bullet => drawBullet(ctx, bullet, scene.gameTime))
  scene.mahjongPresentationEvents?.forEach(event => (
    drawMahjongImpactEvent(ctx, event, scene.gameTime)
  ))
  scene.damageNumbers.forEach(damageNumber => drawDamageNumber(ctx, damageNumber))
}
