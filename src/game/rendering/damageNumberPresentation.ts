import type { DamageNumber, DamageNumberType } from '../types/game'
import { MAP_CONFIG } from '../config/map'

interface DamageNumberColors {
  fill: string
  stroke: string
  shadow: string
}

export interface DamageNumberPresentation extends DamageNumberColors {
  text: string
  x: number
  y: number
  opacity: number
  scale: number
  fontSize: number
  lineWidth: number
}

const DAMAGE_COLORS: Record<DamageNumberType, DamageNumberColors> = {
  physical: {
    fill: '#fff2a8',
    stroke: '#74410f',
    shadow: 'rgba(255, 190, 48, 0.75)'
  },
  magic: {
    fill: '#a8f6ff',
    stroke: '#126c86',
    shadow: 'rgba(76, 225, 255, 0.75)'
  },
  pure: {
    fill: '#ffb4eb',
    stroke: '#7f255f',
    shadow: 'rgba(255, 103, 210, 0.75)'
  },
  poison: {
    fill: '#b9f57c',
    stroke: '#397320',
    shadow: 'rgba(111, 218, 72, 0.7)'
  }
}

const CRITICAL_COLORS: DamageNumberColors = {
  fill: '#fff5a1',
  stroke: '#a83e12',
  shadow: 'rgba(255, 112, 31, 0.85)'
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, maximum))
}

export function getDamageNumberPresentation(
  damageNumber: DamageNumber
): DamageNumberPresentation {
  const progress = clamp(
    damageNumber.elapsedMs / damageNumber.durationMs,
    0,
    1
  )
  const riseProgress = 1 - Math.pow(1 - progress, 3)
  const fadeProgress = clamp((progress - 0.58) / 0.42, 0, 1)
  const popProgress = clamp(progress / 0.16, 0, 1)
  const fontSize = damageNumber.critical
    ? 15
    : damageNumber.damageType === 'poison'
      ? 11
      : 12
  const minimumBaseline = fontSize + (damageNumber.critical ? 8 : 6)
  const baseY = Math.max(minimumBaseline, damageNumber.position.y - 18)
  const horizontalPadding = damageNumber.critical ? 24 : 16
  const canvasWidth = MAP_CONFIG.cols * MAP_CONFIG.cellSize
  const colors = damageNumber.critical
    ? CRITICAL_COLORS
    : DAMAGE_COLORS[damageNumber.damageType]

  return {
    ...colors,
    text: damageNumber.critical
      ? `✦${damageNumber.amount}`
      : `${damageNumber.amount}`,
    x: clamp(
      damageNumber.position.x + damageNumber.horizontalOffset,
      horizontalPadding,
      canvasWidth - horizontalPadding
    ),
    y: Math.max(minimumBaseline, baseY - riseProgress * 19),
    opacity: 1 - fadeProgress,
    scale: popProgress < 0.55
      ? 0.72 + popProgress * 0.8
      : 1.16 - (popProgress - 0.55) * (0.16 / 0.45),
    fontSize,
    lineWidth: damageNumber.critical ? 2.6 : 2.1
  }
}
