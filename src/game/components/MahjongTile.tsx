import type { CSSProperties } from 'react'
import {
  MAHJONG_BAMBOO_LAYOUTS,
  MAHJONG_CHARACTER_NUMERALS,
  MAHJONG_DOT_LAYOUTS,
  MAHJONG_HONOR_LABELS,
  MAHJONG_SUIT_LABELS
} from '../config/mahjong'
import type { FaceMark } from '../config/mahjong'
import type {
  MahjongHonor,
  MahjongNumberTile,
  MahjongSuit
} from '../types/game'

interface MahjongTileProps {
  tile?: Pick<MahjongNumberTile, 'suit' | 'rank'>
  honor?: MahjongHonor
  faceDown?: boolean
  knownSuit?: MahjongSuit
  compact?: boolean
  className?: string
  style?: CSSProperties
}

const MARK_COLORS = {
  red: '#c83228',
  green: '#208653',
  blue: '#24589a'
} as const

function DotFace({
  rank,
  marks
}: {
  rank: MahjongNumberTile['rank']
  marks: readonly FaceMark[]
}) {
  if (rank === 1) {
    return (
      <g transform="translate(20 27)">
        <circle r="8.4" fill="none" stroke={MARK_COLORS.blue} strokeWidth="2.2" />
        <circle r="6.1" fill="none" stroke={MARK_COLORS.green} strokeWidth="2" />
        <circle r="3.8" fill="none" stroke={MARK_COLORS.red} strokeWidth="2" />
        <circle r="1.4" fill={MARK_COLORS.green} />
      </g>
    )
  }

  const radius = marks.length >= 8 ? 2.6 : 3.6
  return marks.map((faceMark, index) => (
    <g key={`${faceMark.x}-${faceMark.y}-${index}`}>
      <circle
        cx={faceMark.x * 40}
        cy={faceMark.y * 54}
        r={radius}
        fill="none"
        stroke={MARK_COLORS[faceMark.color]}
        strokeWidth={radius > 5 ? 3 : 1.7}
      />
      <circle
        cx={faceMark.x * 40}
        cy={faceMark.y * 54}
        r={Math.max(1.1, radius * .28)}
        fill={MARK_COLORS[faceMark.color]}
      />
    </g>
  ))
}

function BirdFace() {
  return (
    <g transform="translate(20 28)">
      <path d="M-8 6 C-8-2-3-10 4-11 C9-11 11-6 9-2 C7 2 3 4-1 5 L-1 12" fill="none" stroke="#208653" strokeWidth="3" strokeLinecap="round" />
      <path d="M-4-3 C0-1 4-1 7-4" fill="none" stroke="#c83228" strokeWidth="2" strokeLinecap="round" />
      <circle cx="5" cy="-7" r="1.3" fill="#24589a" />
      <path d="M9-5 L14-3 L9-1" fill="#c99a24" />
      <path d="M-1 12 L-5 16 M-1 12 L3 16" stroke="#c83228" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  )
}

function BambooFace({ tile }: { tile: Pick<MahjongNumberTile, 'rank'> }) {
  if (tile.rank === 1) return <BirdFace />
  const marks = MAHJONG_BAMBOO_LAYOUTS[tile.rank]
  const height = marks.length >= 8 ? 7 : marks.length >= 6 ? 8 : 10
  return marks.map((faceMark, index) => {
    const x = faceMark.x * 40
    const y = faceMark.y * 54
    const color = MARK_COLORS[faceMark.color]
    return (
      <g
        key={`${faceMark.x}-${faceMark.y}-${index}`}
        transform={faceMark.rotation ? `rotate(${faceMark.rotation} ${x} ${y})` : undefined}
      >
        <rect x={x - 1.8} y={y - height / 2} width="3.6" height={height} rx="1.8" fill={color} />
        <path d={`M${x - 3} ${y} L${x + 3} ${y}`} stroke="#f5d56a" strokeWidth="1.2" strokeLinecap="round" />
      </g>
    )
  })
}

function TileFace({
  tile,
  honor
}: {
  tile?: Pick<MahjongNumberTile, 'suit' | 'rank'>
  honor?: MahjongHonor
}) {
  if (honor === 'white') {
    return <rect x="8" y="8" width="24" height="38" rx="2" fill="none" stroke="#24589a" strokeWidth="2.2" />
  }
  if (honor) {
    return (
      <text
        x="20"
        y="36"
        textAnchor="middle"
        fontSize="24"
        fontWeight="800"
        fill={honor === 'red' ? '#c83228' : '#208653'}
        fontFamily="KaiTi, STKaiti, serif"
      >
        {MAHJONG_HONOR_LABELS[honor]}
      </text>
    )
  }
  if (!tile) return null

  if (tile.suit === 'characters') {
    return (
      <>
        <text x="20" y="24" textAnchor="middle" fontSize="18" fontWeight="800" fill="#18212b" fontFamily="KaiTi, STKaiti, serif">
          {MAHJONG_CHARACTER_NUMERALS[tile.rank]}
        </text>
        <text x="20" y="44" textAnchor="middle" fontSize="18" fontWeight="800" fill="#c83228" fontFamily="KaiTi, STKaiti, serif">萬</text>
      </>
    )
  }
  if (tile.suit === 'dots') {
    return <DotFace rank={tile.rank} marks={MAHJONG_DOT_LAYOUTS[tile.rank]} />
  }
  return <BambooFace tile={tile} />
}

export function MahjongTile({
  tile,
  honor,
  faceDown = false,
  knownSuit,
  compact = false,
  className = '',
  style
}: MahjongTileProps) {
  const classes = [
    'mahjong-tile',
    faceDown ? 'mahjong-tile--back' : 'mahjong-tile--face',
    knownSuit ? 'mahjong-tile--known-suit' : '',
    compact ? 'mahjong-tile--compact' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <span className={classes} style={style} aria-hidden="true">
      {faceDown ? (
        <span className="mahjong-tile__back-pattern" />
      ) : (
        <svg viewBox="0 0 40 54" role="presentation">
          <TileFace tile={tile} honor={honor} />
        </svg>
      )}
      {knownSuit && (
        <span className="mahjong-tile__suit-marker">{MAHJONG_SUIT_LABELS[knownSuit]}</span>
      )}
    </span>
  )
}
