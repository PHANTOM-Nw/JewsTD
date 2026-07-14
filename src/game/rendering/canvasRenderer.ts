import type {
  Bullet,
  Enemy,
  EnemyType,
  GridCell,
  Tower
} from '../types/game'
import { MAP_CONFIG, WAYPOINTS } from '../config/map'
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
  enemies: Enemy[]
  towers: Tower[]
  bullets: Bullet[]
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
  path: CanvasScene['currentPath']
) {
  if (!path || path.length === 0) return

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  path.forEach((point, index) => {
    const { x, y } = cellCenter(point.row, point.col)
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.strokeStyle = 'rgba(55, 220, 225, 0.28)'
  ctx.lineWidth = 10
  ctx.shadowColor = 'rgba(46, 218, 225, 0.82)'
  ctx.shadowBlur = 8
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.strokeStyle = '#73f4ed'
  ctx.lineWidth = 3.4
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
  drawSprite(ctx, resolveImage(GATE_SPRITES.entrance), start.x, start.y, 45)
  drawSprite(ctx, resolveImage(GATE_SPRITES.exit), end.x, end.y, 45)
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

export function renderGameScene(
  ctx: CanvasRenderingContext2D,
  scene: CanvasScene,
  options: CanvasRendererOptions = {}
) {
  const { cols, rows, cellSize } = MAP_CONFIG
  const resolveImage = options.resolveImage ?? resolveSprite
  ctx.clearRect(0, 0, cols * cellSize, rows * cellSize)

  drawGrid(ctx, scene.grid, resolveImage)
  drawPath(ctx, scene.currentPath)
  drawWaypointMarkers(ctx)
  drawGates(ctx, resolveImage)
  drawObstacles(ctx, scene.grid, resolveImage)
  scene.enemies.forEach(enemy => {
    if (!enemy.reachedEnd) drawEnemy(ctx, enemy, resolveImage)
  })
  scene.towers.forEach(tower => drawTower(ctx, tower, resolveImage))
  scene.bullets.forEach(bullet => drawBullet(ctx, bullet))
}
