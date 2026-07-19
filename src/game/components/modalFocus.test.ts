import { describe, expect, it } from 'vitest'
import { getModalTabTarget, shouldTrapModalKey } from './modalFocus'

describe('getModalTabTarget', () => {
  const fields = ['name', 'submit', 'reset'] as const

  it('wraps Tab from the last control to the first control', () => {
    expect(getModalTabTarget(fields, 'reset', false)).toBe('name')
  })

  it('wraps Shift+Tab from the first control to the last control', () => {
    expect(getModalTabTarget(fields, 'name', true)).toBe('reset')
  })

  it('brings focus back inside when focus is outside the modal', () => {
    expect(getModalTabTarget(fields, null, false)).toBe('name')
    expect(getModalTabTarget(fields, null, true)).toBe('reset')
  })

  it('lets focus move normally between interior controls', () => {
    expect(getModalTabTarget(fields, 'submit', false)).toBeNull()
    expect(getModalTabTarget(fields, 'submit', true)).toBeNull()
  })

  it('traps only Tab and leaves Escape unable to close the result', () => {
    expect(shouldTrapModalKey('Tab')).toBe(true)
    expect(shouldTrapModalKey('Escape')).toBe(false)
  })
})
