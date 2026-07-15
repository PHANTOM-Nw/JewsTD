import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MahjongTile } from './MahjongTile'

describe('MahjongTile', () => {
  it('renders the traditional character face and concentric one-dot face', () => {
    const character = renderToStaticMarkup(
      <MahjongTile tile={{ suit: 'characters', rank: 9 }} />
    )
    const oneDot = renderToStaticMarkup(
      <MahjongTile tile={{ suit: 'dots', rank: 1 }} />
    )

    expect(character).toContain('>九<')
    expect(character).toContain('>萬<')
    expect(oneDot.match(/<circle/g)).toHaveLength(4)
  })

  it('renders one-bamboo as a bird and crossed marks on eight-bamboo', () => {
    const oneBamboo = renderToStaticMarkup(
      <MahjongTile tile={{ suit: 'bamboo', rank: 1 }} />
    )
    const eightBamboo = renderToStaticMarkup(
      <MahjongTile tile={{ suit: 'bamboo', rank: 8 }} />
    )

    expect(oneBamboo).toContain('<path')
    expect(oneBamboo).toContain('<circle')
    expect(eightBamboo).toContain('rotate(-42')
    expect(eightBamboo).toContain('rotate(42')
  })

  it('renders red, green and framed blank honor faces', () => {
    const red = renderToStaticMarkup(<MahjongTile honor="red" />)
    const green = renderToStaticMarkup(<MahjongTile honor="green" />)
    const white = renderToStaticMarkup(<MahjongTile honor="white" />)

    expect(red).toContain('>中<')
    expect(green).toContain('>發<')
    expect(white).toContain('<rect x="8" y="8" width="24" height="38"')
    expect(white).not.toContain('白板')
  })
})
