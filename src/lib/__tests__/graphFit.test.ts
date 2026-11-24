import { describe, it, expect } from 'vitest'
import { fitBelow } from '@/lib/graphFit'

describe('fitBelow (UX-3-19)', () => {
  const nodes = { x: 0, y: 0, width: 1000, height: 1000 }
  it('the nodes start below the toolbar, and fit the room left under it', () => {
    const v = fitBelow(nodes, { width: 1200, height: 800 }, 120, { padding: 0 })
    // The room is 680 high: that is what decides the zoom.
    expect(v.zoom).toBeCloseTo(0.68)
    // The top node's top edge lands at the toolbar's foot, not under it.
    expect(v.y + nodes.y * v.zoom).toBeCloseTo(120)
    expect(v.y + (nodes.y + nodes.height) * v.zoom).toBeCloseTo(800)
  })
  it('with no toolbar, the whole pane, as React Flow fits it', () => {
    const v = fitBelow(nodes, { width: 1200, height: 800 }, 0, { padding: 0 })
    expect(v.zoom).toBeCloseTo(0.8)
    expect(v.y).toBeCloseTo(0)
  })
  it('within the zoom limits', () => {
    expect(fitBelow({ x: 0, y: 0, width: 10, height: 10 }, { width: 1200, height: 800 }, 0, { maxZoom: 1.5 }).zoom).toBe(1.5)
    expect(fitBelow(nodes, { width: 100, height: 100 }, 0, { minZoom: 0.5 }).zoom).toBe(0.5)
  })
})
