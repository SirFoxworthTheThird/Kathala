/**
 * Field-level merge for two copies of the same record that were edited apart.
 *
 * A `.pwk` carries the state each side arrived at, not the steps it took to get
 * there — the operation journal is device-local and deliberately stays out of
 * the file. That asymmetry decides everything here:
 *
 * - **Scalars** cannot be merged. With no common ancestor there is no way to
 *   tell "I changed this" from "I left it alone", so a difference is a genuine
 *   conflict and the later write takes it. Every such choice is reported rather
 *   than made quietly, so a caller can show both versions.
 * - **Set-like fields** can. Adding a character to a scene's cast on one device
 *   and a different one on another are independent facts, and keeping both
 *   loses nothing. This is where the previous whole-record merge did real
 *   damage: retitling a scene on one device silently discarded a cast change
 *   made on the other, because the newer record won entire.
 *
 * Order within a set is preserved as each side had it, with the incoming side's
 * newcomers appended. Cast order carries meaning — it reads as who the scene is
 * about — so a merge must not reshuffle what someone deliberately arranged.
 */

/** Array-valued fields whose contents are a set of ids or labels, not a sequence. */
const SET_FIELDS = new Set([
  'tags',
  'aliases',
  'involvedCharacterIds',
  'mentionedCharacterIds',
  'involvedItemIds',
  'inventoryItemIds',
  'threadIds',
  'motifIds',
  'linkedEntityIds',
])

export interface FieldConflict {
  field: string
  local: unknown
  incoming: unknown
  /** Which side the merge took, so the other can still be offered. */
  kept: 'local' | 'incoming'
}

export interface MergeResult<T> {
  record: T
  conflicts: FieldConflict[]
}

function isSetField(field: string, value: unknown): value is unknown[] {
  return SET_FIELDS.has(field) && Array.isArray(value)
}

/** Union preserving local order, then incoming's newcomers in their own order. */
function unionPreservingOrder(local: unknown[], incoming: unknown[]): unknown[] {
  const seen = new Set(local)
  return [...local, ...incoming.filter((v) => !seen.has(v))]
}

function sameScalar(a: unknown, b: unknown): boolean {
  if (a === b) return true
  // Arrays that are not set-like are compared whole: a sequence differing at
  // all is a conflict, since reordering is itself the edit.
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i])
  }
  return false
}

/**
 * Merge `incoming` into `local`, field by field.
 *
 * `updatedAt` decides scalar conflicts. A record without one is treated as
 * older than any record with one, which matches the import path's existing
 * habit of trusting incoming when it cannot tell.
 */
export function mergeRecords<T extends { id: string }>(local: T, incoming: T): MergeResult<T> {
  const l = local as unknown as Record<string, unknown>
  const i = incoming as unknown as Record<string, unknown>

  const localAt = typeof l.updatedAt === 'number' ? l.updatedAt : -Infinity
  const incomingAt = typeof i.updatedAt === 'number' ? i.updatedAt : -Infinity
  const incomingWins = incomingAt >= localAt

  const merged: Record<string, unknown> = { ...l }
  const conflicts: FieldConflict[] = []

  for (const field of new Set([...Object.keys(l), ...Object.keys(i)])) {
    const lv = l[field]
    const iv = i[field]

    if (!(field in i)) continue
    if (!(field in l)) { merged[field] = iv; continue }

    if (isSetField(field, lv) && isSetField(field, iv)) {
      merged[field] = unionPreservingOrder(lv, iv)
      continue
    }

    if (sameScalar(lv, iv)) continue

    // `updatedAt` itself is bookkeeping rather than content: the merged record
    // is as new as the newer of its parents, and saying so is not a conflict.
    if (field === 'updatedAt') {
      merged[field] = Math.max(localAt, incomingAt)
      continue
    }

    merged[field] = incomingWins ? iv : lv
    conflicts.push({
      field,
      local: lv,
      incoming: iv,
      kept: incomingWins ? 'incoming' : 'local',
    })
  }

  return { record: merged as unknown as T, conflicts }
}
