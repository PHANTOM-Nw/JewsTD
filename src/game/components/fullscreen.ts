import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'

export interface FullscreenState {
  isSupported: boolean
  isFullscreen: boolean
}

export interface FullscreenControl extends FullscreenState {
  toggleFullscreen: () => void
}

export function readFullscreenState(
  fullscreenDocument: Document,
  target: HTMLElement
): FullscreenState {
  return {
    isSupported: Boolean(
      fullscreenDocument.fullscreenEnabled
      && typeof target.requestFullscreen === 'function'
      && typeof fullscreenDocument.exitFullscreen === 'function'
    ),
    isFullscreen: fullscreenDocument.fullscreenElement === target
  }
}

export function subscribeToFullscreenChange(
  fullscreenDocument: Document,
  listener: () => void
) {
  fullscreenDocument.addEventListener('fullscreenchange', listener)
  return () => fullscreenDocument.removeEventListener('fullscreenchange', listener)
}

export async function toggleElementFullscreen(
  fullscreenDocument: Document,
  target: HTMLElement
) {
  try {
    if (fullscreenDocument.fullscreenElement === target) {
      await fullscreenDocument.exitFullscreen()
    } else {
      await target.requestFullscreen({ navigationUI: 'hide' })
    }
    return true
  } catch {
    return false
  }
}

const INITIAL_FULLSCREEN_STATE: FullscreenState = {
  isSupported: false,
  isFullscreen: false
}

export function useElementFullscreen(
  targetRef: RefObject<HTMLElement | null>
): FullscreenControl {
  const [state, setState] = useState(INITIAL_FULLSCREEN_STATE)

  useEffect(() => {
    const target = targetRef.current
    if (!target || typeof document === 'undefined') return

    const syncState = () => setState(readFullscreenState(document, target))
    syncState()
    return subscribeToFullscreenChange(document, syncState)
  }, [targetRef])

  const toggleFullscreen = useCallback(() => {
    const target = targetRef.current
    if (!target || typeof document === 'undefined') return

    void toggleElementFullscreen(document, target)
  }, [targetRef])

  return { ...state, toggleFullscreen }
}
