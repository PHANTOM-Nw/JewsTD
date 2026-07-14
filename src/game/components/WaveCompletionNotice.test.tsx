import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WaveCompletionNotice } from './WaveCompletionNotice'

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
})
