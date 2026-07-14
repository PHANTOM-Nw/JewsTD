import { describe, expect, it } from 'vitest'
import type { PlacementPreviewStatus } from '../types/game'
import { getPlacementPreviewPresentation } from './placementPreviewPresentation'

describe('placement preview presentation', () => {
  it.each<PlacementPreviewStatus>([
    'valid',
    'path_blocked',
    'insufficient_capacity'
  ])('contains status feedback without any sprite identity for %s', status => {
    const presentation = getPlacementPreviewPresentation(status)

    expect(Object.keys(presentation).sort()).toEqual(['badge', 'fill', 'stroke'])
    expect(presentation).not.toHaveProperty('sprite')
    expect(presentation).not.toHaveProperty('spriteUrl')
    expect(presentation).not.toHaveProperty('gemType')
    expect(presentation).not.toHaveProperty('level')
  })
})
