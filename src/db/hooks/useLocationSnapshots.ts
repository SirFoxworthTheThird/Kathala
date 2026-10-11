import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { journalCreate, journalUpdate, journalDelete, journalGroup } from './useOperations'
import type { LocationSnapshot } from '@/types'
import { generateId } from '@/lib/id'
import { computeSortKey } from '@/lib/sortKey'
import { useWorldEvents, useWorldChapters } from './useTimeline'
import { resolveSnapshot, selectBestSnapshots as selectBestSnapshotsGeneric } from '@/lib/snapshotUtils'
import type { EventStub, ChapterStub } from '@/lib/snapshotUtils'
import type { PlaceStatusPlan } from '@/lib/sceneHeader'

/** Pure single-marker resolution — exported for testing. */
export function resolveLocationSnapshot(
  all: LocationSnapshot[],
  activeEventId: string | null,
  allEvents: EventStub[],
  allChapters: ChapterStub[]
): LocationSnapshot | undefined {
  return resolveSnapshot(all, activeEventId, allEvents, allChapters)
}

/** Returns the last-known location snapshot at or before the active event. */
export function useLocationSnapshot(
  locationMarkerId: string | null,
  worldId: string | null,
  activeEventId: string | null
): LocationSnapshot | undefined {
  const all = useMarkerSnapshots(locationMarkerId)
  const allEvents = useWorldEvents(worldId)
  const allChapters = useWorldChapters(worldId)
  return useMemo(
    () => (!locationMarkerId ? undefined : resolveLocationSnapshot(all, activeEventId, allEvents, allChapters)),
    [locationMarkerId, activeEventId, all, allEvents, allChapters]
  )
}

export function useEventLocationSnapshots(eventId: string | null) {
  return useLiveQuery(
    () =>
      eventId
        ? db.locationSnapshots.where('eventId').equals(eventId).toArray()
        : [],
    [eventId],
    []
  )
}

/** @deprecated use useEventLocationSnapshots */
export const useChapterLocationSnapshots = useEventLocationSnapshots

export function useMarkerSnapshots(locationMarkerId: string | null) {
  return useLiveQuery(
    () =>
      locationMarkerId
        ? db.locationSnapshots.where('locationMarkerId').equals(locationMarkerId).toArray()
        : [],
    [locationMarkerId],
    []
  )
}

/** Returns all location snapshots for a world (used by bulk operations). */
export function useWorldLocationSnapshots(worldId: string | null) {
  return useLiveQuery(
    () =>
      worldId
        ? db.locationSnapshots.where('worldId').equals(worldId).toArray()
        : [],
    [worldId],
    []
  )
}

/** Pure world-level selection logic — exported for testing. */
export function selectBestLocationSnapshots(
  all: LocationSnapshot[],
  activeEventId: string | null,
  allEvents: EventStub[],
  allChapters: ChapterStub[]
): LocationSnapshot[] {
  return selectBestSnapshotsGeneric(all, activeEventId, allEvents, allChapters, (s) => s.locationMarkerId)
}

/** Returns the best (last-known) location snapshot per marker for the active event. */
export function useBestLocationSnapshots(
  worldId: string | null,
  activeEventId: string | null
): LocationSnapshot[] {
  const all = useWorldLocationSnapshots(worldId)
  const allEvents = useWorldEvents(worldId)
  const allChapters = useWorldChapters(worldId)
  return useMemo(
    () => selectBestLocationSnapshots(all, activeEventId, allEvents, allChapters),
    [all, activeEventId, allEvents, allChapters]
  )
}

function locSnapContentEqual(
  a: Omit<LocationSnapshot, 'id' | 'sortKey' | 'createdAt' | 'updatedAt'>,
  b: LocationSnapshot
): boolean {
  return a.status === b.status && a.notes === b.notes
}

export async function upsertLocationSnapshot(
  data: Omit<LocationSnapshot, 'id' | 'sortKey' | 'createdAt' | 'updatedAt'>
): Promise<LocationSnapshot> {
  const now = Date.now()
  const sortKey = await computeSortKey(data.eventId)

  const existing = await db.locationSnapshots
    .where('[locationMarkerId+eventId]')
    .equals([data.locationMarkerId, data.eventId])
    .first()

  if (existing) {
    await journalUpdate('locationSnapshot', db.locationSnapshots, existing.id, { ...data, sortKey, updatedAt: now })
    return (await db.locationSnapshots.get(existing.id))!
  }

  // Dedup: skip write if state matches the last-known snapshot
  const allForMarker = await db.locationSnapshots
    .where('locationMarkerId').equals(data.locationMarkerId)
    .toArray()
  const prevBest = allForMarker
    .filter((s) => (s.sortKey ?? 0) < sortKey)
    .sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0))[0]

  if (prevBest && locSnapContentEqual(data, prevBest)) {
    return prevBest
  }

  const snap: LocationSnapshot = { id: generateId(), ...data, sortKey, createdAt: now, updatedAt: now }
  return journalCreate('locationSnapshot', db.locationSnapshots, snap)
}

/** The place's state before scene `eventId`, by the stored order. */
async function placeStateBefore(locationMarkerId: string, eventId: string): Promise<LocationSnapshot | undefined> {
  const sortKey = await computeSortKey(eventId)
  return (await db.locationSnapshots.where('locationMarkerId').equals(locationMarkerId).toArray())
    .filter((s) => (s.sortKey ?? 0) < sortKey)
    .sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0))[0]
}

/**
 * What the Place line says of the place, recorded at the scene: `#The Drowned
 * Chapel:ruined` is its status from here. The state here takes it, or — with
 * none here — one is made, carrying the notes of the state before; one the
 * same as the state before is not written (`upsertLocationSnapshot`). A status
 * taken off the line puts the state here back to the status before it, and
 * removes it altogether unless it has notes of its own written here. One undo
 * step.
 */
export async function recordPlaceStatus(worldId: string, eventId: string, plan: PlaceStatusPlan): Promise<void> {
  if (!plan.set && !plan.unset) return
  await journalGroup(async () => {
    if (plan.unset) {
      const placeId = plan.unset
      const here = await db.locationSnapshots.where('[locationMarkerId+eventId]').equals([placeId, eventId]).first()
      if (here) {
        const before = await placeStateBefore(placeId, eventId)
        if (here.notes === (before?.notes ?? '')) {
          await journalDelete('locationSnapshot', db.locationSnapshots, here.id, async () => { await db.locationSnapshots.delete(here.id) })
        } else {
          await journalUpdate('locationSnapshot', db.locationSnapshots, here.id, { status: before?.status ?? '', updatedAt: Date.now() })
        }
      }
    }
    if (plan.set) {
      const { placeId, status } = plan.set
      const here = await db.locationSnapshots.where('[locationMarkerId+eventId]').equals([placeId, eventId]).first()
      if (here) {
        if (here.status !== status) await journalUpdate('locationSnapshot', db.locationSnapshots, here.id, { status, updatedAt: Date.now() })
      } else {
        const before = await placeStateBefore(placeId, eventId)
        await upsertLocationSnapshot({ worldId, locationMarkerId: placeId, eventId, status, notes: before?.notes ?? '' })
      }
    }
  }, { label: 'The place at this scene' })
}
