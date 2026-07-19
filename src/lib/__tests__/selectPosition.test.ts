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
