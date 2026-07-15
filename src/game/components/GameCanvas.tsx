import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { MAP_CONFIG } from '../config/map'
import { preloadSpriteAssets } from '../rendering/spriteRegistry'
import {
  beginPlacementPointer,
  createPlacementPointerState,
  finishPlacementPointer,
  isPrimaryPlacementPointer,
  selectPlacementPreviewCell,
  screenPointToGrid
} from './canvasPointer'

interface GridPosition {
  row: number
  col: number
}

interface GameCanvasProps {
  width?: number
  height?: number
  onClick?: (gridPos: GridPosition) => void
  onPlacementPreview?: (gridPos: GridPosition) => void
  onPlacementPreviewEnd?: () => void
}

export function GameCanvas({
  width = MAP_CONFIG.cols * MAP_CONFIG.cellSize,
  height = MAP_CONFIG.rows * MAP_CONFIG.cellSize,
  onClick,
  onPlacementPreview,
  onPlacementPreviewEnd
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const placementPointerStateRef = useRef(createPlacementPointerState())

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

  const getGridPosition = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    return screenPointToGrid(
      clientX,
      clientY,
      {
        left: rect.left + canvas.clientLeft,
        top: rect.top + canvas.clientTop,
        width: canvas.clientWidth,
        height: canvas.clientHeight
      },
      width,
      height
    )
  }, [height, width])

  const endPlacementPreview = useCallback((
    cancelled: boolean,
    pointerId: number | null = null
  ) => {
    const result = finishPlacementPointer(
      placementPointerStateRef.current,
      pointerId,
      cancelled
    )
    placementPointerStateRef.current = result.state
    if (!result.ended) return false
    onPlacementPreviewEnd?.()
    return result.shouldCommit
  }, [onPlacementPreviewEnd])

  useEffect(() => {
    const handleWindowBlur = () => endPlacementPreview(true)
    window.addEventListener('blur', handleWindowBlur)
    return () => window.removeEventListener('blur', handleWindowBlur)
  }, [endPlacementPreview])

  const updatePlacementPreview = (
    event: ReactPointerEvent<HTMLCanvasElement>
  ) => {
    const gridPosition = getGridPosition(event.clientX, event.clientY)
    if (!gridPosition) {
      endPlacementPreview(true, event.pointerId)
      return
    }

    const selection = selectPlacementPreviewCell(
      placementPointerStateRef.current,
      event.pointerId,
      gridPosition
    )
    placementPointerStateRef.current = selection.state
    if (!selection.changed) return

    onPlacementPreview?.(gridPosition)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (
      (!onPlacementPreview && !onClick)
      || !isPrimaryPlacementPointer(event.isPrimary, event.button)
    ) {
      return
    }

    placementPointerStateRef.current = beginPlacementPointer(event.pointerId)
    event.currentTarget.focus({ preventScroll: true })
    updatePlacementPreview(event)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (placementPointerStateRef.current.activePointerId !== event.pointerId) return
    updatePlacementPreview(event)
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (placementPointerStateRef.current.activePointerId !== event.pointerId) return
    const gridPosition = getGridPosition(event.clientX, event.clientY)
    const shouldCommit = endPlacementPreview(!gridPosition, event.pointerId)
    if (shouldCommit && gridPosition) onClick?.(gridPosition)
  }

  const handlePointerCancel = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (placementPointerStateRef.current.activePointerId !== event.pointerId) return
    endPlacementPreview(true, event.pointerId)
  }

  return (
    <canvas
      ref={canvasRef}
      id="game-canvas"
      className="game-canvas"
      role="img"
      aria-label="8列10行麻将塔防地图。从下方牌槽拖动暗牌到空格，落地立即翻牌；牌墙会持续占据格子。"
      tabIndex={0}
      onBlur={() => endPlacementPreview(true)}
      onContextMenu={event => event.preventDefault()}
      onLostPointerCapture={() => endPlacementPreview(true)}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerLeave={event => {
        if (placementPointerStateRef.current.activePointerId === event.pointerId) {
          endPlacementPreview(true, event.pointerId)
        }
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  )
}
