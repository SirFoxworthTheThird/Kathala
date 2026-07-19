/** Reasoning helpers for map "levels" (floors of a place). Pure, no Dexie. */

export interface LevelLayer {
  id: string
  levelGroupId: string | null
  levelIndex: number
}

/** All layers in a floor group, ordered bottom → top (lowest levelIndex first). */
export function levelsInGroup<T extends LevelLayer>(layers: T[], groupId: string | null): T[] {
  if (!groupId) return []
  return layers
    .filter((l) => l.levelGroupId === groupId)
    .sort((a, b) => a.levelIndex - b.levelIndex || a.id.localeCompare(b.id))
}

/**
 * The layer that represents a floor group in the map tree and as a drill-in
 * target — the ground floor (levelIndex 0) if present, otherwise the member
 * closest to 0 (ties broken by lowest index, then id for determinism).
 */
export function groupRepresentativeId<T extends LevelLayer>(layers: T[], groupId: string): string | null {
  const members = levelsInGroup(layers, groupId)
  if (members.length === 0) return null
  return members.reduce((best, l) => {
    const a = Math.abs(l.levelIndex), b = Math.abs(best.levelIndex)
    if (a !== b) return a < b ? l : best
    if (l.levelIndex !== best.levelIndex) return l.levelIndex < best.levelIndex ? l : best
    return l.id < best.id ? l : best
  }).id
}

/** Whether a layer should appear in the Map Layers tree: standalone maps and the
 *  representative floor of each group; other floors are reached via the switcher. */
export function isTreeVisible<T extends LevelLayer>(layers: T[], layer: T): boolean {
  if (!layer.levelGroupId) return true
  return groupRepresentativeId(layers, layer.levelGroupId) === layer.id
}

/** Filter a layer list down to what the tree should show (hides non-representative floors). */
export function treeVisibleLayers<T extends LevelLayer>(layers: T[]): T[] {
  return layers.filter((l) => isTreeVisible(layers, l))
}

/**
 * The layer a parent-map pin actually links to for `layerId`. A building's pin
 * links to its group's representative floor, so a character on ANY floor is
 * reached through that one pin. For a standalone layer this is the layer itself.
 */
export function buildingLinkTargetId<T extends LevelLayer>(layers: T[], layerId: string): string {
  const layer = layers.find((l) => l.id === layerId)
  if (layer?.levelGroupId) return groupRepresentativeId(layers, layer.levelGroupId) ?? layerId
  return layerId
}

/** The next levelIndex above the top of a group (or 1 for a group that only has its base at 0). */
export function nextLevelIndexAbove<T extends LevelLayer>(layers: T[], groupId: string): number {
  const members = levelsInGroup(layers, groupId)
  if (members.length === 0) return 0
  return Math.max(...members.map((l) => l.levelIndex)) + 1
}
