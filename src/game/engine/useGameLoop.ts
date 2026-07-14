import { useRef, useEffect, useCallback } from 'react'

/**
 * 游戏循环Hook
 * 使用requestAnimationFrame实现60fps游戏循环
 * @param update - 更新逻辑函数,接收deltaTime(ms)
 * @param render - 渲染函数
 * @param isRunning - 是否运行
 */
export function useGameLoop(
  update: (deltaTime: number) => void,
  render: () => void,
  isRunning: boolean
) {
  const requestRef = useRef<number | null>(null)
  const previousTimeRef = useRef<number | null>(null)
  const updateRef = useRef<(deltaTime: number) => void>(update)
  const renderRef = useRef<() => void>(render)

  // 保持最新的update和render引用
  useEffect(() => {
    updateRef.current = update
    renderRef.current = render
  }, [update, render])

  // 动画循环函数
  const animate = useCallback((time: number) => {
    if (!isRunning) return

    if (previousTimeRef.current !== null) {
      const deltaTime = time - previousTimeRef.current
      
      // 限制最大deltaTime避免卡顿后跳跃
      const clampedDeltaTime = Math.min(deltaTime, 100)
      
      // 执行更新和渲染
      updateRef.current(clampedDeltaTime)
      renderRef.current()
    }
    
    previousTimeRef.current = time
    requestRef.current = requestAnimationFrame(animate)
  }, [isRunning])

  // 启动/停止游戏循环
  useEffect(() => {
    if (isRunning) {
      requestRef.current = requestAnimationFrame(animate)
    } else {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
      previousTimeRef.current = null
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
    }
  }, [isRunning, animate])

  // 暴露控制方法
  const start = useCallback(() => {
    if (!requestRef.current) {
      previousTimeRef.current = null
      requestRef.current = requestAnimationFrame(animate)
    }
  }, [animate])

  const stop = useCallback(() => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current)
      requestRef.current = null
      previousTimeRef.current = null
    }
  }, [])

  const pause = useCallback(() => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current)
      requestRef.current = null
    }
  }, [])

  const resume = useCallback(() => {
    if (!requestRef.current && isRunning) {
      previousTimeRef.current = null
      requestRef.current = requestAnimationFrame(animate)
    }
  }, [isRunning, animate])

  return { start, stop, pause, resume }
}
