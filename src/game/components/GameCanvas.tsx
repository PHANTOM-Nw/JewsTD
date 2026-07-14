import { useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
import { MAP_CONFIG } from '../config/map'
import { preloadSpriteAssets } from '../rendering/spriteRegistry'
import { screenPointToGrid } from './canvasPointer'

interface GameCanvasProps {
  width?: number
  height?: number
  onClick?: (gridPos: { row: number; col: number }) => void
}

export function GameCanvas({
  width = MAP_CONFIG.cols * MAP_CONFIG.cellSize,
  height = MAP_CONFIG.rows * MAP_CONFIG.cellSize,
  onClick
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    preloadSpriteAssets()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr

    const ctx = canvas.getContext('2d')
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [width, height])

  const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!onClick || !canvas) return

    const rect = canvas.getBoundingClientRect()
    const gridPosition = screenPointToGrid(
      event.clientX,
      event.clientY,
      {
        left: rect.left + canvas.clientLeft,
        top: rect.top + canvas.clientTop,
        width: canvas.clientWidth,
        height: canvas.clientHeight
      },
      width,
      height
    )

    if (gridPosition) onClick(gridPosition)
  }

  return (
    <canvas
      ref={canvasRef}
      id="game-canvas"
      className="game-canvas"
      role="img"
      aria-label="8列10行宝石塔防地图。点击空格建塔，点击塔查看合成，备战时点击障碍可清除。"
      tabIndex={0}
      onClick={handleClick}
    />
  )
}
