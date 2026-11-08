import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { generateId } from '@/lib/id'
import { readEditedDocx } from '@/lib/docxRead'
import { applyHunk, planImport, type ImportPlan } from '@/lib/docxImport'
import { currentBook, openBookDraft, saveBookDraft } from '@/db/hooks/useBookDrafts'
import { inOneWrite } from '@/db/hooks/useSceneStructure'
import { captureSceneRevision, setSceneText } from '@/db/hooks/useManuscript'
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
  suggestions: number
  notes: number
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
    id: generateId(), worldId, importId, source: fileName, createdAt: now, order, ...s,
  })
  for (const scene of plan.scenes) {
    // Edits made with tracking off first: the tracked changes were made on the text after them.
    const all = [...scene.untracked.map((h) => ({ h, kind: 'untracked' as const })), ...scene.tracked.map((h) => ({ h, kind: 'tracked' as const }))]
    all.forEach(({ h, kind }, i) => rows.push(row({ eventId: scene.eventId, kind, ...h, ...(kind === 'tracked' && scene.authors[0] ? { author: scene.authors[0] } : {}) }, i)))
  }
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
  return { plan, draftId: saved.id, suggestions: rows.length, notes }
}

/**
 * Accept a suggestion: written into its scene's prose as it is now. `false`
 * where its words are no longer there to change — the writer has rewritten
 * that passage since — and the suggestion is kept, for them to reject or make
 * by hand.
 */
export async function acceptSuggestion(id: string): Promise<boolean> {
  return inOneWrite(async () => {
    const s = await db.editSuggestions.get(id)
    if (!s?.eventId) return false
    const current = await db.sceneTexts.where('eventId').equals(s.eventId).first()
    const next = applyHunk(current?.text ?? '', s)
    if (next === null) return false
    /*
      The prose from before the change kept in History, always: History runs
      saves made close together into one version, and the writer's last edit
      before accepting was folded into an older one.
    */
    if (current?.text.trim()) await captureSceneRevision(s.worldId, s.eventId, current.text, current.wordCount, Date.now(), true)
    await setSceneText(s.worldId, s.eventId, next, { captureRevision: false })
    await db.editSuggestions.delete(id)
    return true
  })
}

export async function rejectSuggestion(id: string): Promise<void> {
  await db.editSuggestions.delete(id)
}

/** Every suggestion for a scene accepted, in the file's order; those that no longer apply are kept, and counted. */
export async function acceptScene(worldId: string, eventId: string): Promise<{ accepted: number; kept: number }> {
  const rows = (await db.editSuggestions.where('eventId').equals(eventId).toArray()).filter((s) => s.worldId === worldId).sort((a, b) => a.createdAt - b.createdAt || a.order - b.order)
  let accepted = 0
  for (const s of rows) if (await acceptSuggestion(s.id)) accepted++
  return { accepted, kept: rows.length - accepted }
}

export async function rejectScene(worldId: string, eventId: string): Promise<void> {
  const ids = (await db.editSuggestions.where('eventId').equals(eventId).toArray()).filter((s) => s.worldId === worldId).map((s) => s.id)
  await db.editSuggestions.bulkDelete(ids)
}

/** A passage no scene matched, placed by the writer: its suggestions are that scene's. */
export async function placePassage(worldId: string, passageId: string, eventId: string): Promise<void> {
  await db.editSuggestions.where('worldId').equals(worldId).filter((s) => s.passage?.id === passageId).modify({ eventId })
}
