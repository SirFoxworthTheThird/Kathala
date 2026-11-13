import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { generateId } from '@/lib/id'
import { readEditedDocx } from '@/lib/docxRead'
import { planImport, tryChange, type ImportPlan } from '@/lib/docxImport'
import { titlePageCount, withChangesMade, type Hunk } from '@/lib/docxEdits'
import { commentTime, isRewrittenLine, withoutRewrittenLine } from '@/lib/markedDocx'
import { currentBook, openBookDraft, saveBookDraft } from '@/db/hooks/useBookDrafts'
import { inOneWrite } from '@/db/hooks/useSceneStructure'
import { captureSceneRevision, setSceneText } from '@/db/hooks/useManuscript'
import { journalGroup, journalUpdate } from '@/db/hooks/useOperations'
import { addProseNote, replyToProseNote, setProseNoteResolved } from '@/db/hooks/useProseNotes'
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
  /** Comments made notes: those on the prose, and those on the title page or a heading, which are `outsideNotes` of them. */
  notes: number
  outsideNotes: number
  /**
   * What the file said in threads already here (round-trip-plan-3.md, T9.5):
   * replies added to them, and threads it resolved. Each reply, and each
   * thread resolved, says it came with `importId`.
   */
  replies: number
  resolved: number
  importId: string
}

/** How many changes the suggestions are: a move's two halves are one. */
export function changeCount(rows: readonly EditSuggestion[]): number {
  // A comment on a line outside the scenes is listed with them, and is no change.
  return rows.filter((r) => !r.comment && (r.move?.part !== 'to' || !rows.some((o) => o.move?.id === r.move?.id && o.move?.part === 'from'))).length
}

/**
 * Read an edited file and bring its changes and comments in, as suggestions
 * and notes. Refuses a file made from another book: its bookmarks would name
 * this book's scenes by chance.
 */
export async function importEditedFile(worldId: string, bytes: Uint8Array, fileName: string, now = Date.now()): Promise<ImportResult> {
  const read = await readEditedDocx(bytes)
  if (read.worldId && read.worldId !== worldId) throw new Error('This file was made from another book. Open that book to bring its changes in.')
  // The clean copy is to read: it has nothing to place changes by. The marked file it went with does (T10.3).
  if (read.cleanOf) throw new Error(`This is the clean copy, made to read alongside ${read.cleanOf}, and changes cannot be brought in from it. Bring in ${read.cleanOf}, the marked file, with the editor’s changes in it.`)
  /*
    A file the writer sent back marked, come back with the editor's changes
    beside the writer's: the writer's made first, so the file reads as it was
    sent, less any the editor turned back, and the editor's are found against
    that (round-trip-plan-2.md, T5.3).
  */
  const doc = read.markedBy ? withChangesMade(read, read.markedBy) : read
  const record = doc.draftId ? await db.bookDrafts.get(doc.draftId) : undefined
  const draft = record && record.worldId === worldId ? await openBookDraft(record) : null
  const plan = planImport(doc, draft, await currentBook(worldId))

  const authors = [...new Set(plan.scenes.flatMap((s) => s.authors))]
  const saved = await saveBookDraft(worldId, `Before ${authors.length ? authors.join(' and ') + '’s' : 'the editor’s'} changes (${fileName})`, now)
  /*
    And the book as the editor sent it back, every change taken: the scenes the
    file had, as it has them. The revision goes back to the editor marked
    against this (round-trip-plan-2.md, T5.1, D-4).
  */
  const book = await currentBook(worldId)
  // Who worked in the file: its changes' authors and its comments'.
  const editors = [...new Set([...authors, ...plan.scenes.flatMap((s) => s.comments.map((c) => c.author ?? ''))])].filter(Boolean)
  const sentBackText = new Map(plan.scenes.map((s) => [s.eventId, s.edited]))
  await saveBookDraft(worldId, `As ${authors.length ? authors.join(' and ') : 'the editor'} sent it back (${fileName})`, now, {
    sentBack: fileName,
    // Whose comments, too: theirs go back with the marked book.
    editors,
    // And what its title page says of the length, as the file now reads, the writer's own change to it made.
    ...(titlePageCount(doc) ? { titleCount: titlePageCount(doc)! } : {}),
    /*
      The draft the file was made from, and the editor's changes in it as they
      are counted here: what the revision going back says of them, which it
      turned back and what became of each (round-trip-plan-3.md, T10.1, T10.2).
    */
    ...(draft ? { wentAs: record!.id } : {}),
    editorChanges: plan.scenes.flatMap((s) => [
      ...[...s.untracked, ...s.tracked].map((h) => ({ eventId: s.eventId, before: h.before, after: h.after, prefix: h.prefix, suffix: h.suffix })),
      ...s.moves.map((m) => ({ eventId: s.eventId, before: m.hunk.before, after: m.hunk.after, prefix: m.hunk.prefix, suffix: m.hunk.suffix, move: m.id })),
    ]),
    book: { ...book, chapters: book.chapters.map((c) => ({ ...c, scenes: c.scenes.filter((s) => sentBackText.has(s.id)).map((s) => ({ ...s, text: sentBackText.get(s.id)! })) })).filter((c) => c.scenes.length > 0) },
  })

  /*
    An edit with tracking off, in a marked file, that puts back the editor's own
    earlier words — those the writer's marks were measured against — is the
    editor turning one of the writer's changes back: its new words, with a little either side,
    are in that text.
  */
  const against = read.markedAgainst ? await db.bookDrafts.get(read.markedAgainst) : undefined
  const againstText = new Map((against && against.worldId === worldId ? (await openBookDraft(against)).chapters.flatMap((c) => c.scenes) : []).map((s) => [s.id, s.text.replace(/\s+/g, ' ')]))
  const turnedBack = (h: Hunk, eventId: string) => {
    const text = againstText.get(eventId)
    if (text === undefined) return false
    return text.includes(`${h.prefix.slice(-16)}${h.after}${h.suffix.slice(0, 16)}`.replace(/\s+/g, ' '))
  }

  const importId = generateId()
  const rows: EditSuggestion[] = []
  const row = (s: Omit<EditSuggestion, 'id' | 'worldId' | 'importId' | 'source' | 'createdAt' | 'order'>, order: number): EditSuggestion => ({
    id: generateId(), worldId, importId, source: fileName, createdAt: now, order, ...(doc.draftId ? { fromDraft: doc.draftId } : {}), ...s,
  })
  const moveIds = new Map<string, string>()
  for (const scene of plan.scenes) {
    // Edits made with tracking off first: the tracked changes were made on the text after them.
    const all = [...scene.untracked.map((h) => ({ h, kind: 'untracked' as const })), ...scene.tracked.map((h) => ({ h, kind: 'tracked' as const }))]
    all.forEach(({ h, kind }, i) => rows.push(row({
      eventId: scene.eventId, kind, ...h,
      ...(kind === 'tracked' && scene.authors[0] ? { author: scene.authors[0] } : {}),
      ...(kind === 'untracked' && turnedBack(h, scene.eventId) ? { turnedBack: true as const, ...(scene.authors[0] ?? editors[0] ? { author: scene.authors[0] ?? editors[0] } : {}) } : {}),
    }, i)))
    scene.moves.forEach((m, i) => {
      if (!moveIds.has(m.id)) moveIds.set(m.id, generateId())
      rows.push(row({ eventId: scene.eventId, kind: 'tracked', ...m.hunk, move: { id: moveIds.get(m.id)!, part: m.part }, ...(scene.authors[0] ? { author: scene.authors[0] } : {}) }, all.length + i))
    })
  }
  plan.outside.forEach((o, i) => {
    if (o.before !== o.after) rows.push(row({ eventId: null, kind: 'tracked', before: o.before, after: o.after, prefix: '', suffix: '', outside: o.where }, i))
    /*
      A comment there is a note on that line, with the editor's others (below).
      Only where no scene of the book follows the line — a heading whose
      chapter the writer has since emptied — is there nothing to hang a note on,
      and it is listed with the changes there, to read and dismiss, as every
      such comment was before (round-trip-plan-3.md, T9.4).
    */
    if (o.eventId) return
    for (const c of o.threads) rows.push(row({ eventId: null, kind: 'tracked', before: o.after, after: o.after, prefix: '', suffix: '', outside: o.where, comment: { ...(c.author ? { author: c.author } : {}), text: c.text } }, i))
  })
  for (const part of plan.unplaced) {
    const passage = { id: generateId(), text: part.text }
    part.tracked.forEach((h, i) => rows.push(row({ eventId: null, passage, kind: 'tracked', ...h }, i)))
  }

  let notes = 0
  let outsideNotes = 0
  let replied = 0
  let resolved = 0
  // The threads that went out with a marked file, by the editor's words: one coming back is added to, not made again.
  const earlier = read.markedBy ? (await db.proseNotes.where('worldId').equals(worldId).toArray()).filter((n) => n.author.kind === 'editor') : []
  // Every comment to bring in, and what it is on: a scene's words, or a line outside the scenes.
  const comments: Array<{ c: ImportPlan['scenes'][number]['comments'][number]; eventId: string; outside?: 'title page' | 'heading' }> = [
    ...plan.scenes.flatMap((scene) => scene.comments.map((c) => ({ c, eventId: scene.eventId }))),
    ...plan.outside.flatMap((o) => (o.eventId ? o.threads.map((c) => ({ c, eventId: o.eventId!, outside: o.where })) : [])),
  ]
  await inOneWrite(async () => {
    await db.editSuggestions.bulkAdd(rows)
    for (const { c, eventId, outside } of comments) {
      const words = withoutRewrittenLine(c.text)
      const went = earlier.find((n) => n.body.trim() === words && (!c.author || n.author.name === c.author))
      // The line the marked file says of words since rewritten is the app's, signed by the writer: never a reply of theirs (T9.2).
      const replies = c.replies.filter((r) => !(isRewrittenLine(r.text) && (!read.markedBy || r.author === read.markedBy)))
      // Each by whoever wrote it, and when the file says it was written (T9.3).
      const by = (r: { author: string }) => (read.markedBy && r.author === read.markedBy ? { kind: 'me' as const } : { kind: 'editor' as const, ...(r.author ? { name: r.author } : {}) })
      if (went) {
        // Replies not there yet; resolved there, resolved here.
        for (const r of replies) {
          if (went.replies.some((x) => x.body.trim() === r.text.trim())) continue
          await replyToProseNote(went.id, r.text, by(r), commentTime(r.date), importId)
          replied++
        }
        if (c.done && went.status !== 'resolved') {
          await setProseNoteResolved(went.id, true, importId)
          resolved++
        }
        continue
      }
      const note = await addProseNote({
        worldId, anchor: { eventId, quote: c.quote, prefix: c.prefix, suffix: c.suffix },
        body: words, kind: 'note', author: { kind: 'editor', ...(c.author ? { name: c.author } : {}) },
        ...(commentTime(c.date) !== undefined ? { at: commentTime(c.date) } : {}),
        ...(outside ? { outside } : {}),
      })
      for (const r of replies) await replyToProseNote(note.id, r.text, by(r), commentTime(r.date), importId)
      notes++
      if (outside) outsideNotes++
    }
  })
  return { plan, draftId: saved.id, suggestions: changeCount(rows), notes, outsideNotes, replies: replied, resolved, importId }
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
 * And `cleared`: it was already in the scene, made by hand, and is taken off
 * the list (round-trip-plan-3.md, T11.1). It waited there for ever before,
 * refused each time, and only Reject cleared it.
 */
export type AcceptResult = 'accepted' | 'cleared' | 'gone' | 'runs-together'

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
    for (const eventId of new Set(rows.map((r) => r.eventId!))) {
      const current = await db.sceneTexts.where('eventId').equals(eventId).first()
      before.set(eventId, { text: current?.text ?? '', wordCount: current?.wordCount ?? 0 })
    }
    const tried = tryChange(rows, (eventId) => before.get(eventId)!.text)
    // Already made by hand: nothing to write, and off the list, as one step of Undo.
    if (tried.result === 'made') {
      await dropSuggestions(rows, 'Cleared a change already made')
      return 'cleared'
    }
    if (tried.result !== 'ok') return tried.result
    const { after } = tried
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
export async function acceptScene(worldId: string, eventId: string): Promise<{ accepted: number; kept: number; refused: Map<string, Exclude<AcceptResult, 'accepted' | 'cleared'>> }> {
  const rows = (await db.editSuggestions.where('eventId').equals(eventId).toArray()).filter((s) => s.worldId === worldId).sort((a, b) => a.createdAt - b.createdAt || a.order - b.order)
  let accepted = 0
  const refused = new Map<string, Exclude<AcceptResult, 'accepted' | 'cleared'>>()
  // One step of Undo for the whole scene's, as for one.
  await journalGroup(async () => {
    for (const s of rows) {
      // The other half of a move already made with its first.
      if (!(await db.editSuggestions.get(s.id))) continue
      const r = await acceptSuggestion(s.id)
      if (r === 'accepted' || r === 'cleared') accepted++
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
