import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { WritingSprint } from '@/types'
import { generateId } from '@/lib/id'
import { overdue, plannedEnd } from '@/lib/sprints'

/*
  Writing sprints in the store (issue #706, sprints-plan.md). A sprint's words
  are counted by `logWritingProgress` as they are saved (D-5); these start,
  pause, resume and end it. Each act reads and writes the row in one
  transaction, so two tabs acting at once cannot both win.
*/

/** A world's sprints, for the dashboard. */
export function useWorldSprints(worldId: string | null): WritingSprint[] {
  return useLiveQuery(
    () => (worldId ? db.sprints.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    [],
  )
}

/** The world's sprint still open, running or paused, or null. */
export function useOpenSprint(worldId: string | null): WritingSprint | null {
  return useLiveQuery(
    async () => (worldId ? (await openSprint(worldId)) ?? null : null),
    [worldId],
    null,
  )
}

export async function openSprint(worldId: string): Promise<WritingSprint | undefined> {
  return (await db.sprints.where('worldId').equals(worldId).toArray()).find((s) => s.endedAt === null)
}

/** Start a sprint of `minutes`; null when the world has one open already (D-7: one at a time). */
export async function startSprint(worldId: string, minutes: number, now = Date.now()): Promise<WritingSprint | null> {
  return db.transaction('rw', db.sprints, async () => {
    if (await openSprint(worldId)) return null
    const sprint: WritingSprint = {
      id: generateId(), worldId, startedAt: now, plannedMs: minutes * 60_000, pausedMs: 0, pausedAt: null,
      endedAt: null, wordsAdded: 0, wordsCut: 0, eventIds: [], createdAt: now, updatedAt: now,
    }
    await db.sprints.add(sprint)
    return sprint
  })
}

async function change(id: string, fn: (s: WritingSprint) => Partial<WritingSprint> | null): Promise<WritingSprint | null> {
  return db.transaction('rw', db.sprints, async () => {
    const s = await db.sprints.get(id)
    if (!s || s.endedAt !== null) return null
    const patch = fn(s)
    if (!patch) return null
    await db.sprints.update(id, patch)
    return { ...s, ...patch }
  })
}

export function pauseSprint(id: string, now = Date.now()) {
  return change(id, (s) => (s.pausedAt === null ? { pausedAt: now, updatedAt: now } : null))
}

export function resumeSprint(id: string, now = Date.now()) {
  return change(id, (s) => (s.pausedAt !== null ? { pausedMs: s.pausedMs + Math.max(0, now - s.pausedAt), pausedAt: null, updatedAt: now } : null))
}

/** End it now, before its time: the writer stopped it. */
export function stopSprint(id: string, now = Date.now()) {
  return change(id, (s) => ({
    pausedMs: s.pausedMs + (s.pausedAt !== null ? Math.max(0, now - s.pausedAt) : 0),
    pausedAt: null, endedAt: now, ended: 'stopped', updatedAt: now,
  }))
}

/** End it at its planned end: its time ran out, with the page open (`done`) or closed (`closed`). */
export function finishSprint(id: string, how: 'done' | 'closed', now = Date.now()) {
  return change(id, (s) => (s.pausedAt === null ? { endedAt: plannedEnd(s, now), ended: how, updatedAt: now } : null))
}

/** End every sprint of the world whose time ran out while no page was open to end it (D-6). */
export async function closeOverdueSprints(worldId: string, now = Date.now()): Promise<WritingSprint[]> {
  const closed: WritingSprint[] = []
  for (const s of await db.sprints.where('worldId').equals(worldId).toArray()) {
    if (!overdue(s, now)) continue
    const done = await finishSprint(s.id, 'closed', now)
    if (done) closed.push(done)
  }
  return closed
}
