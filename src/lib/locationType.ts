import type { LocationIconType } from '@/types'

/**
 * What to *call* a place's type on screen.
 *
 * The seven types are a fantasy vocabulary — City, Town, Dungeon, Landmark,
 * Region, Building — and **Custom** is a literal member of the enum rather than
 * an escape hatch. A writer mapping a space station found four of five places
 * were "Building" and the fifth read *Marn's Office · Custom*, with the word
 * Custom printed on the pin as though it were a kind of place. The type filter
 * on that map was useless: four identical values and one placeholder.
 *
 * So `custom` now carries the writer's own word. The enum is untouched —
 * `iconType` still decides what the pin looks like, which is what it has always
 * been for — and `customType` is only the label.
 *
 * Returns `null` when there is nothing worth printing, which is the other half
 * of the fix: an unlabelled `custom` prints no type at all rather than printing
 * the word "Custom". Callers omit the line instead of showing a placeholder.
 */
export function locationTypeLabel(marker: {
  iconType: LocationIconType | string
  customType?: string
}): string | null {
  if (marker.iconType !== 'custom') return marker.iconType || null
  const own = marker.customType?.trim()
  return own ? own : null
}
