import { describe, expect, it } from 'vitest'
import { chromeOnScroll, CHROME_THRESHOLD, CHROME_TOP_ZONE, type ScrollChrome } from '../scrollChrome'

/** The state after scrolling through each position in turn, from rows shown at the first. */
const after = (start: number, ...tops: number[]): ScrollChrome => tops.reduce<ScrollChrome>((s, top) => chromeOnScroll(s, top), { hidden: false, anchor: start })

describe('chromeOnScroll', () => {
  it('hides once a scroll down has run past the threshold, and not before', () => {
    expect(after(100, 100 + CHROME_THRESHOLD).hidden).toBe(false)
    expect(after(100, 101 + CHROME_THRESHOLD).hidden).toBe(true)
  })

  it('measures from the highest point while shown, so a slow scroll down still hides', () => {
    // Up a little (anchor moves to 80), then down in small steps.
    const s = after(100, 80, 90, 100, 105)
    expect(s.hidden).toBe(true)
    expect(after(100, 80, 90, 100, 104).hidden).toBe(false)
  })

  it('comes back on a scroll up past the threshold from the lowest point, and not on a wobble', () => {
    const down = after(100, 400, 900)
    expect(down).toEqual({ hidden: true, anchor: 900 })
    expect(chromeOnScroll(down, 900 - CHROME_THRESHOLD).hidden).toBe(true)
    expect(chromeOnScroll(down, 899 - CHROME_THRESHOLD).hidden).toBe(false)
    // A finger's wobble on the way down: the lowest point is what counts.
    expect(after(100, 400, 900, 890, 1200, 1180).hidden).toBe(true)
    // So a slow scroll up, a few pixels a frame, still brings them back.
    expect(after(100, 900, 892, 884, 878).hidden).toBe(true)
    expect(after(100, 900, 892, 884, 876, 868).hidden).toBe(false)
  })

  it('is always shown near the top, however it got there', () => {
    expect(after(100, 900).hidden).toBe(true)
    expect(after(100, 900, CHROME_TOP_ZONE).hidden).toBe(false)
    // Down from the very top hides too, once past the top zone.
    expect(after(0, CHROME_TOP_ZONE + 1).hidden).toBe(true)
    const hiddenNearTop: ScrollChrome = { hidden: true, anchor: CHROME_TOP_ZONE + 10 }
    expect(chromeOnScroll(hiddenNearTop, CHROME_TOP_ZONE).hidden).toBe(false)
    expect(chromeOnScroll(hiddenNearTop, CHROME_TOP_ZONE + 1).hidden).toBe(true)
  })
})
