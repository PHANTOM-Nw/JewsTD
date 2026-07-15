import type {
  Bullet,
  DamageNumber,
  Enemy,
  GridCell,
  MahjongNumberTile,
  PlacementPreview,
  PlacementPreviewStatus,
  Tower
} from '../types/game'
import { ENEMY_TYPES } from '../config/enemies'
import {
  MAHJONG_BAMBOO_LAYOUTS,
  MAHJONG_CHARACTER_NUMERALS,
  MAHJONG_DOT_LAYOUTS
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

function drawMahjongFace(
  ctx: CanvasRenderingContext2D,
  tile: Pick<MahjongNumberTile, 'suit' | 'rank'>
) {
  if (tile.suit === 'characters') {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = "800 18px KaiTi, STKaiti, 'Songti SC', serif"
    ctx.fillStyle = '#18212b'
    ctx.fillText(MAHJONG_CHARACTER_NUMERALS[tile.rank], 20, 18)
    ctx.fillStyle = MAHJONG_MARK_COLORS.red
    ctx.fillText('萬', 20, 39)
    return
  }

  if (tile.suit === 'dots') {
    drawMahjongDotFace(ctx, tile.rank, MAHJONG_DOT_LAYOUTS[tile.rank])
    return
  }

  drawMahjongBambooFace(ctx, MAHJONG_BAMBOO_LAYOUTS[tile.rank])
}

function drawMahjongTileBody(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  height: number,
  tile: Pick<MahjongNumberTile, 'suit' | 'rank'>
) {
  const width = height * MAHJONG_TILE_ASPECT_RATIO

  ctx.save()
  ctx.translate(centerX - width / 2, centerY - height / 2)
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
  drawMahjongFace(ctx, tile)
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
  drawMahjongTileBody(ctx, centerX, centerY - 2, MAHJONG_WALL_FACE_HEIGHT, tile)
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

function drawTower(
  ctx: CanvasRenderingContext2D,
  tower: Tower,
  resolveImage: SpriteResolver
) {
  if (tower.mahjongTile) {
    const qualityScale = {
      chipped: 0.92,
      flawed: 0.96,
      normal: 1,
      flawless: 1.04
    }[tower.level]
    drawMahjongTileBody(
      ctx,
      tower.position.x,
      tower.position.y,
      MAHJONG_TOWER_HEIGHT * qualityScale,
      tower.mahjongTile
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

  if ((enemy.poisonEffects?.length ?? 0) > 0) {
    ctx.save()
    ctx.strokeStyle = 'rgba(82, 214, 77, 0.9)'
    ctx.lineWidth = 1.6
    ctx.setLineDash([2, 2])
    ctx.beginPath()
    ctx.arc(enemy.position.x, enemy.position.y, size * 0.57, 0, Math.PI * 2)
    ctx.stroke()
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

function drawBullet(ctx: CanvasRenderingContext2D, bullet: Bullet) {
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
  scene.towers.forEach(tower => drawTower(ctx, tower, resolveImage))
  if (scene.placementPreview) {
    drawPlacementPreview(ctx, scene.placementPreview)
  }
  scene.bullets.forEach(bullet => drawBullet(ctx, bullet))
  scene.damageNumbers.forEach(damageNumber => drawDamageNumber(ctx, damageNumber))
}
