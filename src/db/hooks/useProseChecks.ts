import { db } from '@/db/database'
import type { ProseCheckSettings } from '@/lib/proseChecks/types'

/*
  The prose checks' settings and dismissals (editorial-plan.md, R6), kept on
  the world, so they travel with the book in a .pwk. Each write reads the world
  and writes it back in one transaction: two changes made close together do
  not carry a stale copy of each other, as a spread of what was rendered would.
*/

/** Change some settings; `null` puts them all back to the defaults. */
export async function setProseCheckSettings(worldId: string, patch: Partial<ProseCheckSettings> | null): Promise<void> {
  await db.transaction('rw', db.worlds, async () => {
    const world = await db.worlds.get(worldId)
    if (!world) return
    await db.worlds.update(worldId, { proseChecks: patch === null ? {} : { ...(world.proseChecks ?? {}), ...patch }, updatedAt: Date.now() })
  })
}

/** Dismiss a finding, or bring it back. */
export async function setProseFindingDismissed(worldId: string, key: string, dismissed: boolean): Promise<void> {
  await db.transaction('rw', db.worlds, async () => {
    const world = await db.worlds.get(worldId)
    if (!world) return
    const now = new Set(world.proseDismissed ?? [])
    if (dismissed) now.add(key)
    else now.delete(key)
    await db.worlds.update(worldId, { proseDismissed: [...now], updatedAt: Date.now() })
  })
}
