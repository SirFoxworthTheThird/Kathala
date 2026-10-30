import { repointNameScenes } from './characterNameScenes'
import type { Table } from 'dexie'
import { db } from '@/db/database'
import { journalDelete, journalGroup, journalUpdate } from './useOperations'
import { captureSceneRevision } from './useManuscript'
import { bulkMoveEvents, createChapterAt, createEventAt, deleteChapter, deleteEvent, updateChapter } from './useTimeline'
import { compareByPosition } from '@/lib/fractionalOrder'
import { recomputeSnapshotSortKeysForEvent } from '@/lib/sortKey'
import { joinProse, mergeChapterFields, mergeSceneFields, splitCarries, splitProse } from '@/lib/sceneStructure'
import { wordCount } from '@/lib/manuscript'
import { pageChapterNumber } from '@/lib/chapterNumbering'
import { joinedOnto, type PersonRecord } from '@/lib/personState'
import { generateId } from '@/lib/id'
import { inBookChapterOrder } from '@/lib/timelineOrder'
import type { Chapter, WorldEvent } from '@/types'
import type { OperationEntity } from '@/types/operation'

/**
 * Splitting a scene in two and joining two into one, as single undoable acts.
 *
 * The rules — where the cut falls, what the halves carry, how two scenes'
 * fields combine — are `src/lib/sceneStructure.ts`. This is the writing, and
 * the thing that makes it hard: a scene is pointed at from a dozen tables, and
 * every pointer has to be accounted for, and put back by undo.
 */

type Row = { id: string; worldId: string; eventId: string } & Record<string, unknown>

/**
 * Records that belong to one scene and one thing in it — at most one per
 * pair, so a join has to decide which to keep when both scenes have one. The
 * later scene's wins: the joined scene ends where the later one ended, and a
 * state recorded at its end is the one that is true after it. A person's
 * record wins facet by facet: it says only what its scene said, and what the
 * earlier scene alone said of them is kept (`joinedOnto`).
 */
const PER_SCENE: Array<{ entity: OperationEntity; table: () => Table<Row, string>; key: (r: Row) => string }> = [
  { entity: 'characterSnapshot', table: () => db.characterSnapshots as never, key: (r) => String(r.characterId) },
  { entity: 'itemPlacement', table: () => db.itemPlacements as never, key: (r) => String(r.itemId) },
  { entity: 'locationSnapshot', table: () => db.locationSnapshots as never, key: (r) => String(r.locationMarkerId) },
  { entity: 'itemSnapshot', table: () => db.itemSnapshots as never, key: (r) => String(r.itemId) },
  // A collective item's statements are each person's: one per item and person at a scene.
  { entity: 'itemCustody', table: () => db.itemCustody as never, key: (r) => `${String(r.itemId)}|${r.has === undefined ? '' : String(r.holderId)}` },
  { entity: 'relationshipSnapshot', table: () => db.relationshipSnapshots as never, key: (r) => String(r.relationshipId) },
  { entity: 'mapRegionSnapshot', table: () => db.mapRegionSnapshots as never, key: (r) => String(r.regionId) },
  { entity: 'characterMovement', table: () => db.characterMovements as never, key: (r) => String(r.characterId) },
  { entity: 'knowledgeReveal', table: () => db.knowledgeReveals as never, key: (r) => `${String(r.factId)}|${String(r.characterId)}` },
]

/** Records that point at a scene — a goal's span, when a fact is learned — and are repointed, not merged. */
const POINTERS: Array<{ entity: OperationEntity; table: () => Table<Record<string, unknown> & { id: string; worldId: string }, string>; fields: string[] }> = [
  { entity: 'characterGoal', table: () => db.characterGoals as never, fields: ['startEventId', 'endEventId'] },
  { entity: 'factionMembership', table: () => db.factionMemberships as never, fields: ['startEventId', 'endEventId'] },
  { entity: 'knowledgeFact', table: () => db.knowledgeFacts as never, fields: ['readerLearnsAtEventId', 'originEventId'] },
  { entity: 'lorePage', table: () => db.lorePages as never, fields: ['visibleFromEventId'] },
  { entity: 'relationship', table: () => db.relationships as never, fields: ['startEventId'] },
  { entity: 'plotThread', table: () => db.plotThreads as never, fields: ['resolvedEventId'] },
]

/**
 * Run `fn` as one transaction over every table, so an act that writes several
 * records — a scene made and prose moved into it, a scene removed and its
 * prose joined to the one before — lands whole or not at all.
 *
 * Each of those writes used to be its own transaction, and a page closed
 * between them kept the half already written: a join that had removed the
 * second scene, with its prose, and not yet written the joined prose lost both
 * the scene and its words; a split left its new scene empty with its prose
 * still in the first. The close-anywhere harness found both
 * (`e2e/closeAnywhere.spec.ts`, next-plan.md Part A).
 *
 * Everything awaited inside has to be IndexedDB, or the transaction commits
 * early and the next write throws (`PrematureCommitError`).
 */
export function inOneWrite<T>(fn: () => Promise<T>): Promise<T> {
  // An `async` scope, not `fn` as given: Dexie follows native awaits only in a scope it can see is async, and
  // `() => joinWithNextNow(…)` is not — the join's first awaited delete let the transaction commit under it.
  return db.transaction('rw', db.tables, async () => await fn())
}

async function inChapterOrder(chapterId: string): Promise<WorldEvent[]> {
  return (await db.events.where('chapterId').equals(chapterId).toArray()).sort(compareByPosition)
}

async function proseOf(eventId: string): Promise<string | null> {
  return (await db.sceneTexts.where('eventId').equals(eventId).first())?.text ?? null
}

/**
 * Write a scene's prose as part of a restructuring. Not `setSceneText`: moving
 * words between scenes is not writing them, so it logs no writing progress. The
 * outgoing text is kept in the scene's History, forced past the usual
 * coalescing, so the version from before the restructuring is always there.
 */
async function replaceProse(worldId: string, eventId: string, text: string | null): Promise<void> {
  const existing = await db.sceneTexts.where('eventId').equals(eventId).first()
  const now = Date.now()
  if (existing && existing.text !== (text ?? '')) {
    await captureSceneRevision(worldId, eventId, existing.text, existing.wordCount ?? 0, now, true)
  }
  if (!text || !text.trim()) {
    if (existing) await db.sceneTexts.delete(existing.id)
    return
  }
  if (existing) await db.sceneTexts.update(existing.id, { text, wordCount: wordCount(text), updatedAt: now })
  else await db.sceneTexts.add({ id: generateId(), worldId, eventId, text, wordCount: wordCount(text), createdAt: now, updatedAt: now })
}

/**
 * Split a scene at `at` — an offset into its prose — into itself and a new
 * scene straight after it titled `title`. The new scene carries the room and
 * who is in it (`splitCarries`) — when it has prose to carry them with; a cut
 * at the very end is a new, empty scene. Its prose is everything after the cut. Nothing
 * recorded at the scene moves: its states stay on the first half, and the
 * second half reads them back as the last known. One undo takes it all back,
 * prose included. Returns the new scene. `id`, when given, is the new scene's.
 * `carry: false` carries nothing even so: the Page's for a pasted heading, whose
 * prose is new writing rather than the rest of the scene it landed in.
 * `prose`, when given, is the new scene's prose instead of what follows the cut.
 */
export async function splitScene(eventId: string, at: number, title: string, opts: { id?: string; carry?: boolean; prose?: string } = {}): Promise<WorldEvent | undefined> {
  return inOneWrite(() => splitSceneNow(eventId, at, title, opts))
}

async function splitSceneNow(eventId: string, at: number, title: string, opts: { id?: string; carry?: boolean; prose?: string }): Promise<WorldEvent | undefined> {
  const scene = await db.events.get(eventId)
  if (!scene) return undefined
  const before = await proseOf(eventId)
  const split = splitProse(before ?? '', at)
  const head = split.head
  // `prose`: the Page's, for a pasted scene whose header block is its header and not the start of its prose.
  const tail = opts.prose ?? split.tail
  const index = (await inChapterOrder(scene.chapterId)).findIndex((e) => e.id === eventId) + 1

  /*
    A cut with nothing after it moves no prose: it is a new scene, and what the
    writer says about it is still to come. Carrying the room and the cast there
    was a guess, and a writer run found it wrong in seven of its first eight
    scenes — each started on the Page with `## Title` at the end of the last,
    and each then kept a setting and a cast it never had, under a header line
    the writer's own typed one could not replace.
  */
  const carries = tail.trim() && opts.carry !== false ? splitCarries(scene) : {}
  const created = await journalGroup(async () => {
    const made = await createEventAt(scene.chapterId, index, title, { ...carries, ...(opts.id ? { id: opts.id } : {}) })
    if (!made) return undefined
    // The prose, on an operation of the act, so undo and redo move it too.
    await journalUpdate('event', db.events, eventId, { updatedAt: Date.now() }, [], {
      prose: [
        { eventId, before, after: head || null },
        { eventId: made.id, before: null, after: tail || null },
      ],
    })
    return made
  }, { label: tail.trim() ? `Split “${scene.title || 'Untitled scene'}”` : `Added “${title || 'Untitled scene'}”` })
  if (!created) return undefined
  await replaceProse(scene.worldId, eventId, head)
  await replaceProse(scene.worldId, created.id, tail)
  return created
}

/** The scene after `eventId` in its chapter, if there is one to join. */
export async function nextInChapter(eventId: string): Promise<WorldEvent | undefined> {
  const scene = await db.events.get(eventId)
  if (!scene) return undefined
  const order = await inChapterOrder(scene.chapterId)
  return order[order.findIndex((e) => e.id === eventId) + 1]
}

/**
 * Join the next scene in the chapter onto this one, and remove it.
 *
 * - The prose is this scene's, a paragraph break, then the next one's.
 * - The fields combine by `mergeSceneFields`.
 * - Everything recorded at the next scene moves here; where both recorded
 *   something about the same character, item or place, the next scene's is
 *   kept (see `PER_SCENE`).
 * - Everything that pointed at the next scene points here.
 *
 * One undo takes it all back: the scene returns with its prose, its records
 * and everything pointing at it. Returns whether there was a scene to join.
 *
 * `prose`, when given, is the joined scene's prose instead of the two stored
 * ones put together: the Page view's, where the writer may have deleted words
 * either side of the heading along with it.
 */
export async function joinWithNext(eventId: string, opts: { prose?: string } = {}): Promise<boolean> {
  return inOneWrite(() => joinWithNextNow(eventId, opts))
}

async function joinWithNextNow(eventId: string, opts: { prose?: string }): Promise<boolean> {
  const first = await db.events.get(eventId)
  const second = await nextInChapter(eventId)
  if (!first || !second) return false
  const firstProse = await proseOf(first.id)
  const joined = opts.prose ?? joinProse(firstProse, await proseOf(second.id))

  await journalGroup(async () => {
    for (const { entity, table, key } of PER_SCENE) {
      const t = table()
      const here = await t.where('eventId').equals(first.id).toArray()
      for (const row of await t.where('eventId').equals(second.id).toArray()) {
        const clash = here.find((h) => key(h) === key(row))
        if (clash) await journalDelete(entity, t as never, clash.id, async () => { await t.delete(clash.id) })
        // A person's record says only what its scene said (Part B2): what the earlier one said and the later did not, it says too.
        const kept = clash && entity === 'characterSnapshot' ? joinedOnto(row as unknown as PersonRecord, clash as unknown as PersonRecord) : {}
        await journalUpdate(entity, t as never, row.id, { ...kept, eventId: first.id, updatedAt: Date.now() })
      }
    }

    for (const { entity, table, fields } of POINTERS) {
      const t = table()
      for (const row of await t.where('worldId').equals(first.worldId).toArray()) {
        const moved: Record<string, unknown> = {}
        for (const f of fields) if (row[f] === second.id) moved[f] = first.id
        if (Object.keys(moved).length > 0) await journalUpdate(entity, t as never, row.id, { ...moved, updatedAt: Date.now() })
      }
    }

    // A frame narrative's sync points name scenes inside a list on the record.
    for (const rel of await db.timelineRelationships.where('worldId').equals(first.worldId).toArray()) {
      if (!rel.syncPoints.some((p) => p.innerEventId === second.id || p.outerEventId === second.id)) continue
      const syncPoints = rel.syncPoints.map((p) => ({
        innerEventId: p.innerEventId === second.id ? first.id : p.innerEventId,
        outerEventId: p.outerEventId === second.id ? first.id : p.outerEventId,
      }))
      await journalUpdate('timelineRelationship', db.timelineRelationships, rel.id, { syncPoints, updatedAt: Date.now() })
    }

    // A name change at the scene that goes follows it into the one that stays, rather than moving on past both.
    await repointNameScenes(first.worldId, second.id, first.id)

    // Nothing is left pointing at it but its own prose and history, which go with it.
    await deleteEvent(second.id)

    /*
      The joined scene's fields and prose last, so the act undo names is the
      edit to the scene that remains rather than the removal of the other.
    */
    await journalUpdate('event', db.events, first.id, { ...mergeSceneFields(first, second), updatedAt: Date.now() }, [], {
      prose: [{ eventId: first.id, before: firstProse, after: joined || null }],
    })
  }, { quiet: true, label: `Joined “${second.title || 'Untitled scene'}” into “${first.title || 'Untitled scene'}”` })

  await recomputeSnapshotSortKeysForEvent(first.id)
  await replaceProse(first.worldId, first.id, joined)
  return true
}

/** A timeline's chapters in book order. */
async function chaptersInOrder(timelineId: string): Promise<Chapter[]> {
  return (await db.chapters.where('timelineId').equals(timelineId).toArray())
    .sort((a, b) => a.number - b.number || a.id.localeCompare(b.id))
}

/** Every timeline's chapters, as the book reads them (`inBookChapterOrder`). */
async function bookChaptersInOrder(worldId: string): Promise<Chapter[]> {
  const [chapters, timelines] = await Promise.all([
    db.chapters.where('worldId').equals(worldId).toArray(),
    db.timelines.where('worldId').equals(worldId).toArray(),
  ])
  return inBookChapterOrder(chapters, timelines)
}

/**
 * Start a chapter inside `chapterId`: a new chapter, titled `title`, straight
 * after it, holding every scene after `afterSceneId` — or every scene, when it
 * is `null`. With `split`, the scene `afterSceneId` is cut at `split.at` first,
 * and the rest of its prose goes on as the new chapter's first scene, under the
 * same title; a chapter holds scenes, and that prose needs one.
 *
 * The new chapter takes the number after this one's, or the next chapter's
 * where that is closer — numbers are positions, and `createChapterAt` moves
 * the book's chapters after it up, in every timeline. Started after the last
 * scene of its timeline's last chapter, it goes at the end of the book instead
 * (`pageChapterNumber`). One act, so one undo. Returns the new chapter.
 *
 * `atTimelineEnd` is the caller saying so where the store cannot tell: a
 * pasted chapter's own scenes are made before its heading is, so its chapter
 * no longer ends where the heading is — and writer run 10's pasted chapter went
 * straight after its era's last chapter, in front of the other eras'. Where
 * chapters after this one in the timeline are the paste's own, it takes the
 * first of their places, so a paste of several keeps their order.
 */
export async function startChapter(opts: {
  chapterId: string
  afterSceneId: string | null
  title: string
  id?: string
  split?: { at: number; id?: string }
  atTimelineEnd?: boolean
  /**
   * Typed on *All timelines*: the chapter after it is the book's next, of
   * whichever timeline, rather than its own timeline's. It still takes the
   * timeline of the chapter it was typed in (run-10 plan, Decision 1).
   */
  inBook?: boolean
}): Promise<Chapter | undefined> {
  return inOneWrite(() => startChapterNow(opts))
}

async function startChapterNow(opts: Parameters<typeof startChapter>[0]): Promise<Chapter | undefined> {
  const chapter = await db.chapters.get(opts.chapterId)
  if (!chapter) return undefined
  const chapters = opts.inBook ? await bookChaptersInOrder(chapter.worldId) : await chaptersInOrder(chapter.timelineId)
  const next = chapters[chapters.findIndex((c) => c.id === chapter.id) + 1]
  // Nothing comes with it: started after the chapter's last scene, unsplit.
  const scenes = await inChapterOrder(chapter.id)
  const empty = !opts.split && (opts.afterSceneId === null ? scenes.length === 0 : scenes[scenes.length - 1]?.id === opts.afterSceneId)
  const book = await db.chapters.where('worldId').equals(chapter.worldId).toArray()
  const atEnd = opts.atTimelineEnd ?? (!next && empty)
  const number = atEnd && next ? next.number : pageChapterNumber(book, chapter, atEnd)
  return journalGroup(async () => {
    const made = await createChapterAt({
      worldId: chapter.worldId, timelineId: chapter.timelineId, number, title: opts.title, synopsis: '',
      ...(opts.id ? { id: opts.id } : {}),
    })
    const before = await inChapterOrder(chapter.id)
    const from = opts.afterSceneId ? before.findIndex((e) => e.id === opts.afterSceneId) + 1 : 0
    if (opts.split && opts.afterSceneId) {
      await splitScene(opts.afterSceneId, opts.split.at, before[from - 1].title, { id: opts.split.id })
    }
    const moving = (await inChapterOrder(chapter.id)).slice(from).map((e) => e.id)
    await bulkMoveEvents(moving, made.id)
    return made
  }, { label: `Started chapter “${opts.title}”` })
}

/**
 * Set the prose of many scenes as one act — Find & replace's **Replace all**.
 * One transaction, so the book changes all at once or not at all, and one
 * journal group, so one undo puts every scene back. Each scene's outgoing text
 * is also kept in its History (`replaceProse`).
 *
 * Writer run 10 replaced 518 matches across 36 scenes one awaited write at a
 * time: the dialog's live count fell scene by scene while it worked, and a
 * second press ran again over a list already half replaced.
 *
 * `also` runs inside the same act: the dialog renames characters there.
 */
export async function replaceSceneTexts(
  worldId: string,
  changes: readonly { eventId: string; text: string }[],
  opts: { label: string; also?: () => Promise<void> },
): Promise<void> {
  if (changes.length === 0 && !opts.also) return
  await db.transaction(
    'rw',
    [db.events, db.sceneTexts, db.sceneRevisions, db.characters, db.operations, db.tombstones],
    () => journalGroup(async () => {
      for (const { eventId, text } of changes) {
        const before = await proseOf(eventId)
        if (before === text) continue
        await journalUpdate('event', db.events, eventId, { updatedAt: Date.now() }, [], {
          prose: [{ eventId, before, after: text || null }],
        })
        await replaceProse(worldId, eventId, text)
      }
      await opts.also?.()
    }, { label: opts.label }),
  )
}

/**
 * Join a chapter onto the one before it: its scenes to the end of that
 * chapter, in order, its synopsis, notes and word goal into that chapter's (see
 * `mergeChapterFields`), and the chapter itself removed. Nothing but scenes
 * points at a chapter, and they have all moved. One act, so one undo. Returns
 * whether there was a chapter before it to join.
 *
 * `prose`, from the Page view, is a scene's prose as the join leaves it: the
 * chapter's `#` taken away keeps its title as the last line of the chapter
 * before's last scene. Written in the same act, so the one undo takes it back.
 */
export async function joinChapterToPrevious(
  chapterId: string,
  opts: { prose?: { eventId: string; text: string }; inBook?: boolean } = {},
): Promise<boolean> {
  return inOneWrite(() => joinChapterToPreviousNow(chapterId, opts))
}

async function joinChapterToPreviousNow(
  chapterId: string,
  opts: { prose?: { eventId: string; text: string }; inBook?: boolean },
): Promise<boolean> {
  const chapter = await db.chapters.get(chapterId)
  if (!chapter) return false
  // On *All timelines* the chapter before is the book's, of whichever timeline, and its scenes take that one's.
  const chapters = opts.inBook ? await bookChaptersInOrder(chapter.worldId) : await chaptersInOrder(chapter.timelineId)
  const previous = chapters[chapters.findIndex((c) => c.id === chapterId) - 1]
  if (!previous) return false
  const prose = opts.prose
  const proseBefore = prose ? await proseOf(prose.eventId) : null
  await journalGroup(async () => {
    await bulkMoveEvents((await inChapterOrder(chapterId)).map((e) => e.id), previous.id)
    await updateChapter(previous.id, mergeChapterFields(previous, chapter))
    await deleteChapter(chapterId)
    if (prose) {
      await journalUpdate('event', db.events, prose.eventId, { updatedAt: Date.now() }, [], {
        prose: [{ eventId: prose.eventId, before: proseBefore, after: prose.text || null }],
      })
    }
  }, { quiet: true, label: `Joined chapter “${chapter.title}” into “${previous.title}”` })
  if (prose) await replaceProse(chapter.worldId, prose.eventId, prose.text)
  return true
}
