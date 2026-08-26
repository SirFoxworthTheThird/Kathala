import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { World, WorldCalendar } from '@/types'
import { generateId } from '@/lib/id'
import { worldActivity } from '@/lib/worldActivity'
import { lastOperationAt } from './useOperations'

/**
 * Every world, most recently worked on first.
 *
 * W19-5: this was `orderBy('createdAt')` — ascending, **oldest first** — so a
 * morning's work sat *below* a book downloaded from the library once and read
 * for ten minutes. A library world keeps the `createdAt` written into its
 * `.pwk` (all 25 of them are dated in the past), and the shelf split only
 * separates them while reading mode is on — which the app itself tells you to
 * turn off to edit one. The moment you do, the fixture's date outranks
 * everything you own.
 *
 * That was fixed by reversing it, with a note saying the *better* key would be
 * "last worked on" and that it did not exist — `world.updatedAt` moves only
 * when world metadata is edited, so writing two hundred scenes never touches
 * it, and sorting on it would have looked like a fix and behaved like the bug.
 *
 * It exists now. The operation journal is the record of "something in this
 * world changed", and `worldActivity` is the same function the card uses to
 * decide what date to print — so the list is still ordered by the fact the card
 * shows, and the order still explains itself. W19-5's own case is unharmed: a
 * downloaded book's journal is reset on import, so it falls back to the date in
 * its `.pwk` and stays where it was, while anything you have actually worked in
 * now outranks it.
 *
 * One index seek per world, once per list render. `useWorldSummary` reads the
 * same value per card; both go through `lastOperationAt` so they cannot drift.
 */
export async function listWorlds(): Promise<World[]> {
  const worlds = await db.worlds.toArray()
  const keyed = await Promise.all(
    worlds.map(async (w) => ({ w, at: worldActivity(w, await lastOperationAt(w.id)).at })),
  )
  return keyed
    .sort((a, b) =>
      // Ties broken by creation, then by id, so the order is stable rather than
      // whatever `toArray()` happened to hand back.
      b.at - a.at || b.w.createdAt - a.w.createdAt || a.w.id.localeCompare(b.w.id))
    .map(({ w }) => w)
}

export function useWorlds() {
  return useLiveQuery(() => listWorlds(), [], [])
}

export function useWorld(id: string | null) {
  return useLiveQuery(() => (id ? db.worlds.get(id) : undefined), [id])
}

export async function createWorld(data: Pick<World, 'name' | 'description'>): Promise<World> {
  const now = Date.now()
  const world: World = {
    id: generateId(),
    name: data.name,
    description: data.description,
    coverImageId: null,
    theme: null,
    continuityStaleThreshold: 5,
    calendar: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.worlds.add(world)
  return world
}

export async function updateWorld(id: string, data: Partial<Omit<World, 'id' | 'createdAt'>>) {
  await db.worlds.update(id, { ...data, updatedAt: Date.now() })
}

/**
 * Change part of the world's calendar without carrying a stale copy of the rest.
 *
 * The calendar is a *nested object* on `worlds`, so every field that edits it
 * writes the whole thing. `CalendarEditor` did that by spreading the calendar it
 * had rendered — `patch({ ...cal, startYear })` — which means a write to one
 * field carries whatever the other fields looked like at that render. Two
 * writes landing inside each other's live-query round-trip therefore lose one
 * of the two, last write winning with a value nobody typed.
 *
 * HB-3 reported exactly that shape as *"the start year silently reverts"*. Its
 * stated mechanism was wrong — the field commits on every keystroke and has no
 * Enter handler — and driving the sequence did not reproduce it, so this is
 * filed on the code rather than on a symptom (HB-3a). It is a real hazard
 * either way, and it is not confined to the two fields they noticed: month
 * names, month lengths, inserts and removals all spread the same snapshot.
 *
 * `mutate` receives the calendar **as stored**, read inside the same
 * transaction as the write, so nothing it did not change can be rolled back by
 * it. Returning `null` clears the calendar.
 */
export async function updateWorldCalendar(
  id: string,
  mutate: (calendar: WorldCalendar) => WorldCalendar | null,
): Promise<void> {
  await db.transaction('rw', db.worlds, async () => {
    const world = await db.worlds.get(id)
    // Nothing to edit part of — enabling a calendar goes through `updateWorld`.
    if (!world?.calendar) return
    await db.worlds.update(id, { calendar: mutate(world.calendar), updatedAt: Date.now() })
  })
}

export async function deleteWorld(id: string) {
  await db.transaction('rw', [
    db.worlds, db.mapLayers, db.locationMarkers, db.characters,
    db.items, db.characterSnapshots, db.characterMovements, db.itemPlacements,
    db.locationSnapshots, db.itemSnapshots,
    db.relationships, db.relationshipSnapshots, db.timelines,
    db.chapters, db.events, db.blobs, db.travelModes,
    db.timelineRelationships, db.crossTimelineArtifacts,
    db.mapRoutes, db.mapRegions, db.mapRegionSnapshots, db.mapAnnotations,
    db.loreCategories, db.lorePages,
    db.factions, db.factionMemberships, db.factionRelationships,
    db.knowledgeFacts, db.knowledgeReveals, db.writingLogs, db.motifs, db.characterGoals,
    db.sceneTexts, db.plotThreads, db.continuitySuppressions, db.sceneRevisions,
    db.operations, db.tombstones,
  ], async () => {
    await db.worlds.delete(id)
    await db.operations.where('worldId').equals(id).delete()
    await db.tombstones.where('worldId').equals(id).delete()
    await db.mapLayers.where('worldId').equals(id).delete()
    await db.locationMarkers.where('worldId').equals(id).delete()
    await db.characters.where('worldId').equals(id).delete()
    await db.items.where('worldId').equals(id).delete()
    await db.characterSnapshots.where('worldId').equals(id).delete()
    await db.characterMovements.where('worldId').equals(id).delete()
    await db.itemPlacements.where('worldId').equals(id).delete()
    await db.locationSnapshots.where('worldId').equals(id).delete()
    await db.itemSnapshots.where('worldId').equals(id).delete()
    await db.relationships.where('worldId').equals(id).delete()
    await db.relationshipSnapshots.where('worldId').equals(id).delete()
    await db.timelines.where('worldId').equals(id).delete()
    await db.chapters.where('worldId').equals(id).delete()
    await db.events.where('worldId').equals(id).delete()
    await db.blobs.where('worldId').equals(id).delete()
    await db.travelModes.where('worldId').equals(id).delete()
    await db.timelineRelationships.where('worldId').equals(id).delete()
    await db.crossTimelineArtifacts.where('worldId').equals(id).delete()
    await db.mapRoutes.where('worldId').equals(id).delete()
    await db.mapRegions.where('worldId').equals(id).delete()
    await db.mapRegionSnapshots.where('worldId').equals(id).delete()
    await db.mapAnnotations.where('worldId').equals(id).delete()
    await db.loreCategories.where('worldId').equals(id).delete()
    await db.lorePages.where('worldId').equals(id).delete()
    await db.factions.where('worldId').equals(id).delete()
    await db.factionMemberships.where('worldId').equals(id).delete()
    await db.factionRelationships.where('worldId').equals(id).delete()
    await db.knowledgeFacts.where('worldId').equals(id).delete()
    await db.knowledgeReveals.where('worldId').equals(id).delete()
    await db.characterGoals.where('worldId').equals(id).delete()
    await db.writingLogs.where('worldId').equals(id).delete()
    await db.motifs.where('worldId').equals(id).delete()
    await db.sceneTexts.where('worldId').equals(id).delete()
    await db.plotThreads.where('worldId').equals(id).delete()
    await db.continuitySuppressions.where('worldId').equals(id).delete()
    await db.sceneRevisions.where('worldId').equals(id).delete()
  })
}
