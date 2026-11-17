import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { SceneText } from '@/types'
import { generateId } from '@/lib/id'
import { wordCount } from '@/lib/manuscript'
import { logWritingProgress } from '@/db/hooks/useWritingLog'
import { createWorld } from '@/db/hooks/useWorlds'

/** Keep at most this many past versions per scene; oldest are pruned. */
export const MAX_SCENE_REVISIONS = 20
/** Successive saves within this window collapse into one revision boundary. */
export const REVISION_COALESCE_MS = 2 * 60 * 1000

/**
 * Record `text` as a past version of a scene. Time-coalesced: within
 * `REVISION_COALESCE_MS` of the latest revision it's a no-op (so a burst of
 * autosaves yields one snapshot), unless `force` is set. Exact duplicates of the
 * latest revision are always skipped. Prunes to `MAX_SCENE_REVISIONS`.
 */
export async function captureSceneRevision(
  worldId: string,
  eventId: string,
  text: string,
  count: number,
  now = Date.now(),
  force = false,
  /**
   * A run of Find & replace changes keeps one version, from before its first:
   * a change within `REVISION_COALESCE_MS` of the run's last is the same run.
   * Each single replacement kept a version of its own, forced, and twenty-one
   * of them in one scene left none of the versions written before
   * (round-trip-plan-3.md, T13, S6).
   */
  run?: 'replace',
): Promise<void> {
  if (!text.trim()) return
  const latest = await db.sceneRevisions
    .where('[eventId+createdAt]').between([eventId, 0], [eventId, Infinity]).last()

  if (latest) {
    if (latest.text === text) return // no change since last snapshot
    if (run && latest.run === run && now - (latest.runUntil ?? latest.createdAt) < REVISION_COALESCE_MS) {
      await db.sceneRevisions.update(latest.id, { runUntil: now }) // the same run, carried on
      return
    }
    if (!force && now - latest.createdAt < REVISION_COALESCE_MS) return // same session
  }

  await db.sceneRevisions.add({ id: generateId(), worldId, eventId, text, wordCount: count, createdAt: now, ...(run ? { run, runUntil: now } : {}) })

  const all = await db.sceneRevisions
    .where('[eventId+createdAt]').between([eventId, 0], [eventId, Infinity]).toArray()
  if (all.length > MAX_SCENE_REVISIONS) {
    const excess = all.slice(0, all.length - MAX_SCENE_REVISIONS) // ascending by createdAt
    await db.sceneRevisions.bulkDelete(excess.map((r) => r.id))
  }
}
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'
import type { ParsedManuscript } from '@/lib/manuscriptImport'
import type { DraftComment, DraftPart } from '@/lib/docxDraft'
import { anchorFrom } from '@/lib/noteAnchor'
import { commentTime } from '@/lib/markedDocx'
import { addProseNote, replyToProseNote, setProseNoteResolved } from '@/db/hooks/useProseNotes'

/**
 * The scene prose for a single event: undefined while it loads, null once it
 * has loaded and there is none. The two used to be one `undefined`, which left
 * nothing able to wait for the text to arrive — a caret placed "at the end" on
 * arrival landed at 0 in the empty box shown while it loaded.
 */
export function useSceneText(eventId: string | null) {
  return useLiveQuery(
    async () => (eventId ? (await db.sceneTexts.where('eventId').equals(eventId).first()) ?? null : null),
    [eventId]
  )
}

/**
 * All scene texts in a world, and undefined until they are read: for a view
 * that must not take "not read yet" for "empty" — the editor's changes tried
 * against their scenes, where an empty scene would say every one was gone
 * (round-trip-plan-3.md, T11.1).
 */
export function useWorldSceneTextsOnceRead(worldId: string | null) {
  return useLiveQuery(() => (worldId ? db.sceneTexts.where('worldId').equals(worldId).toArray() : []), [worldId])
}

/** All scene texts in a world — used for aggregate views (totals, pacing). */
export function useWorldSceneTexts(worldId: string | null) {
  return useLiveQuery(
    () => (worldId ? db.sceneTexts.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    []
  )
}

/**
 * Whether this world has any prose at all — `undefined` until Dexie answers.
 *
 * Reading mode offers the book itself only when there is a book to offer: seven
 * of the shipped worlds are structural notes with no text, and their catalogue
 * entries say so. The nav and the router both ask this, and both have to wait
 * for the real answer rather than assume one. Answering "no" early takes the
 * Read screen away from a reader who does have a book, and bounces them to the
 * dashboard if they were already on it; answering "yes" early opens a screen
 * with nothing in it.
 *
 * So the loading state is deliberately not defaulted away, unlike
 * `useWorldSceneTexts` above: `useLiveQuery` returns `undefined` before its
 * first result, and that third state is the point. A gate that answers
 * confidently while it is still loading is the bug that hid the relationship
 * graph's labels (R13); this is the same shape, so it is left visible.
 */
export function useHasProse(worldId: string | null): boolean | undefined {
  return useLiveQuery(
    async () => (worldId ? (await db.sceneTexts.where('worldId').equals(worldId).count()) > 0 : false),
    [worldId],
  )
}

/**
 * All scene texts for a timeline's events, keyed by eventId for quick lookup.
 *
 * Memoised on the array `useLiveQuery` hands back, which is stable between
 * emissions. Without it this returns a new Map on every render, and that
 * reference is a dependency of `buildManuscript`'s `useMemo` in ManuscriptView
 * and, through the manuscript it produces, of the reading cursor's
 * IntersectionObserver effect — so both were redone on every render, the
 * observer being torn down and rebuilt among them.
 *
 * Correctness of intent rather than speed: a memo that never hits is not a
 * memo. The reading screen was measured either way on *The Count of Monte
 * Cristo*, 459,375 words, and sixty wheel-scrolls took 2,876ms with it against
 * 2,910ms without, with no long tasks recorded in either. Compiling the
 * manuscript is cheap — word counts come precomputed from the row and the
 * paragraph splitting happens at render — so do not expect this to make
 * anything faster.
 */
export function useSceneTextsByEvent(worldId: string | null) {
  const texts = useWorldSceneTexts(worldId)
  return useMemo(() => new Map(texts.map((t) => [t.eventId, t])), [texts])
}

/**
 * Create or update the prose for an event's scene. One SceneText per event —
 * looks up any existing record and overwrites it, recomputing the word count.
 * Passing empty prose deletes the record so blank scenes leave no residue.
 */
export async function setSceneText(
  worldId: string,
  eventId: string,
  text: string,
  opts: { captureRevision?: boolean } = {}
): Promise<void> {
  const { captureRevision = true } = opts
  const existing = await db.sceneTexts.where('eventId').equals(eventId).first()
  const now = Date.now()
  const oldCount = existing?.wordCount ?? 0
  const newCount = text.trim() ? wordCount(text) : 0

  // Snapshot the outgoing prose before it's overwritten or cleared.
  if (captureRevision && existing && existing.text.trim() && existing.text !== text) {
    await captureSceneRevision(worldId, eventId, existing.text, existing.wordCount, now)
  }

  if (!text.trim()) {
    if (existing) await db.sceneTexts.delete(existing.id)
    await logWritingProgress(worldId, newCount - oldCount, now)
    return
  }

  if (existing) {
    await db.sceneTexts.update(existing.id, {
      text,
      wordCount: newCount,
      updatedAt: now,
    })
    await logWritingProgress(worldId, newCount - oldCount, now)
    return
  }

  const record: SceneText = {
    id: generateId(),
    worldId,
    eventId,
    text,
    wordCount: newCount,
    createdAt: now,
    updatedAt: now,
  }
  await db.sceneTexts.add(record)
  await logWritingProgress(worldId, newCount - oldCount, now)
}

/**
 * Create a fresh world from a parsed manuscript: one Main Timeline, a chapter
 * per parsed chapter (numbered in order), a scene event per parsed scene, and
 * the prose stored as that event's SceneText. Returns the new world's id.
 *
 * A Word draft (`readDraftDocx`) also gives its parts and its comments
 * (issue #697). A part's name goes in the notes of the chapter it begins
 * (D-3), since Kathala has no parts. Each comment becomes a note on its words,
 * with its replies, its date and whether it was done (D-2); one on a heading
 * or the title page is a note on that line, as an editor's are (T9.4).
 */
export async function createWorldFromManuscript(
  parsed: ParsedManuscript,
  worldName: string,
  draft: { parts?: DraftPart[]; comments?: DraftComment[] } = {},
): Promise<string> {
  const name = worldName.trim() || parsed.title?.trim() || 'Imported Manuscript'
  const world = await createWorld({ name, description: '' })
  const timeline = await createTimeline({
    worldId: world.id,
    name: 'Main Timeline',
    description: '',
    color: '#60a5fa',
  })

  const partNotes = new Map<number, string[]>()
  for (const p of draft.parts ?? []) partNotes.set(p.chapter, [...(partNotes.get(p.chapter) ?? []), `Begins ${p.name}`])

  // Each scene's event and prose, by chapter and scene, for the comments to find.
  const scenes: Array<Array<{ eventId: string; text: string }>> = []
  let chapterNumber = 1
  for (const [ci, pc] of parsed.chapters.entries()) {
    const notes = partNotes.get(ci)
    const chapter = await createChapter({
      worldId: world.id,
      timelineId: timeline.id,
      number: chapterNumber++,
      title: pc.title,
      synopsis: '',
      ...(notes ? { notes: notes.join('\n') } : {}),
    })

    const made: Array<{ eventId: string; text: string }> = []
    let sortOrder = 0
    for (let i = 0; i < pc.scenes.length; i++) {
      const event = await createEvent({
        worldId: world.id,
        chapterId: chapter.id,
        timelineId: timeline.id,
        title: pc.scenes[i].title || `Scene ${i + 1}`,
        description: '',
        locationMarkerId: null,
        involvedCharacterIds: [],
        involvedItemIds: [],
        tags: [],
        sortOrder: sortOrder++,
      })
      await setSceneText(world.id, event.id, pc.scenes[i].text)
      made.push({ eventId: event.id, text: pc.scenes[i].text })
    }
    scenes.push(made)
  }

  for (const c of draft.comments ?? []) await noteFromComment(world.id, c, scenes)

  return world.id
}

/**
 * A draft's comment as a note, on its words; a comment on a point, not a
 * stretch, is on the word it stands before, as an editor's is (`commentsOf`).
 * The writer's own: the draft is theirs (D-2).
 */
async function noteFromComment(
  worldId: string,
  c: DraftComment,
  scenes: Array<Array<{ eventId: string; text: string }>>,
): Promise<void> {
  const scene = scenes[c.chapter]?.[c.outside === 'title page' ? 0 : c.scene] ?? (c.outside === 'title page' ? scenes.find((s) => s.length)?.[0] : undefined)
  if (!scene || !c.comment.text.trim()) return
  let anchor
  if (c.outside) {
    anchor = { eventId: scene.eventId, quote: c.quote, prefix: '', suffix: '' }
  } else {
    let { from, to } = c
    const text = scene.text
    if (to <= from) to = Math.min(text.length, from + (text.slice(from).match(/^\s*\S+/)?.[0].length ?? 0))
    if (to <= from) from = Math.max(0, from - (text.slice(0, from).match(/\S+\s*$/)?.[0].length ?? 0))
    anchor = anchorFrom(scene.eventId, text, from, to)
  }
  if (!anchor) return
  const at = commentTime(c.comment.date)
  const note = await addProseNote({
    worldId, anchor, body: c.comment.text, kind: 'note',
    ...(at !== undefined ? { at } : {}),
    ...(c.outside ? { outside: c.outside } : {}),
  })
  for (const r of c.replies) await replyToProseNote(note.id, r.text, undefined, commentTime(r.date))
  if (c.comment.done) await setProseNoteResolved(note.id, true)
}
