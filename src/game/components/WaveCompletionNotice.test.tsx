import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WaveCompletionNotice } from './WaveCompletionNotice'
import {
  scheduleWaveCompletionNoticeDismissal,
  WAVE_COMPLETION_NOTICE_DURATION_MS
} from './waveCompletionNoticeLifecycle'

afterEach(() => {
  vi.useRealTimers()
})

describe('WaveCompletionNotice', () => {
  it('announces a completed wave during the following preparation phase', () => {
    const markup = renderToStaticMarkup(
      <WaveCompletionNotice gameStatus="building" currentWave={1} />
    )

    expect(markup).toContain('role="status"')
    expect(markup).toContain('第 1 波完成！')
    expect(markup).toContain('准备迎接第 2 波')
  })

  it('stays hidden before the first wave and while a wave is active', () => {
    expect(renderToStaticMarkup(
      <WaveCompletionNotice gameStatus="building" currentWave={0} />
    )).toBe('')
    expect(renderToStaticMarkup(
      <WaveCompletionNotice gameStatus="playing" currentWave={1} />
    )).toBe('')
  })

  it('dismisses itself after the completion notice duration', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()

    scheduleWaveCompletionNoticeDismissal(onDismiss)
    vi.advanceTimersByTime(WAVE_COMPLETION_NOTICE_DURATION_MS - 1)
    expect(onDismiss).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('cancels a pending dismissal when the notice lifecycle changes', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    const cancelDismissal = scheduleWaveCompletionNoticeDismissal(onDismiss)

    cancelDismissal()
    vi.runAllTimers()

    expect(onDismiss).not.toHaveBeenCalled()
  })
})
