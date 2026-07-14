/** Minimal shape needed to reason about the map-layer tree. */
export interface LayerNode {
  id: string
  parentMapId: string | null
}

/** All layers nested (at any depth) under `rootId`, excluding `rootId` itself. */
export function descendantLayerIds(layers: LayerNode[], rootId: string): Set<string> {
  const childrenByParent = new Map<string, string[]>()
  for (const l of layers) {
    if (l.parentMapId) {
      const arr = childrenByParent.get(l.parentMapId) ?? []
      arr.push(l.id)
      childrenByParent.set(l.parentMapId, arr)
    }
  }
  const out = new Set<string>()
  const stack = [rootId]
  while (stack.length) {
    const id = stack.pop()!
    for (const child of childrenByParent.get(id) ?? []) {
      if (!out.has(child)) { out.add(child); stack.push(child) }
    }
  }
  return out
}

/**
 * Whether the layer `draggedId` may be re-parented under `targetId` (or made a
 * root when `targetId` is null). Rejects the no-ops and the moves that would
 * break the tree: onto itself, onto its current parent, onto a non-existent
 * target, or onto one of its own descendants (which would create a cycle).
 */
export function canReparentLayer(
  layers: LayerNode[],
  draggedId: string,
  targetId: string | null,
): boolean {
  if (draggedId === targetId) return false
  const dragged = layers.find((l) => l.id === draggedId)
  if (!dragged) return false
  if ((dragged.parentMapId ?? null) === (targetId ?? null)) return false // already there
  if (targetId === null) return true // un-nest to root
  if (!layers.some((l) => l.id === targetId)) return false
  if (descendantLayerIds(layers, draggedId).has(targetId)) return false // would cycle
  return true
}
