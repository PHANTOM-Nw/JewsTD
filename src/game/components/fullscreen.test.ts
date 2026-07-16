import { describe, expect, it, vi } from 'vitest'
import {
  readFullscreenState,
  subscribeToFullscreenChange,
  toggleElementFullscreen
} from './fullscreen'

interface FullscreenMocks {
  document: Document
  target: HTMLElement
  setFullscreenElement: (element: Element | null) => void
  dispatchFullscreenChange: () => void
  requestFullscreen: ReturnType<typeof vi.fn>
  exitFullscreen: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
}

function createFullscreenMocks(enabled = true): FullscreenMocks {
  let fullscreenElement: Element | null = null
  let fullscreenChangeListener: (() => void) | null = null
  const requestFullscreen = vi.fn(() => Promise.resolve())
  const exitFullscreen = vi.fn(() => Promise.resolve())
  const addEventListener = vi.fn((type: string, listener: () => void) => {
    if (type === 'fullscreenchange') fullscreenChangeListener = listener
  })
  const removeEventListener = vi.fn((type: string, listener: () => void) => {
    if (type === 'fullscreenchange' && fullscreenChangeListener === listener) {
      fullscreenChangeListener = null
    }
  })
  const target = { requestFullscreen } as unknown as HTMLElement
  const fullscreenDocument = {
    fullscreenEnabled: enabled,
    get fullscreenElement() {
      return fullscreenElement
    },
    exitFullscreen,
    addEventListener,
    removeEventListener
  } as unknown as Document

  return {
    document: fullscreenDocument,
    target,
    setFullscreenElement: element => { fullscreenElement = element },
    dispatchFullscreenChange: () => fullscreenChangeListener?.(),
    requestFullscreen,
    exitFullscreen,
    removeEventListener
  }
}

describe('fullscreen helpers', () => {
  it('reports support only when the standard Fullscreen API is enabled', () => {
    const supported = createFullscreenMocks()
    const unsupported = createFullscreenMocks(false)

    expect(readFullscreenState(supported.document, supported.target)).toEqual({
      isSupported: true,
      isFullscreen: false
    })
    expect(readFullscreenState(unsupported.document, unsupported.target).isSupported).toBe(false)
  })

  it('requests and exits fullscreen through the game element', async () => {
    const mocks = createFullscreenMocks()

    await expect(toggleElementFullscreen(mocks.document, mocks.target)).resolves.toBe(true)
    expect(mocks.requestFullscreen).toHaveBeenCalledWith({ navigationUI: 'hide' })
    expect(mocks.exitFullscreen).not.toHaveBeenCalled()

    mocks.setFullscreenElement(mocks.target)
    await expect(toggleElementFullscreen(mocks.document, mocks.target)).resolves.toBe(true)
    expect(mocks.exitFullscreen).toHaveBeenCalledOnce()
  })

  it('absorbs denied request and exit promises', async () => {
    const requestMocks = createFullscreenMocks()
    requestMocks.requestFullscreen.mockRejectedValueOnce(new Error('denied'))

    await expect(toggleElementFullscreen(requestMocks.document, requestMocks.target))
      .resolves.toBe(false)

    const exitMocks = createFullscreenMocks()
    exitMocks.setFullscreenElement(exitMocks.target)
    exitMocks.exitFullscreen.mockRejectedValueOnce(new Error('denied'))

    await expect(toggleElementFullscreen(exitMocks.document, exitMocks.target))
      .resolves.toBe(false)
  })

  it('tracks browser-driven entry and exit through fullscreenchange', () => {
    const mocks = createFullscreenMocks()
    const states: boolean[] = []
    const sync = () => {
      states.push(readFullscreenState(mocks.document, mocks.target).isFullscreen)
    }
    const unsubscribe = subscribeToFullscreenChange(mocks.document, sync)

    sync()
    mocks.setFullscreenElement(mocks.target)
    mocks.dispatchFullscreenChange()
    mocks.setFullscreenElement(null)
    mocks.dispatchFullscreenChange()
    unsubscribe()

    expect(states).toEqual([false, true, false])
    expect(mocks.removeEventListener).toHaveBeenCalledWith('fullscreenchange', sync)
  })
})
