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
 * Layers that are genuinely unreachable, i.e. safe to purge. A sub-map is
 * *reachable* — and therefore NOT an orphan — if any of these hold:
 *   • it is a top-level map (`parentMapId` null/undefined/empty), or
 *   • it is linked from a surviving marker or region (`linkedLayerIds`), or
 *   • it is nested (via `parentMapId`) under a layer that is itself reachable.
 *
 * Reachability is seeded from the roots and the linked layers, then walked down
 * the `parentMapId` tree. Anything never reached is an orphan. This deliberately
 * treats a sub-map with a stale/dangling `parentMapId` that is still opened
 * through a marker link as reachable — deleting it would destroy locations the
 * user can still see and use.
 */
export function orphanLayerIds(
  layers: LayerNode[],
  linkedLayerIds: Set<string> = new Set(),
): Set<string> {
  const childrenByParent = new Map<string, string[]>()
  for (const l of layers) {
    if (l.parentMapId) {
      const arr = childrenByParent.get(l.parentMapId) ?? []
      arr.push(l.id)
      childrenByParent.set(l.parentMapId, arr)
    }
  }

  const reachable = new Set<string>()
  const stack: string[] = []
  for (const l of layers) {
    const p = l.parentMapId
    const isRoot = p == null || p === '' // == null covers null and undefined
    if (isRoot || linkedLayerIds.has(l.id)) stack.push(l.id)
  }
  while (stack.length) {
    const id = stack.pop()!
    if (reachable.has(id)) continue
    reachable.add(id)
    for (const child of childrenByParent.get(id) ?? []) stack.push(child)
  }

  const out = new Set<string>()
  for (const l of layers) {
    if (!reachable.has(l.id)) out.add(l.id)
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
