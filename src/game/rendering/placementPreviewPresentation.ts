import type { PlacementPreviewStatus } from '../types/game'

export interface PlacementPreviewPresentation {
  fill: string
  stroke: string
  badge: string
}

const PRESENTATIONS: Record<PlacementPreviewStatus, PlacementPreviewPresentation> = {
  valid: {
    fill: 'rgba(72, 222, 111, 0.24)',
    stroke: '#8cff9f',
    badge: '✓'
  },
  path_blocked: {
    fill: 'rgba(255, 72, 68, 0.28)',
    stroke: '#ff6965',
    badge: '×'
  },
  insufficient_capacity: {
    fill: 'rgba(255, 174, 47, 0.28)',
    stroke: '#ffc45c',
    badge: '!'
  }
}

export function getPlacementPreviewPresentation(
  status: PlacementPreviewStatus
): PlacementPreviewPresentation {
  return PRESENTATIONS[status]
}
