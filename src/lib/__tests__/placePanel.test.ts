import { describe, it, expect } from 'vitest'
import { placePanel } from '../caretPoint'

/**
 * The scene draft's `@`-mention list opened downward from the bottom of an
 * auto-growing textarea and was painted below the fold — rows measured at 859,
 * 887 and 915 in a 900px viewport, with `new place` off-screen entirely and
 * nothing scrollable to reach it. `new place` is the only way to make a
 * location from inside the writing surface, so it was the row always lost.
 */

const VIEW = { width: 1280, height: 900 }
const LIST = { width: 256, height: 84 } // three rows, as the finding describes
const line = (top: number) => ({ top, left: 100, lineHeight: 20 })

describe('placePanel', () => {
  it('sits below the caret when there is room', () => {
    const { top } = placePanel(line(300), LIST, VIEW)
    expect(top).toBe(324)
  })

  it('flips above the caret rather than off the bottom', () => {
    // A caret near the fold: below would put the last row past 900.
    const { top } = placePanel(line(840), LIST, VIEW)
    expect(top).toBe(840 - LIST.height - 4)
    expect(top).toBeGreaterThanOrEqual(8)
  })

  it('keeps every row on screen for the case that was reported', () => {
    // Whatever it chooses, the whole list is inside the viewport.
    for (const caretTop of [0, 100, 500, 800, 860, 899]) {
      const { top } = placePanel(line(caretTop), LIST, VIEW)
      expect(top).toBeGreaterThanOrEqual(8)
      expect(top + LIST.height).toBeLessThanOrEqual(VIEW.height - 8)
    }
  })

  it('clamps when the list fits neither above nor below', () => {
    const tall = { width: 256, height: 800 }
    const { top } = placePanel(line(450), tall, { width: 1280, height: 820 })
    // As far down as it can go while still showing its last row: 820 − 800 − 8.
    expect(top).toBe(12)
  })

  it('pulls a list back from the right edge', () => {
    const { left } = placePanel({ top: 100, left: 1200, lineHeight: 20 }, LIST, VIEW)
    expect(left + LIST.width).toBeLessThanOrEqual(VIEW.width - 8)
  })

  it('does not push a list off the left edge while pulling it off the right', () => {
    const wide = { width: 2000, height: 84 }
    expect(placePanel(line(100), wide, VIEW).left).toBe(8)
  })

  it('leaves a comfortable caret alone horizontally', () => {
    expect(placePanel(line(300), LIST, VIEW).left).toBe(100)
  })
})
