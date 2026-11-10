import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { generateId } from '@/lib/id'
import { readEditedDocx } from '@/lib/docxRead'
import { applyHunk, planImport, runTogether, type ImportPlan } from '@/lib/docxImport'
import { currentBook, openBookDraft, saveBookDraft } from '@/db/hooks/useBookDrafts'
import { inOneWrite } from '@/db/hooks/useSceneStructure'
import { captureSceneRevision, setSceneText } from '@/db/hooks/useManuscript'
import { journalGroup, journalUpdate } from '@/db/hooks/useOperations'
import { addProseNote, replyToProseNote } from '@/db/hooks/useProseNotes'
import type { EditSuggestion } from '@/types'

/*
  An editor's Word file, brought into the book (editorial-plan.md, R4), and
  their changes decided one by one.

  Bringing it in writes nothing to the prose. It saves a draft of the book
  first — the way back to before, whatever is accepted — then, in one write,
  every change as a suggestion and every comment as a note by the editor.
  Accepting a suggestion writes it into the scene's prose as it is then, in one
  write with the suggestion's going; the scene's History keeps what it said.
*/

/** A world's suggestions waiting to be decided, by scene and in the file's order. */
export function useEditSuggestions(worldId: string | null): EditSuggestion[] {
  return useLiveQuery(
    async () => (worldId ? (await db.editSuggestions.where('worldId').equals(worldId).toArray()).sort((a, b) => a.createdAt - b.createdAt || a.order - b.order) : []),
    [worldId],
    [] as EditSuggestion[],
  )
}

export interface ImportResult {
  plan: ImportPlan
  /** The draft saved before anything came in. */
  draftId: string
  /** How many changes came in: a move's two halves are one. */
  suggestions: number
  notes: number
}

/** How many changes the suggestions are: a move's two halves are one. */
export function changeCount(rows: readonly EditSuggestion[]): number {
  return rows.filter((r) => r.move?.part !== 'to' || !rows.some((o) => o.move?.id === r.move?.id && o.move?.part === 'from')).length
}

/**
 * Read an edited file and bring its changes and comments in, as suggestions
 * and notes. Refuses a file made from another book: its bookmarks would name
 * this book's scenes by chance.
 */
export async function importEditedFile(worldId: string, bytes: Uint8Array, fileName: string, now = Date.now()): Promise<ImportResult> {
  const doc = await readEditedDocx(bytes)
  if (doc.worldId && doc.worldId !== worldId) throw new Error('This file was made from another book. Open that book to bring its changes in.')
  const record = doc.draftId ? await db.bookDrafts.get(doc.draftId) : undefined
  const draft = record && record.worldId === worldId ? await openBookDraft(record) : null
  const plan = planImport(doc, draft, await currentBook(worldId))

  const authors = [...new Set(plan.scenes.flatMap((s) => s.authors))]
  const saved = await saveBookDraft(worldId, `Before ${authors.length ? authors.join(' and ') + '’s' : 'the editor’s'} changes (${fileName})`, now)

  const importId = generateId()
  const rows: EditSuggestion[] = []
  const row = (s: Omit<EditSuggestion, 'id' | 'worldId' | 'importId' | 'source' | 'createdAt' | 'order'>, order: number): EditSuggestion => ({
    id: generateId(), worldId, importId, source: fileName, createdAt: now, order, ...(doc.draftId ? { fromDraft: doc.draftId } : {}), ...s,
  })
  const moveIds = new Map<string, string>()
  for (const scene of plan.scenes) {
    // Edits made with tracking off first: the tracked changes were made on the text after them.
    const all = [...scene.untracked.map((h) => ({ h, kind: 'untracked' as const })), ...scene.tracked.map((h) => ({ h, kind: 'tracked' as const }))]
    all.forEach(({ h, kind }, i) => rows.push(row({ eventId: scene.eventId, kind, ...h, ...(kind === 'tracked' && scene.authors[0] ? { author: scene.authors[0] } : {}) }, i)))
    scene.moves.forEach((m, i) => {
      if (!moveIds.has(m.id)) moveIds.set(m.id, generateId())
      rows.push(row({ eventId: scene.eventId, kind: 'tracked', ...m.hunk, move: { id: moveIds.get(m.id)!, part: m.part }, ...(scene.authors[0] ? { author: scene.authors[0] } : {}) }, all.length + i))
    })
  }
  plan.outside.forEach((o, i) => {
    if (o.before !== o.after) rows.push(row({ eventId: null, kind: 'tracked', before: o.before, after: o.after, prefix: '', suffix: '', outside: o.where }, i))
  })
  for (const part of plan.unplaced) {
    const passage = { id: generateId(), text: part.text }
    part.tracked.forEach((h, i) => rows.push(row({ eventId: null, passage, kind: 'tracked', ...h }, i)))
  }

  let notes = 0
  await inOneWrite(async () => {
    await db.editSuggestions.bulkAdd(rows)
    for (const scene of plan.scenes) {
      for (const c of scene.comments) {
        const note = await addProseNote({
          worldId, anchor: { eventId: scene.eventId, quote: c.quote, prefix: c.prefix, suffix: c.suffix },
          body: c.text, kind: 'note', author: { kind: 'editor', ...(c.author ? { name: c.author } : {}) },
        })
        for (const r of c.replies) await replyToProseNote(note.id, r.text, { kind: 'editor', ...(r.author ? { name: r.author } : {}) })
        notes++
      }
    }
  })
  return { plan, draftId: saved.id, suggestions: changeCount(rows), notes }
}

/**
 * What came of accepting a change. Where it was not made, it is kept, for the
 * writer to reject or make by hand:
 * - `gone`: its words are no longer there to change — the writer has
 *   rewritten that passage since;
 * - `runs-together`: made, it would end a sentence against the next with no
 *   space between ("time.At"), which neither the scene nor the change has.
 *   That is two changes made on one gap, one of them already: what a tracked
 *   paragraph split did before its mark was read (round-trip-plan.md, T1.1),
 *   and the shape any such pair would leave.
 */
export type AcceptResult = 'accepted' | 'gone' | 'runs-together'

/** A suggestion and, for half of a move, its other half: the rows that are one change. */
async function oneChange(id: string): Promise<EditSuggestion[]> {
  const s = await db.editSuggestions.get(id)
  if (!s) return []
  if (!s.move) return [s]
  const halves = await db.editSuggestions.where('worldId').equals(s.worldId).filter((r) => r.move?.id === s.move!.id).toArray()
  // The words taken out first, then put where they went: the order they were made in.
  return halves.sort((a, b) => (a.move!.part === 'from' ? 0 : 1) - (b.move!.part === 'from' ? 0 : 1))
}

/**
 * Accept a suggestion: written into its scene's prose as it is now. Half of a
 * move is accepted with its other half, or not at all: a sentence taken out
 * and not put back is a cut the editor did not make, and one put in and not
 * taken out is there twice.
 */
export async function acceptSuggestion(id: string): Promise<AcceptResult> {
  return inOneWrite(async () => {
    const rows = await oneChange(id)
    if (rows.length === 0 || rows.some((r) => !r.eventId) || (rows[0].move && rows.length < 2)) return 'gone'
    // Each scene's prose as it is now, then with each row made, in order.
    const before = new Map<string, { text: string; wordCount: number }>()
    const after = new Map<string, string>()
    for (const r of rows) {
      const eventId = r.eventId!
      if (!before.has(eventId)) {
        const current = await db.sceneTexts.where('eventId').equals(eventId).first()
        before.set(eventId, { text: current?.text ?? '', wordCount: current?.wordCount ?? 0 })
      }
      const next = applyHunk(after.get(eventId) ?? before.get(eventId)!.text, r)
      if (next === null) return 'gone'
      after.set(eventId, next)
    }
    const added = rows.reduce((n, r) => n + runTogether(r.after) - runTogether(r.before), 0)
    const made = [...after].reduce((n, [eventId, text]) => n + runTogether(text) - runTogether(before.get(eventId)!.text), 0)
    if (made > added) return 'runs-together'
    await journalGroup(async () => {
      let first = true
      for (const [eventId, text] of after) {
        const was = before.get(eventId)!
        /*
          One step of Undo, which puts back the prose and the change with it
          (round-trip-plan-2.md, T7.4). An Accept had no journal entry, so Undo
          straight after one reached past it and took back an older Find &
          replace in another chapter (writer run 2026-11-10, R2-2).
        */
        await journalUpdate('event', db.events, eventId, { updatedAt: Date.now() }, [], {
          prose: [{ eventId, before: was.text || null, after: text || null }],
          ...(first ? { rows: [{ table: 'editSuggestions', before: rows, after: [] }] } : {}),
        })
        first = false
        /*
          The prose from before the change kept in History, always: History runs
          saves made close together into one version, and the writer's last edit
          before accepting was folded into an older one.
        */
        if (was.text.trim()) await captureSceneRevision(rows[0].worldId, eventId, was.text, was.wordCount, Date.now(), true)
        await setSceneText(rows[0].worldId, eventId, text, { captureRevision: false })
      }
      await db.editSuggestions.bulkDelete(rows.map((r) => r.id))
    }, { label: 'Accepted the editor’s change' })
    return 'accepted'
  })
}

/**
 * Changes dropped as one step of Undo, which brings them back: kept against
 * the scene they are in, with nothing else changed. A change outside every
 * scene has no scene to keep it against, and is dropped as before.
 */
async function dropSuggestions(rows: EditSuggestion[], label: string): Promise<void> {
  const eventId = rows.find((r) => r.eventId)?.eventId
  await journalGroup(async () => {
    if (eventId) await journalUpdate('event', db.events, eventId, { updatedAt: Date.now() }, [], { rows: [{ table: 'editSuggestions', before: rows, after: [] }] })
    await db.editSuggestions.bulkDelete(rows.map((r) => r.id))
  }, { label })
}

/** Reject a suggestion: dropped, and half of a move with its other half. */
export async function rejectSuggestion(id: string): Promise<void> {
  await inOneWrite(async () => {
    await dropSuggestions(await oneChange(id), 'Rejected the editor’s change')
  })
}

/** Every suggestion for a scene accepted, in the file's order; those that could not be made are kept, each with why. */
export async function acceptScene(worldId: string, eventId: string): Promise<{ accepted: number; kept: number; refused: Map<string, Exclude<AcceptResult, 'accepted'>> }> {
  const rows = (await db.editSuggestions.where('eventId').equals(eventId).toArray()).filter((s) => s.worldId === worldId).sort((a, b) => a.createdAt - b.createdAt || a.order - b.order)
  let accepted = 0
  const refused = new Map<string, Exclude<AcceptResult, 'accepted'>>()
  // One step of Undo for the whole scene's, as for one.
  await journalGroup(async () => {
    for (const s of rows) {
      // The other half of a move already made with its first.
      if (!(await db.editSuggestions.get(s.id))) continue
      const r = await acceptSuggestion(s.id)
      if (r === 'accepted') accepted++
      else refused.set(s.id, r)
    }
  }, { label: 'Accepted the editor’s changes' })
  return { accepted, kept: refused.size, refused }
}

export async function rejectScene(worldId: string, eventId: string): Promise<void> {
  await inOneWrite(async () => {
    const rows = (await db.editSuggestions.where('eventId').equals(eventId).toArray()).filter((s) => s.worldId === worldId)
    // A move's other half goes with it, in whatever scene it is.
    const moves = new Set(rows.flatMap((r) => (r.move ? [r.move.id] : [])))
    const partners = moves.size ? await db.editSuggestions.where('worldId').equals(worldId).filter((r) => !!r.move && moves.has(r.move.id)).toArray() : []
    const all = [...new Map([...rows, ...partners].map((s) => [s.id, s])).values()]
    await dropSuggestions(all, 'Rejected the editor’s changes')
  })
}

/** A passage no scene matched, placed by the writer: its suggestions are that scene's. */
export async function placePassage(worldId: string, passageId: string, eventId: string): Promise<void> {
  await db.editSuggestions.where('worldId').equals(worldId).filter((s) => s.passage?.id === passageId).modify({ eventId })
}
