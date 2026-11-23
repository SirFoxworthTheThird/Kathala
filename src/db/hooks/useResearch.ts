import { useLiveQuery } from 'dexie-react-hooks'
import { db, bibleOf } from '@/db/database'
import { journalDelete, journalGroup, journalUpdate, withJournal } from './useOperations'
import { generateId } from '@/lib/id'
import { attached, byOrder, detached, fileProblem, isAttached, linkProblem } from '@/lib/research'
import type { ResearchItem, ResearchLink, ResearchTarget } from '@/types'

/*
  Research and reference material (issue #700, docs/records/research-plan.md).
  An item is a file, a link or a clipping, attached to what it informs. Every
  write is journalled. A file is stored as it came, in `blobs`, and goes with
  its item: deleting the item deletes the file in the same transaction, and
  undo brings both back.
*/

const NONE: ResearchItem[] = []

/** Every research item of a world, in order: in a series, the series' (D-4). */
export function useResearchItems(worldId: string | null | undefined): ResearchItem[] {
  return useLiveQuery(
    async () => (worldId ? (await db.researchItems.where('worldId').equals(bibleOf(worldId)).toArray()).sort(byOrder) : NONE),
    [worldId],
    NONE,
  )
}

/** The research attached to one scene, place, character or item, in order. */
export function useResearchFor(worldId: string | null | undefined, link: ResearchLink | null): ResearchItem[] {
  const all = useResearchItems(worldId)
  return link ? all.filter((i) => isAttached(i, link)) : NONE
}

interface NewResearch {
  title?: string
  note?: string
  attachedTo?: ResearchLink[]
  toWorld?: boolean
}

async function nextOrder(worldId: string): Promise<number> {
  const items = await db.researchItems.where('worldId').equals(bibleOf(worldId)).toArray()
  return items.reduce((n, i) => Math.max(n, i.order), -1) + 1
}

/** Make an item, journalled; `blob`, for a file, is stored with it in the same transaction. */
async function make(item: ResearchItem, blob?: { id: string; data: Blob; mimeType: string }): Promise<ResearchItem> {
  const record = { ...item, version: 1 }
  return withJournal([db.researchItems, db.blobs], {
    worldId: item.worldId,
    entityType: 'researchItem',
    entityId: item.id,
    type: 'create',
    payload: record as unknown as Record<string, unknown>,
    apply: async () => {
      if (blob) await db.blobs.add({ id: blob.id, worldId: bibleOf(item.worldId), mimeType: blob.mimeType, data: blob.data, createdAt: item.createdAt })
      await db.researchItems.add(record)
      return record
    },
  })
}

function base(worldId: string, kind: ResearchItem['kind'], n: NewResearch, order: number): ResearchItem {
  const now = Date.now()
  return {
    id: generateId(),
    worldId,
    kind,
    title: n.title?.trim() ?? '',
    note: n.note?.trim() ?? '',
    attachedTo: n.attachedTo ?? [],
    toWorld: n.toWorld ?? false,
    order,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Add a file — an image or a PDF, at most 20 MB (D-2) — stored as it came,
 * never recompressed. Refused with why for anything else.
 */
export async function addResearchFile(worldId: string, file: File, n: NewResearch = {}): Promise<ResearchItem> {
  const problem = fileProblem(file)
  if (problem) throw new Error(problem)
  const item = base(worldId, 'file', { ...n, title: n.title?.trim() || file.name.replace(/\.[^.]+$/, '') }, await nextOrder(worldId))
  const blobId = generateId()
  return make({ ...item, blobId, mimeType: file.type, size: file.size, fileName: file.name }, { id: blobId, data: file, mimeType: file.type })
}

/** Add a web link. Nothing is fetched from it, now or later. */
export async function addResearchLink(worldId: string, url: string, n: NewResearch = {}): Promise<ResearchItem> {
  const problem = linkProblem(url)
  if (problem) throw new Error(problem)
  const item = base(worldId, 'link', { ...n, title: n.title?.trim() || new URL(url.trim()).hostname }, await nextOrder(worldId))
  return make({ ...item, url: url.trim() })
}

/** Add a clipping: pasted words, and where they came from. */
export async function addResearchClip(worldId: string, text: string, source: string, n: NewResearch = {}): Promise<ResearchItem> {
  if (!text.trim()) throw new Error('A clipping needs its words.')
  const firstLine = text.trim().split('\n')[0]
  const item = base(worldId, 'clip', { ...n, title: n.title?.trim() || (firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine) }, await nextOrder(worldId))
  return make({ ...item, text: text.trim(), source: source.trim() || undefined })
}

/** Change an item's words, or whether it is on the world. A file's bytes do not change. */
export async function updateResearchItem(id: string, patch: Partial<Pick<ResearchItem, 'title' | 'note' | 'url' | 'text' | 'source' | 'toWorld'>>): Promise<void> {
  if (patch.url !== undefined) {
    const problem = linkProblem(patch.url)
    if (problem) throw new Error(problem)
  }
  await journalUpdate('researchItem', db.researchItems, id, { ...patch, updatedAt: Date.now() })
}

/** Attach an item to a scene, place, character or item. */
export async function attachResearch(id: string, link: ResearchLink): Promise<void> {
  const item = await db.researchItems.get(id)
  if (!item || isAttached(item, link)) return
  await journalUpdate('researchItem', db.researchItems, id, { attachedTo: attached(item.attachedTo, link), updatedAt: Date.now() })
}

/** Take an item off a scene, place, character or item. The item stays. */
export async function detachResearch(id: string, link: ResearchLink): Promise<void> {
  const item = await db.researchItems.get(id)
  if (!item || !isAttached(item, link)) return
  await journalUpdate('researchItem', db.researchItems, id, { attachedTo: detached(item.attachedTo, link), updatedAt: Date.now() })
}

/**
 * What a delete of scenes, places, characters or items does to research
 * (D-5): takes them out of every item's list, journalled, so the delete's
 * undo puts them back. The items stay; one left holding nothing, and not on
 * the world, is listed as attached to nothing.
 */
export async function detachEverywhere(kind: ResearchTarget, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return
  const gone = new Set(ids)
  const touched = (await db.researchItems.toArray()).filter((i) => i.attachedTo.some((l) => l.kind === kind && gone.has(l.id)))
  if (touched.length === 0) return
  await journalGroup(async () => {
    for (const item of touched) {
      await journalUpdate('researchItem', db.researchItems, item.id, {
        attachedTo: item.attachedTo.filter((l) => !(l.kind === kind && gone.has(l.id))),
        updatedAt: Date.now(),
      })
    }
  })
}

/** Put items in the order of `ids`: the Research list's, and a mood board's (D-1). */
export async function reorderResearch(ids: readonly string[]): Promise<void> {
  const items = await db.researchItems.bulkGet([...ids])
  // Each keeps the slots the reordered set had, so the rest of the list stays where it was.
  const slots = items.filter((i): i is ResearchItem => !!i).map((i) => i.order).sort((a, b) => a - b)
  await journalGroup(async () => {
    for (const [k, id] of ids.entries()) {
      const item = items[k]
      if (item && item.order !== slots[k]) await journalUpdate('researchItem', db.researchItems, id, { order: slots[k], updatedAt: Date.now() })
    }
  }, { label: 'Reordered research' })
}

/** Delete an item, and its file with it; one undo brings both back. */
export async function deleteResearchItem(id: string): Promise<void> {
  await journalDelete('researchItem', db.researchItems, id, async (item) => {
    await db.researchItems.delete(id)
    if (item.blobId) {
      const sharing = await db.researchItems.filter((i) => i.blobId === item.blobId).count()
      if (sharing === 0) await db.blobs.delete(item.blobId)
    }
  }, [db.blobs])
}
