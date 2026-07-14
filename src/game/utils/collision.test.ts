import { describe, expect, it } from 'vitest'
import {
  checkCircleCollision,
  getDistance,
  getDistanceSquared
} from './collision'

describe('checkCircleCollision', () => {
  it('detects overlapping circles', () => {
    expect(checkCircleCollision(
      { x: 0, y: 0, radius: 5 },
      { x: 6, y: 0, radius: 5 }
    )).toBe(true)
  })

  it('treats tangent circles as colliding', () => {
    expect(checkCircleCollision(
      { x: 0, y: 0, radius: 5 },
      { x: 10, y: 0, radius: 5 }
    )).toBe(true)
  })

  it('rejects separated circles', () => {
    expect(checkCircleCollision(
      { x: 0, y: 0, radius: 5 },
      { x: 11, y: 0, radius: 5 }
    )).toBe(false)
  })

  it('uses a default radius of 10', () => {
    expect(checkCircleCollision({ x: 0, y: 0 }, { x: 20, y: 0 })).toBe(true)
    expect(checkCircleCollision({ x: 0, y: 0 }, { x: 21, y: 0 })).toBe(false)
  })
})

describe('distance helpers', () => {
  it('calculates Euclidean distance', () => {
    expect(getDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('calculates squared distance without taking a square root', () => {
    expect(getDistanceSquared({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25)
  })
})
