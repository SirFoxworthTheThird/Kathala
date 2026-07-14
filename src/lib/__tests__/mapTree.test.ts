import { describe, it, expect } from 'vitest'
import { descendantLayerIds, canReparentLayer, type LayerNode } from '@/lib/mapTree'

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
