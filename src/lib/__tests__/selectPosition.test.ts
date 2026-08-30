import { describe, it, expect } from 'vitest'
import { computeSelectPosition } from '@/lib/selectPosition'

const vp = { width: 400, height: 800 }

describe('computeSelectPosition', () => {
  it('opens below with room to spare', () => {
    const pos = computeSelectPosition({ top: 100, bottom: 120, left: 20, width: 200 }, vp)
    expect(pos.placement).toBe('below')
    expect(pos.top).toBe(124) // rect.bottom + gap
    expect(pos.bottom).toBeUndefined()
    expect(pos.maxHeight).toBe(256) // capped, plenty of space
  })

  it('caps height to the space below so it never runs off the bottom', () => {
    // Trigger low on the screen: only 130px below.
    const pos = computeSelectPosition({ top: 650, bottom: 670, left: 20, width: 200 }, vp)
    // 130px below vs 642px above → flips above.
    expect(pos.placement).toBe('above')
    expect(pos.bottom).toBe(vp.height - 650 + 4) // anchored above the trigger
    // Never taller than the space above.
    expect(pos.maxHeight).toBeLessThanOrEqual(650 - 8)
    // And the panel's top edge stays on screen.
    const topEdge = vp.height - pos.bottom! - pos.maxHeight
    expect(topEdge).toBeGreaterThanOrEqual(0)
  })

  it('opens below but shrinks to fit when below has enough but not full room', () => {
    // 200px below (>=160 threshold) → stays below, capped to 200.
    const pos = computeSelectPosition({ top: 560, bottom: 592, left: 20, width: 200 }, vp)
    expect(pos.placement).toBe('below')
    expect(pos.maxHeight).toBe(200)
    // Bottom edge stays on screen.
    expect(pos.top! + pos.maxHeight).toBeLessThanOrEqual(vp.height)
  })

  it('clamps horizontally so a wide panel never spills off the right edge', () => {
    const pos = computeSelectPosition({ top: 100, bottom: 120, left: 380, width: 200 }, vp)
    expect(pos.left + pos.width).toBeLessThanOrEqual(vp.width)
    expect(pos.left).toBeGreaterThanOrEqual(0)
  })

  it('never makes the panel wider than the viewport', () => {
    const narrow = { width: 320, height: 700 }
    const pos = computeSelectPosition({ top: 50, bottom: 70, left: 4, width: 500 }, narrow)
    expect(pos.width).toBeLessThanOrEqual(narrow.width - 16)
  })
})

/**
 * N8: a filtered picker is a long picker, and its options are longer than the
 * control that opens them — "+ Assign a scene…" is 176 px and its options read
 * `Ch. 12 · The count returns to Paris`. Being able to find the scene is no use
 * if the list cannot show which one you found.
 */
describe('computeSelectPosition minWidth', () => {
  const trigger = { top: 100, bottom: 130, left: 40, width: 176 }

  it('leaves a panel at its trigger width when nothing asks for more', () => {
    // The presence half: without the option, the old behaviour is unchanged.
    expect(computeSelectPosition(trigger, { width: 1280, height: 800 }).width).toBe(176)
  })

  it('widens a panel past a trigger narrower than its options', () => {
    expect(computeSelectPosition(trigger, { width: 1280, height: 800 }, { minWidth: 320 }).width)
      .toBe(320)
  })

  it('never shrinks a trigger that is already wider', () => {
    const wide = { ...trigger, width: 480 }
    expect(computeSelectPosition(wide, { width: 1280, height: 800 }, { minWidth: 320 }).width)
      .toBe(480)
  })

  it('still yields to a screen too narrow to hold it', () => {
    // 300 px of viewport leaves 284 once both margins are taken, so the panel
    // gives up the width it asked for rather than opening off the edge.
    const pos = computeSelectPosition(trigger, { width: 300, height: 800 }, { minWidth: 320 })
    expect(pos.width).toBe(284)
    expect(pos.left).toBe(8)
    expect(pos.left + pos.width).toBeLessThanOrEqual(300 - 8)
  })

  it('takes the width it asked for on a phone that can hold it', () => {
    // The pair to the above: 360 px has room for 320 plus both margins, so
    // the clamp must not fire here. Without this the case above would pass
    // just as well if the option were ignored altogether.
    const pos = computeSelectPosition(trigger, { width: 360, height: 800 }, { minWidth: 320 })
    expect(pos.width).toBe(320)
    expect(pos.left + pos.width).toBeLessThanOrEqual(360 - 8)
  })

  it('keeps a widened panel on screen when its trigger is near the right edge', () => {
    const nearRight = { ...trigger, left: 1100 }
    const pos = computeSelectPosition(nearRight, { width: 1280, height: 800 }, { minWidth: 320 })
    expect(pos.left + pos.width).toBeLessThanOrEqual(1280 - 8)
  })
})
