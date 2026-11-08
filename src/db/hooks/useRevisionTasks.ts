import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { journalCreate, journalDelete, journalGroup, journalUpdate } from './useOperations'
import { inOneWrite } from './useSceneStructure'
import { generateId } from '@/lib/id'
import type { RevisionTask, TaskLink, TaskSource } from '@/types'

/*
  Revision tasks (editorial-plan.md, R5). Each write is journalled, so a task
  made, changed, done or deleted is one step of undo, travels with the world,
  and a task deleted leaves a tombstone, so a merge on another device does not
  bring it back. A letter's tasks are added as one act: one step of undo, one
  write.
*/

/** A world's tasks, in the order they were made. */
export function useRevisionTasks(worldId: string | null): RevisionTask[] {
  return useLiveQuery(
    async () => (worldId ? sortTasks(await db.revisionTasks.where('worldId').equals(worldId).toArray()) : []),
    [worldId],
    [] as RevisionTask[],
  )
}

export function sortTasks(tasks: RevisionTask[]): RevisionTask[] {
  return [...tasks].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
}

export interface NewTask {
  text: string
  links?: TaskLink[]
  source?: TaskSource
  group?: string
}

async function nextOrder(worldId: string): Promise<number> {
  const all = await db.revisionTasks.where('worldId').equals(worldId).toArray()
  return all.reduce((n, t) => Math.max(n, t.order + 1), 0)
}

function made(worldId: string, task: NewTask, order: number, now: number): RevisionTask {
  return {
    id: generateId(),
    worldId,
    text: task.text.trim(),
    ...(task.group?.trim() ? { group: task.group.trim() } : {}),
    links: dedupeLinks(task.links ?? []),
    ...(task.source ? { source: task.source } : {}),
    done: false,
    order,
    createdAt: now,
    updatedAt: now,
  }
}

export function dedupeLinks(links: TaskLink[]): TaskLink[] {
  const seen = new Set<string>()
  return links.filter((l) => {
    const key = `${l.kind}:${l.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** A task, at the end of the list. Nothing is made of empty words. */
export async function addRevisionTask(worldId: string, task: NewTask): Promise<RevisionTask | null> {
  if (!task.text.trim()) return null
  return inOneWrite(async () => journalCreate('revisionTask', db.revisionTasks, made(worldId, task, await nextOrder(worldId), Date.now())))
}

/** Several tasks — a letter's — at the end of the list, in their order, as one act. */
export async function addRevisionTasks(worldId: string, tasks: NewTask[]): Promise<RevisionTask[]> {
  const kept = tasks.filter((t) => t.text.trim())
  if (kept.length === 0) return []
  return journalGroup(() => inOneWrite(async () => {
    const start = await nextOrder(worldId)
    const now = Date.now()
    const out: RevisionTask[] = []
    for (const [i, t] of kept.entries()) out.push(await journalCreate('revisionTask', db.revisionTasks, made(worldId, t, start + i, now)))
    return out
  }), { label: `Add ${kept.length === 1 ? 'a task' : `${kept.length} tasks`}` })
}

/** Change what a task says, or what it is linked to. */
export async function updateRevisionTask(id: string, changes: { text?: string; links?: TaskLink[] }): Promise<void> {
  const data: Record<string, unknown> = { updatedAt: Date.now() }
  if (changes.text !== undefined) {
    if (!changes.text.trim()) return
    data.text = changes.text.trim()
  }
  if (changes.links) data.links = dedupeLinks(changes.links)
  await journalUpdate('revisionTask', db.revisionTasks, id, data)
}

/** Done, or open again. A done task is kept: it is the record of the revision. */
export async function setRevisionTaskDone(id: string, done: boolean): Promise<void> {
  const now = Date.now()
  await journalUpdate('revisionTask', db.revisionTasks, id, done
    ? { done: true, doneAt: now, updatedAt: now }
    : { done: false, doneAt: undefined, updatedAt: now })
}

export async function deleteRevisionTask(id: string): Promise<void> {
  await journalDelete('revisionTask', db.revisionTasks, id, async () => {
    await db.revisionTasks.delete(id)
  })
}
