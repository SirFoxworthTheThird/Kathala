import { describe, it, expect } from 'vitest'
import { layoutRelationshipGraph, connectedGroups, neighbourhood } from '../graphLayout'
import type { LayoutEdge } from '../graphLayout'

const NODE_W = 150

function ids(n: number, prefix = 'c'): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`)
}
function chain(names: string[]): LayoutEdge[] {
  return names.slice(1).map((b, i) => ({ a: names[i], b }))
}
function star(hub: string, spokes: string[]): LayoutEdge[] {
  return spokes.map((b) => ({ a: hub, b }))
}

describe('connectedGroups', () => {
  it('separates islands and keeps first-appearance order', () => {
    const groups = connectedGroups(['a', 'b', 'c', 'd', 'e'], [{ a: 'a', b: 'c' }, { a: 'd', b: 'e' }])
    expect(groups).toEqual([['a', 'c'], ['b'], ['d', 'e']])
  })

  it('ignores self-links and edges to characters that are gone', () => {
    const groups = connectedGroups(['a', 'b'], [{ a: 'a', b: 'a' }, { a: 'a', b: 'ghost' }])
    expect(groups).toEqual([['a'], ['b']])
  })

  it('accounts for every id exactly once', () => {
    const all = ids(45)
    const edges = [...chain(all.slice(0, 12)), ...star('c20', all.slice(21, 30))]
    const groups = connectedGroups(all, edges)
    expect(groups.flat().sort()).toEqual([...all].sort())
    expect(new Set(groups.flat()).size).toBe(45)
  })
})

describe('neighbourhood', () => {
  const all = ['a', 'b', 'c', 'd', 'e']
  const edges: LayoutEdge[] = [{ a: 'a', b: 'b' }, { a: 'b', b: 'c' }, { a: 'c', b: 'd' }]

  it('reaches exactly one link out at depth 1', () => {
    expect([...neighbourhood(all, edges, 'b', 1)].sort()).toEqual(['a', 'b', 'c'])
  })

  it('reaches two links out at depth 2', () => {
    expect([...neighbourhood(all, edges, 'b', 2)].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('always includes the root, even with nothing attached', () => {
    expect([...neighbourhood(all, edges, 'e', 2)]).toEqual(['e'])
  })

  it('hides nothing when the root is gone', () => {
    expect(neighbourhood(all, edges, 'vanished', 2).size).toBe(0)
  })
})

describe('layoutRelationshipGraph', () => {
  it('gives every character a position and no two the same', () => {
    const all = ids(45)
    const edges = [...star('c1', all.slice(1, 15)), ...chain(all.slice(15, 25))]
    const layout = layoutRelationshipGraph(all, edges)
    expect(Object.keys(layout).sort()).toEqual([...all].sort())
    const seen = new Set(Object.values(layout).map((p) => `${Math.round(p.x)},${Math.round(p.y)}`))
    expect(seen.size).toBe(45)
  })

  it('is not the tall column the four-column grid produced', () => {
    // The bug: forty-five characters on a fixed four-column grid made a picture
    // roughly twice as tall as it was wide (4 × 220 by 12 × 160), so fitView
    // zoomed out to swallow the height and left both side thirds empty.
    const all = ids(45)
    const edges = [...star('c1', all.slice(1, 15)), ...chain(all.slice(15, 30)), ...star('c31', all.slice(31, 40))]
    const layout = layoutRelationshipGraph(all, edges)
    const xs = Object.values(layout).map((p) => p.x)
    const ys = Object.values(layout).map((p) => p.y)
    const width = Math.max(...xs) - Math.min(...xs) + NODE_W
    const height = Math.max(...ys) - Math.min(...ys) + NODE_W
    expect(height / width).toBeLessThan(1.3)
    // The old grid, for comparison: 880 wide by 1920 tall.
    expect(1920 / 880).toBeGreaterThan(1.3)
  })

  it('puts the most-connected character at the middle of its group', () => {
    // c1 knows everyone; the spokes know only c1. The hub should sit inside the
    // wheel of spokes, not off at one edge of it.
    const all = ids(9)
    const layout = layoutRelationshipGraph(all, star('c1', all.slice(1)))
    const hub = layout['c1']
    const spokes = all.slice(1).map((id) => layout[id])
    const meanX = spokes.reduce((n, p) => n + p.x, 0) / spokes.length
    const meanY = spokes.reduce((n, p) => n + p.y, 0) / spokes.length
    const spread = Math.max(...spokes.map((p) => Math.hypot(p.x - meanX, p.y - meanY)))
    // Nearer to the spokes' centre of mass than any spoke is.
    expect(Math.hypot(hub.x - meanX, hub.y - meanY)).toBeLessThan(spread / 3)
  })

  it('never leaves two character cards overlapping', () => {
    // Twenty spokes all attached to one hub: the forces balance an average, so
    // without the separation pass several of them end up half under each other.
    const all = ids(21)
    const layout = layoutRelationshipGraph(all, star('c1', all.slice(1)))
    const points = all.map((id) => layout[id])
    let closest = Infinity
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        closest = Math.min(closest, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y))
      }
    }
    expect(closest).toBeGreaterThan(130)
  })

  it('holds a relationship shorter than the gap to a stranger', () => {
    // Distance has to mean something: two characters who know each other end up
    // closer than either is to someone they have never met.
    const all = ids(12)
    const layout = layoutRelationshipGraph(all, [
      ...chain(['c1', 'c2', 'c3', 'c4', 'c5', 'c6']),
      ...chain(['c7', 'c8', 'c9', 'c10', 'c11', 'c12']),
    ])
    const d = (a: string, b: string) => Math.hypot(layout[a].x - layout[b].x, layout[a].y - layout[b].y)
    const linked = [['c1', 'c2'], ['c2', 'c3'], ['c3', 'c4'], ['c4', 'c5'], ['c5', 'c6']]
    const longestLink = Math.max(...linked.map(([a, b]) => d(a, b)))
    const nearestStranger = Math.min(
      ...['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].flatMap((a) =>
        ['c7', 'c8', 'c9', 'c10', 'c11', 'c12'].map((b) => d(a, b)),
      ),
    )
    expect(longestLink).toBeLessThan(nearestStranger)
  })

  it('gathers unconnected characters into a block below the graph', () => {
    const all = ['h', 's1', 's2', 's3', 'lone1', 'lone2', 'lone3']
    const layout = layoutRelationshipGraph(all, star('h', ['s1', 's2', 's3']))
    const graphBottom = Math.max(...['h', 's1', 's2', 's3'].map((id) => layout[id].y))
    for (const id of ['lone1', 'lone2', 'lone3']) {
      expect(layout[id].y, `${id} should sit below the connected graph`).toBeGreaterThan(graphBottom)
    }
    // Side by side rather than strung out — three of them fit on one row.
    expect(new Set(['lone1', 'lone2', 'lone3'].map((id) => layout[id].y)).size).toBe(1)
  })

  it('draws a link at the same length whatever the size of the cast', () => {
    // Without a cutoff on the repulsion every pair keeps pushing, so a chain of
    // fifteen inflated until its links were half again as long as a chain of
    // five's — the same relationship drawn at two lengths, which makes the one
    // thing distance is supposed to mean unreadable across a graph.
    const meanLink = (n: number) => {
      const all = ids(n)
      const edges = chain(all)
      const layout = layoutRelationshipGraph(all, edges)
      const lengths = edges.map(({ a, b }) => Math.hypot(layout[a].x - layout[b].x, layout[a].y - layout[b].y))
      return lengths.reduce((x, y) => x + y, 0) / lengths.length
    }
    const short = meanLink(5)
    const long = meanLink(20)
    expect(Math.abs(long - short) / short).toBeLessThan(0.15)
  })

  it('is stable: the same cast always lays out the same way', () => {
    const all = ids(20)
    const edges = [...star('c1', all.slice(1, 9)), ...chain(all.slice(9, 16))]
    expect(layoutRelationshipGraph(all, edges)).toEqual(layoutRelationshipGraph(all, edges))
  })

  it('handles an empty cast and a cast with no relationships at all', () => {
    expect(layoutRelationshipGraph([], [])).toEqual({})
    const alone = layoutRelationshipGraph(ids(5), [])
    expect(Object.keys(alone)).toHaveLength(5)
    expect(new Set(Object.values(alone).map((p) => `${p.x},${p.y}`)).size).toBe(5)
  })
})
