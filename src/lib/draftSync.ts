import { oneLine, type DraftChapter, type DraftSegment, type HeadingKind } from '@/lib/draftDocument'

/*
  The Page view holds the whole book in one editor while the store goes on
  changing underneath it: its own saves, a title renamed on a card in another
  tab, an Undo in the top bar that puts back a split scene's prose. Three
  values per heading decide what happens:

  - **stored**: what the records say now;
  - **base**: what the page last knew the records to say — the value it loaded,
    took from the store, or wrote itself;
  - **shown**: what the editor holds now.

  shown ≠ base means the writer has changed it here, and it is theirs to save.
  stored ≠ base means something else changed it. When only the second is true
  the page takes the store's value; when both are, the writer's stays and is
  saved over it, because it is the newer of the two — a keystroke on this
  screen is later than whatever wrote the record the page was showing.

  A write the page has started and not yet seen land is neither: until it
  lands the store still holds the old value, and reading that as someone
  else's edit would put the old text back over what was just typed.
*/

export interface Held { kind: HeadingKind; title: string; text: string }

/** A title as it is kept: one line, no space at either end. */
export const cleanTitle = (title: string) => oneLine(title).trim()

export const sameTitle = (a: string, b: string) => cleanTitle(a) === cleanTitle(b)

/** Prose that is only whitespace is no prose: storing it deletes the record, which reads back as ''. */
export const sameText = (a: string, b: string) => a === b || (a.trim() === '' && b.trim() === '')

const same = (a: Held, b: Held) => sameTitle(a.title, b.title) && sameText(a.text, b.text)

/** What the records hold, keyed by id, in the order the book reads. */
export function storedValues(book: DraftChapter[]): Map<string, Held> {
  const out = new Map<string, Held>()
  for (const c of book) {
    out.set(c.id, { kind: 'chapter', title: c.title, text: '' })
    for (const s of c.scenes) out.set(s.id, { kind: 'scene', title: s.title, text: s.text })
  }
  return out
}

export function shownValues(segments: DraftSegment[]): Map<string, Held> {
  return new Map(segments.map((s) => [s.id, { kind: s.kind, title: s.title, text: withoutOpenHeadings(s.text) }]))
}

/**
 * A scene's prose without a heading line still being typed — `##` or `#` with
 * no title yet, which a scene key puts on the page for the writer to title.
 *
 * Until it has a title it is neither prose nor a scene, and saving it as prose
 * stored `## ` in the scene for as long as the writer took to type the title: a
 * writer run saw the word count go up by one, and a browser closed in that
 * second left the marks in the book. The line becomes a scene when it is left
 * with a title, and goes when it is left without one.
 */
export function withoutOpenHeadings(text: string): string {
  if (!/^#{1,2}[ \t]*$/m.test(text)) return text
  return text.replace(/\n*^#{1,2}[ \t]*$\n*/gm, '\n\n').replace(/^\n+|\n+$/g, '')
}

export interface SyncPlan {
  /** The chapters or scenes, or their order, are not the ones the editor holds. */
  restructure: boolean
  /** Headings whose stored value the editor should show, because only the store changed. */
  take: string[]
  /** What the page knows the records to say after this. */
  base: Map<string, Held>
}

/** Whether the two hold the same chapters and scenes, in the same order. */
export function sameShape(stored: Map<string, Held>, shown: Map<string, Held>): boolean {
  const storedIds = [...stored.keys()]
  const shownIds = [...shown.keys()]
  return storedIds.length === shownIds.length
    && storedIds.every((id, i) => id === shownIds[i] && stored.get(id)!.kind === shown.get(id)!.kind)
}

export function planSync(
  stored: Map<string, Held>,
  base: Map<string, Held>,
  shown: Map<string, Held>,
  inFlight: ReadonlySet<string>,
): SyncPlan {
  const restructure = !sameShape(stored, shown)
  const take: string[] = []
  const next = new Map(base)
  for (const [id, now] of stored) {
    const was = base.get(id)
    if (!was) { next.set(id, now); if (!shown.has(id)) take.push(id); continue }
    if (same(now, was) || inFlight.has(id)) continue
    next.set(id, now)
    const here = shown.get(id)
    if (!here || same(here, was)) take.push(id)
  }
  for (const id of base.keys()) if (!stored.has(id)) next.delete(id)
  return { restructure, take, base: next }
}

/**
 * The book to show: the store's, except where the writer has changed a heading
 * here and the change is not saved yet — that stays as they left it.
 */
export function bookToShow(book: DraftChapter[], base: Map<string, Held>, shown: Map<string, Held>, take: ReadonlySet<string>): DraftChapter[] {
  const pick = (id: string, stored: { title: string; text: string }) => {
    const here = shown.get(id)
    const was = base.get(id)
    if (!here || take.has(id) || (was && same(here, was))) return stored
    return { title: here.title, text: here.text }
  }
  return book.map((c) => ({
    id: c.id,
    title: pick(c.id, { title: c.title, text: '' }).title,
    // The header line is the records' whatever the page holds: it is never the writer's to keep.
    scenes: c.scenes.map((s) => ({ id: s.id, ...(s.header ? { header: s.header } : {}), ...pick(s.id, { title: s.title, text: s.text }) })),
  }))
}

export interface Write { id: string; kind: HeadingKind; title?: string; text?: string }

/**
 * What to write: every heading whose shown value differs from the base. A scene
 * title cleared to nothing is not written — a scene needs a name, as it does
 * on its card — and the name it had stays in the records.
 */
export function pendingWrites(base: Map<string, Held>, shown: Map<string, Held>): Write[] {
  const out: Write[] = []
  for (const [id, here] of shown) {
    const was = base.get(id)
    if (!was) continue
    const write: Write = { id, kind: here.kind }
    const title = cleanTitle(here.title)
    if (!sameTitle(here.title, was.title) && (here.kind === 'chapter' || title !== '')) write.title = title
    if (here.kind === 'scene' && !sameText(here.text, was.text)) write.text = here.text
    if (write.title !== undefined || write.text !== undefined) out.push(write)
  }
  return out
}

/** The base after a write has landed: what was written is what the records now say. */
export function afterWrite(base: Map<string, Held>, write: Write): Map<string, Held> {
  const was = base.get(write.id)
  if (!was) return base
  const next = new Map(base)
  next.set(write.id, { ...was, title: write.title ?? was.title, text: write.text ?? was.text })
  return next
}
