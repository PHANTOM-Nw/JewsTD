import type {
  Bullet,
  DamageNumber,
  Enemy,
  EnemyType,
  GridCell,
  PlacementPreview,
  PlacementPreviewStatus,
  Tower
} from '../types/game'
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

const ENEMY_DRAW_SIZES: Record<EnemyType, number> = {
  basic: 25,
  fast: 23,
  tank: 31,
  boss: 38
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

  // 候选格只表达“这里会被占用”，不使用任何塔或障碍素材，
  // 避免玩家把预览轮廓误认为即将生成的宝石种类或品质。
  ctx.translate(center.x, center.y + 1)
  ctx.shadowColor = 'rgba(54, 52, 48, 0.32)'
  ctx.shadowBlur = 4
  ctx.fillStyle = 'rgba(70, 68, 63, 0.22)'
  ctx.beginPath()
  ctx.ellipse(0, 10, 13, 4, 0, 0, Math.PI * 2)
  ctx.fill()

  const blocks = [
    { x: -13, y: -2, width: 12, height: 11 },
    { x: 1, y: -2, width: 12, height: 11 },
    { x: -7, y: -12, width: 14, height: 10 }
  ]
  blocks.forEach(block => {
    roundedRect(ctx, block.x, block.y, block.width, block.height, 3)
    ctx.fillStyle = '#aaa69d'
    ctx.strokeStyle = '#66635d'
    ctx.lineWidth = 1.2
    ctx.fill()
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(block.x + 2.5, block.y + 2.5)
    ctx.lineTo(block.x + block.width - 2.5, block.y + 2.5)
    ctx.strokeStyle = 'rgba(249, 246, 237, 0.72)'
    ctx.lineWidth = 1
    ctx.stroke()
  })

  ctx.translate(-center.x, -center.y - 1)
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
  const size = ENEMY_DRAW_SIZES[enemy.type]
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
