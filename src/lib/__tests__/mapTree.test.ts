import { describe, it, expect } from 'vitest'
import { descendantLayerIds, canReparentLayer, orphanLayerIds, type LayerNode } from '@/lib/mapTree'

// world:  A(root) ─ B ─ D ,  A ─ C ,  E(root)
const layers: LayerNode[] = [
  { id: 'A', parentMapId: null },
  { id: 'B', parentMapId: 'A' },
  { id: 'C', parentMapId: 'A' },
  { id: 'D', parentMapId: 'B' },
  { id: 'E', parentMapId: null },
]

describe('descendantLayerIds', () => {
  it('collects all nested descendants', () => {
    expect([...descendantLayerIds(layers, 'A')].sort()).toEqual(['B', 'C', 'D'])
    expect([...descendantLayerIds(layers, 'B')]).toEqual(['D'])
    expect([...descendantLayerIds(layers, 'D')]).toEqual([])
  })
})

describe('canReparentLayer', () => {
  it('allows moving a layer under an unrelated layer', () => {
    expect(canReparentLayer(layers, 'E', 'B')).toBe(true) // root → under B
    expect(canReparentLayer(layers, 'C', 'E')).toBe(true) // re-parent under another root
  })

  it('allows un-nesting to root', () => {
    expect(canReparentLayer(layers, 'D', null)).toBe(true)
  })

  it('rejects no-ops', () => {
    expect(canReparentLayer(layers, 'B', 'B')).toBe(false)       // onto itself
    expect(canReparentLayer(layers, 'B', 'A')).toBe(false)       // already under A
    expect(canReparentLayer(layers, 'E', null)).toBe(false)      // already a root
  })

  it('rejects moves that would create a cycle', () => {
    expect(canReparentLayer(layers, 'A', 'B')).toBe(false) // B is a child of A
    expect(canReparentLayer(layers, 'A', 'D')).toBe(false) // D is a grandchild of A
    expect(canReparentLayer(layers, 'B', 'D')).toBe(false) // D is a child of B
  })

  it('rejects an unknown dragged or target', () => {
    expect(canReparentLayer(layers, 'Z', 'A')).toBe(false)
    expect(canReparentLayer(layers, 'E', 'Z')).toBe(false)
  })
})

describe('orphanLayerIds', () => {
  it('finds no orphans when every parent exists', () => {
    expect([...orphanLayerIds(layers)]).toEqual([])
  })

  it('flags a layer whose parent is missing, plus its descendants', () => {
    // X's parent "gone" no longer exists; Y is nested under X.
    const broken: LayerNode[] = [
      { id: 'A', parentMapId: null },
      { id: 'X', parentMapId: 'gone' },
      { id: 'Y', parentMapId: 'X' },
    ]
    expect([...orphanLayerIds(broken)].sort()).toEqual(['X', 'Y'])
  })

  it('treats roots (null parent) as legitimate, never orphans', () => {
    const roots: LayerNode[] = [
      { id: 'A', parentMapId: null },
      { id: 'B', parentMapId: null },
    ]
    expect([...orphanLayerIds(roots)]).toEqual([])
  })

  it('collects several disjoint orphan branches', () => {
    const world: LayerNode[] = [
      { id: 'A', parentMapId: null },
      { id: 'B', parentMapId: 'A' },     // fine
      { id: 'P', parentMapId: 'dead1' }, // orphan root
      { id: 'Q', parentMapId: 'P' },     // under orphan
      { id: 'R', parentMapId: 'dead2' }, // another orphan root
    ]
    expect([...orphanLayerIds(world)].sort()).toEqual(['P', 'Q', 'R'])
  })
})
