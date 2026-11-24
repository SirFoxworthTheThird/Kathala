import { describe, it, expect } from 'vitest'
import { onScreenShift } from '../onScreen'

describe('onScreenShift', () => {
  it('leaves a box that is on the screen where it is', () => {
    expect(onScreenShift({ left: 100, right: 324 }, 390)).toBe(0)
    expect(onScreenShift({ left: 8, right: 382 }, 390)).toBe(0)
  })

  it('moves a box off the left edge right, to the margin: the sprint menu at x = −139 on a 390px phone', () => {
    expect(onScreenShift({ left: -139, right: 85 }, 390)).toBe(147)
  })

  it('moves a box off the right edge left, to the margin', () => {
    expect(onScreenShift({ left: 300, right: 524 }, 390)).toBe(-142)
  })

  it('keeps the left edge of a box wider than the screen on it', () => {
    expect(onScreenShift({ left: -50, right: 400 }, 390)).toBe(58)
    expect(onScreenShift({ left: 20, right: 470 }, 390)).toBe(-12)
  })
})
