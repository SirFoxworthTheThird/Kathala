/**
 * Whether importing a world file would overwrite a world that is already here.
 *
 * `importWorldData` runs with `replaceExisting = true`: it deletes every record
 * belonging to the incoming world's id before writing the file's own. That is
 * the right behaviour for re-importing a backup, and it is silent, so importing
 * yesterday's `.pwk` over today's work destroys today's work with no warning
 * and no undo. The library download path has guarded exactly this case for a
 * long time ("Replace your copy of …?"); the door writers use for their own
 * backups did not.
 *
 * Kept out of the component so the decision — *does this file land on
 * something?* — can be tested without a browser.
 */

/** What the confirm needs to say. `null` when the import lands on empty space. */
export interface ImportCollision {
  worldId: string
  /** What the local copy is called — the name the writer would recognise. */
  localName: string
  /** What the file calls it, which may differ if either side was renamed. */
  incomingName: string
}

interface LocalWorld {
  id: string
  name: string
}

/**
 * `incoming` is the parsed export file, typed loosely because it arrives from
 * `JSON.parse` on a file the user chose and may be anything at all. A file with
 * no readable world id collides with nothing: it will fail validation further
 * in, and refusing to guess here means the confirm never appears for a file
 * that was not going to import anyway.
 */
export function importCollision(
  incoming: unknown,
  localWorlds: readonly LocalWorld[],
): ImportCollision | null {
  const world = (incoming as { world?: unknown } | null)?.world
  if (!world || typeof world !== 'object') return null

  const { id, name } = world as { id?: unknown; name?: unknown }
  if (typeof id !== 'string') return null

  const local = localWorlds.find((w) => w.id === id)
  if (!local) return null

  return {
    worldId: id,
    localName: local.name,
    incomingName: typeof name === 'string' && name.trim() ? name : local.name,
  }
}
