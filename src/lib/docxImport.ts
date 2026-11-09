import { docScenes, hunks, locatedHunks, type DocScene, type Hunk, type LocatedHunk } from '@/lib/docxEdits'
import { CONTEXT_CHARS } from '@/lib/noteAnchor'
import type { EditedDocx } from '@/lib/docxRead'
import type { DraftBook } from '@/lib/bookDraft'
import { paragraphBlocks } from '@/lib/manuscriptParagraphs'
import { anchorFrom, placeNote } from '@/lib/noteAnchor'

/*
  An editor's Word file, planned against the book (editorial-plan.md, R4):
  which scene each part of it is, what changed in each, and the comments.

  - **Which scene.** By its bookmark, through the draft saved when the file was
    made (the bookmark's number is the scene's place in that draft). Where the
    bookmark was lost, or the draft is not on this device, by its paragraphs:
    the scene in the book now that has at least half of them. A part that is
    neither is *unplaced*, and given to the writer to place.
  - **What changed.** Tracked changes are the file read with every change
    rejected, against it read with every change accepted. Edits made with
    tracking off are the scene as it went out (the draft) against the file
    with every change rejected — they would otherwise come in unseen. Without
    the draft they cannot be told from the scene's own prose, and none are
    found.
  - **The comments**, each anchored on the words it was made on, as a note is.

  Nothing here writes: `useEditImport` does, and a suggestion is applied to
  the scene's prose as it is when the writer accepts it (`applyHunk`).
*/

export interface PlannedComment {
  quote: string
  prefix: string
  suffix: string
  author: string
  text: string
  replies: Array<{ author: string; text: string }>
}

export interface PlannedScene {
  eventId: string
  /** Changes made with tracking on, and with it off. */
  tracked: Hunk[]
  untracked: Hunk[]
  comments: PlannedComment[]
  /** Who made the tracked changes. */
  authors: string[]
}

export interface ImportPlan {
  scenes: PlannedScene[]
  /** Parts of the file that are no scene in the book, as they read in it, and how many comments each has: those are not brought in. */
  unplaced: Array<{ text: string; tracked: Hunk[]; comments: number }>
  /** Whether the draft the file was made from was found, so edits made with tracking off could be. */
  fromDraft: boolean
}

/** A scene's prose as the export rendered it: paragraphs, as the file holds them. */
export function rendered(text: string): string {
  return paragraphBlocks(text).map((p) => p.text).join('\n\n')
}

const paragraphs = (text: string) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

/** The scene in `book` with at least half of `text`'s paragraphs, the most first; null for none. */
function matchByText(text: string, book: DraftBook): string | null {
  const ps = paragraphs(text)
  if (ps.length === 0) return null
  let best: { id: string; share: number } | null = null
  for (const s of book.chapters.flatMap((c) => c.scenes)) {
    const have = new Set(paragraphs(rendered(s.text)))
    const share = ps.filter((p) => have.has(p)).length / ps.length
    if (share >= 0.5 && (!best || share > best.share)) best = { id: s.id, share }
  }
  return best?.id ?? null
}

export function planImport(doc: EditedDocx, draft: DraftBook | null, book: DraftBook): ImportPlan {
  const draftScenes = draft?.chapters.flatMap((c) => c.scenes) ?? []
  const inBook = new Set(book.chapters.flatMap((c) => c.scenes.map((s) => s.id)))
  const byScene = new Map<string, PlannedScene>()
  const unplaced: ImportPlan['unplaced'] = []

  for (const part of docScenes(doc)) {
    const fromDraft = part.index !== null ? draftScenes[part.index] : undefined
    const eventId = fromDraft && inBook.has(fromDraft.id) ? fromDraft.id : matchByText(part.original, book)
    let tracked = hunks(part.original, part.edited)
    if (!eventId) {
      unplaced.push({ text: part.edited, tracked, comments: commentsOf(part, doc).length })
      continue
    }
    // Untracked edits are found only against the scene as it went out, from its own bookmark.
    const { untracked, tracked: trackedHere } = fromDraft && fromDraft.id === eventId
      ? oneChangePerGap(part.original, locatedHunks(rendered(fromDraft.text), part.original), locatedHunks(part.original, part.edited))
      : { untracked: [], tracked }
    tracked = trackedHere
    const planned = byScene.get(eventId) ?? { eventId, tracked: [], untracked: [], comments: [], authors: [] }
    planned.tracked.push(...tracked)
    planned.untracked.push(...untracked)
    planned.comments.push(...commentsOf(part, doc))
    planned.authors = [...new Set([...planned.authors, ...part.authors])]
    byScene.set(eventId, planned)
  }
  return { scenes: [...byScene.values()], unplaced, fromDraft: draft !== null }
}

/**
 * A scene's untracked edits and tracked changes, with any that touch made one.
 *
 * The two are found on two comparisons — the scene as it went out against the
 * file with every change rejected, and that against it with every change
 * accepted — which meet in the middle text, `original`. Where an untracked
 * edit's new words and a tracked change's old ones overlap or touch there,
 * they are two changes on one gap: the tracked one is anchored on words the
 * untracked one makes, so taking it first finds them wrong, or not at all, and
 * taking them out of order is how a tracked paragraph split, before its mark
 * was read, ran two sentences together ("time.At"). So such a group is one
 * change, from the scene as it went out to the file as it reads, and listed as
 * tracked: the editor tracked some of it. Changes that touch nothing are left
 * as they were.
 */
function oneChangePerGap(original: string, untracked: LocatedHunk[], tracked: LocatedHunk[]): { untracked: Hunk[]; tracked: Hunk[] } {
  // Each change as a stretch of `original`: an untracked edit by the words it put there, a tracked change by those it replaces.
  type Item = { kind: 'untracked' | 'tracked'; at: [number, number]; l: LocatedHunk }
  const items: Item[] = [
    ...untracked.map((l) => ({ kind: 'untracked' as const, at: [l.toFrom, l.toTo] as [number, number], l })),
    ...tracked.map((l) => ({ kind: 'tracked' as const, at: [l.from, l.to] as [number, number], l })),
  ].sort((x, y) => x.at[0] - y.at[0] || x.at[1] - y.at[1])
  const groups: Item[][] = []
  for (const it of items) {
    const last = groups[groups.length - 1]
    const end = last ? Math.max(...last.map((g) => g.at[1])) : -1
    if (last && it.at[0] <= end) last.push(it)
    else groups.push([it])
  }
  const out = { untracked: [] as Hunk[], tracked: [] as Hunk[] }
  for (const g of groups) {
    const kinds = new Set(g.map((x) => x.kind))
    if (kinds.size === 1) { for (const x of g) out[x.kind].push(x.l.hunk); continue }
    const from = Math.min(...g.map((x) => x.at[0]))
    const to = Math.max(...g.map((x) => x.at[1]))
    // The stretch as it went out (each untracked edit's new words put back as they were) and as it reads (each tracked change made).
    const remake = (kind: Item['kind'], words: (l: LocatedHunk) => string) => {
      let text = original.slice(from, to)
      for (const x of [...g].filter((y) => y.kind === kind).sort((a, b) => b.at[0] - a.at[0])) {
        text = text.slice(0, x.at[0] - from) + words(x.l) + text.slice(x.at[1] - from)
      }
      return text
    }
    out.tracked.push({
      before: remake('untracked', (l) => l.hunk.before),
      after: remake('tracked', (l) => l.hunk.after),
      prefix: original.slice(Math.max(0, from - CONTEXT_CHARS), from),
      suffix: original.slice(to, to + CONTEXT_CHARS),
    })
  }
  return out
}

/** A part's comments, each anchored on its words, with any replies to it. */
function commentsOf(part: DocScene, doc: EditedDocx): PlannedComment[] {
  const out: PlannedComment[] = []
  for (const range of part.comments) {
    const comment = doc.comments.find((c) => c.id === range.id)
    if (!comment || comment.parentId) continue
    // A comment on a point, not a stretch, is on the word it stands before.
    const { start } = range
    let { end } = range
    if (end <= start) end = Math.min(part.edited.length, start + (part.edited.slice(start).match(/^\s*\S+/)?.[0].length ?? 0))
    const anchor = anchorFrom('', part.edited, start, end)
    if (!anchor) continue
    out.push({
      quote: anchor.quote, prefix: anchor.prefix, suffix: anchor.suffix,
      author: comment.author, text: comment.text,
      replies: doc.comments.filter((r) => r.parentId === comment.id).map((r) => ({ author: r.author, text: r.text })),
    })
  }
  return out
}

/**
 * A change applied to a scene's prose as it is now: its words found — exactly,
 * or edited a little since, as a note finds its words — and replaced. Null
 * where they are not there any more: the writer has changed that passage
 * since the file went out, and the change is theirs to make by hand.
 */
export function applyHunk(prose: string, hunk: Hunk): string | null {
  const place = placeNote({ eventId: 's', quote: hunk.before, prefix: hunk.prefix, suffix: hunk.suffix }, [{ eventId: 's', text: prose }])
  if (!place) return null
  const next = prose.slice(0, place.from) + hunk.after + prose.slice(place.to)
  // A paragraph taken out leaves its blank lines: one blank line between paragraphs, none at the ends.
  return next.replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '')
}

/**
 * How many places in a text a sentence ends against the next with no space
 * between: `time.At`, `“Go.”She`. A change that would add one the change
 * itself does not have is refused (`acceptSuggestion`).
 */
export function runTogether(text: string): number {
  return (text.match(/[\p{Ll}\p{N}][.!?…]+["”’)\]]*\p{Lu}/gu) ?? []).length
}
