import React, { useRef, useEffect } from 'react'
import { MAP_CONFIG, WAYPOINTS } from '../config/map'
import { screenPointToGrid } from './canvasPointer'

interface GameCanvasProps {
  width?: number
  height?: number
  onClick?: (gridPos: { row: number; col: number }) => void
  currentPath?: { row: number; col: number }[] | null  // 当前路径(用于可视化)
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  width = MAP_CONFIG.cols * MAP_CONFIG.cellSize,
  height = MAP_CONFIG.rows * MAP_CONFIG.cellSize,
  onClick,
  currentPath
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 当路径变化时,重新绘制路径
  useEffect(() => {
    if (!canvasRef.current || !currentPath || currentPath.length === 0) return
    
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    
    const { cellSize } = MAP_CONFIG
    
    // 绘制路径(半透明红色虚线)
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])  // 虚线
    
    ctx.beginPath()
    currentPath.forEach((pos, index) => {
      const x = pos.col * cellSize + cellSize / 2
      const y = pos.row * cellSize + cellSize / 2
      
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()
    
    ctx.setLineDash([])  // 恢复实线
    
    console.log(`🛤️ 路径已绘制,共${currentPath.length}个点`)
  }, [currentPath])

  // 绘制必经点标记
  useEffect(() => {
    if (!canvasRef.current) return
    
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    
    const { cellSize } = MAP_CONFIG
    
    console.log(`📍 开始绘制${WAYPOINTS.length}个必经点`)
    
    // 为每个必经点绘制不同颜色的标记
    WAYPOINTS.forEach((waypoint, index) => {
      const x = waypoint.col * cellSize + cellSize / 2
      const y = waypoint.row * cellSize + cellSize / 2
      
      console.log(`  第${index}个: ${waypoint.label} at (${waypoint.row}, ${waypoint.col}) → canvas(${x}, ${y})`)
      
      // 根据类型选择颜色
      let color: string
      let radius: number
      
      if (index === 0) {
        // 起点 - 绿色大圆
        color = '#90EE90'
        radius = 12
      } else if (index === WAYPOINTS.length - 1) {
        // 终点 - 红色大圆
        color = '#FF6B6B'
        radius = 12
      } else if (waypoint.label === '矿坑') {
        // 矿坑 - 黄色中圆
        color = '#FFD700'
        radius = 10
      } else {
        // 转折点 - 蓝色小圆
        color = '#4169E1'
        radius = 8
      }
      
      // 绘制圆形标记
      ctx.fillStyle = color
      ctx.globalAlpha = 0.7  // 半透明
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
      
      // 绘制边框
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 2
      ctx.globalAlpha = 1.0
      ctx.stroke()
      
      // 绘制标签文字(索引数字)
      ctx.fillStyle = '#000000'
      ctx.font = 'bold 10px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${index}`, x, y)
      
      // 如果有label,在下方显示
      if (waypoint.label) {
        ctx.fillStyle = '#333333'
        ctx.font = '9px Arial'
        ctx.fillText(waypoint.label, x, y + radius + 10)
      }
    })
    
    console.log(`✅ 必经点已绘制,共${WAYPOINTS.length}个`)
  }, [])

  useEffect(() => {
    if (canvasRef.current) {
      // 适配高分辨率屏幕
      const dpr = window.devicePixelRatio || 1
      canvasRef.current.width = width * dpr
      canvasRef.current.height = height * dpr
      
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
      }
    }
  }, [width, height])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onClick || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const contentRect = {
      left: rect.left + canvas.clientLeft,
      top: rect.top + canvas.clientTop,
      width: canvas.clientWidth,
      height: canvas.clientHeight
    }
    const gridPosition = screenPointToGrid(e.clientX, e.clientY, contentRect, width, height)
    if (!gridPosition) return

    const { row, col } = gridPosition
    
    // 边界检查
    if (row >= 0 && row < MAP_CONFIG.rows && col >= 0 && col < MAP_CONFIG.cols) {
      onClick({ row, col })
    }
  }

  return (
    <canvas
      ref={canvasRef}
      id="game-canvas"
      onClick={handleClick}
      style={{
        border: '2px solid #333',
        cursor: 'pointer',
        display: 'block',
        width: '100%',
        maxWidth: `${width}px`,
        height: 'auto',
        aspectRatio: `${width} / ${height}`,
        touchAction: 'manipulation'
      }}
    />
  )
}
