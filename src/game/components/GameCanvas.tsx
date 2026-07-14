import { useCallback, useEffect, useRef } from 'react'
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import { MAP_CONFIG } from '../config/map'
import { preloadSpriteAssets } from '../rendering/spriteRegistry'
import {
  beginPlacementPointer,
  consumePlacementClick,
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
    suppressClick: boolean,
    pointerId: number | null = null
  ) => {
    const result = finishPlacementPointer(
      placementPointerStateRef.current,
      pointerId,
      suppressClick
    )
    placementPointerStateRef.current = result.state
    if (!result.ended) return
    onPlacementPreviewEnd?.()
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
      !onPlacementPreview
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
    endPlacementPreview(false, event.pointerId)
  }

  const handlePointerCancel = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (placementPointerStateRef.current.activePointerId !== event.pointerId) return
    endPlacementPreview(true, event.pointerId)
  }

  const handleClick = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    const click = consumePlacementClick(placementPointerStateRef.current)
    placementPointerStateRef.current = click.state
    if (!click.shouldCommit) return

    if (!onClick) return
    const gridPosition = getGridPosition(event.clientX, event.clientY)

    if (gridPosition) onClick(gridPosition)
  }

  return (
    <canvas
      ref={canvasRef}
      id="game-canvas"
      className="game-canvas"
      role="img"
      aria-label="8列10行宝石塔防地图。按住或拖动空格预览落塔后的路线，松开建塔；点击塔查看合成，备战时点击障碍可清除。"
      tabIndex={0}
      onBlur={() => endPlacementPreview(true)}
      onClick={handleClick}
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
