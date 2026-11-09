import { docScenes, hunkAt, hunks, locatedHunks, mergedHunk, moveWords, outsideScenes, shownChange, type DocScene, type Hunk, type LocatedHunk } from '@/lib/docxEdits'
import { CONTEXT_CHARS } from '@/lib/noteAnchor'
import type { EditedDocx } from '@/lib/docxRead'
import type { DraftBook } from '@/lib/bookDraft'
import { paragraphBlocks } from '@/lib/manuscriptParagraphs'
import { anchorFrom, placeNote } from '@/lib/noteAnchor'
import { emphasisSpans } from '@/lib/proseEmphasis'

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
  /**
   * Halves of moves in this scene: the words taken from where they were
   * (`from`), and put where they went (`to`). The two halves of one move share
   * an id, and may be in two scenes; each is made only with the other.
   */
  moves: Array<{ id: string; part: 'from' | 'to'; hunk: Hunk }>
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
  /** Changes and comments outside every scene — the title page, a chapter's heading — for the writer to make by hand (`outsideScenes`). */
  outside: ReturnType<typeof outsideScenes>
}

/**
 * Which mark a scene's prose writes its italics with: asterisks where it has
 * more spans in them than in underscores (round-trip-plan.md, T2.1).
 */
export function italicMark(text: string): '_' | '*' {
  const count = (d: '_' | '*') => emphasisSpans(text, [d]).filter((x) => x.em).length
  return count('*') > count('_') ? '*' : '_'
}

/** A text's underscored italics in asterisks: the same length, so every place in it stays where it was. */
function asterisked(text: string): string {
  return emphasisSpans(text, ['_']).map((x) => (x.em ? `*${x.text}*` : x.text)).join('')
}

/**
 * A part of the file, its italics in asterisks. The file reads italics as
 * `_so_`, the book's markup; a writer who types `*so*` would otherwise find
 * every italic in the scene come back as an edit from the editor.
 */
function withAsterisks(part: DocScene): DocScene {
  return {
    ...part,
    original: asterisked(part.original),
    edited: asterisked(part.edited),
    ...(part.moves ? { moves: { ...part.moves, out: asterisked(part.moves.out), moved: asterisked(part.moves.moved) } } : {}),
  }
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

  // Each half of a move, to be paired with the other once every scene is read.
  const halves: Array<{ eventId: string; part: 'from' | 'to'; hunk: Hunk; words: string }> = []
  for (let part of docScenes(doc)) {
    const fromDraft = part.index !== null ? draftScenes[part.index] : undefined
    const eventId = fromDraft && inBook.has(fromDraft.id) ? fromDraft.id : matchByText(part.original, book)
    if (!eventId) {
      unplaced.push({ text: part.edited, tracked: hunks(part.original, part.edited), comments: commentsOf(part, doc).length })
      continue
    }
    const sameScene = !!fromDraft && fromDraft.id === eventId
    // The file's italics written as this scene writes them: `*so*` where the writer does, not `_so_`.
    if (italicMark(fromDraft?.text ?? book.chapters.flatMap((c) => c.scenes).find((x) => x.id === eventId)?.text ?? '') === '*') part = withAsterisks(part)
    let tracked: Hunk[]
    let untracked: Hunk[]
    if (part.moves) {
      /*
        The file read in steps: the moved words taken out, then put where they
        went, then every other change. A move is its two steps, as the editor
        made it, not as a comparison of the whole would describe it: one
        paragraph moved above another reads, compared, as the other moved
        below it, and its half "removed" is the other paragraph struck out.
      */
      for (const l of locatedHunks(part.original, part.moves.out)) halves.push({ eventId, part: 'from', ...onMovedWords(part.original, part.moves.out, l, part.moves.words.from) })
      for (const l of locatedHunks(part.moves.out, part.moves.moved)) halves.push({ eventId, part: 'to', ...onMovedWords(part.moves.out, part.moves.moved, l, part.moves.words.to) })
      tracked = alongRuns(part.moves.moved, part.edited, locatedHunks(part.moves.moved, part.edited), part.runs).map((l) => l.hunk)
      // Untracked edits are found only against the scene as it went out, from its own bookmark.
      untracked = sameScene ? wordsApart(rendered(fromDraft.text), part.original, locatedHunks(rendered(fromDraft.text), part.original)).map((l) => l.hunk) : []
    } else {
      const trackedHere = alongRuns(part.original, part.edited, locatedHunks(part.original, part.edited), part.runs)
      ;({ untracked, tracked } = sameScene
        ? oneChangePerGap(part.original, wordsApart(rendered(fromDraft.text), part.original, locatedHunks(rendered(fromDraft.text), part.original)), trackedHere)
        : { untracked: [], tracked: trackedHere.map((l) => l.hunk) })
    }
    const planned = byScene.get(eventId) ?? { eventId, tracked: [], untracked: [], moves: [], comments: [], authors: [] }
    planned.tracked.push(...tracked)
    planned.untracked.push(...untracked)
    planned.comments.push(...commentsOf(part, doc))
    planned.authors = [...new Set([...planned.authors, ...part.authors])]
    byScene.set(eventId, planned)
  }
  // A move's halves paired by their words, in the file's order; a half with no other is a change of its own.
  const taken = new Set<number>()
  let n = 0
  halves.forEach((from, i) => {
    if (from.part !== 'from' || taken.has(i)) return
    const j = halves.findIndex((to, k) => to.part === 'to' && !taken.has(k) && to.words === from.words && !!to.words)
    if (j < 0) return
    taken.add(i).add(j)
    const id = `move-${n++}`
    byScene.get(from.eventId)!.moves.push({ id, part: 'from', hunk: from.hunk })
    byScene.get(halves[j].eventId)!.moves.push({ id, part: 'to', hunk: halves[j].hunk })
  })
  halves.forEach((h, i) => { if (!taken.has(i)) byScene.get(h.eventId)!.tracked.push(h.hunk) })
  return { scenes: [...byScene.values()], unplaced, fromDraft: draft !== null, outside: outsideScenes(doc) }
}

/**
 * A move's half — words taken out of `a` to make `b`, or put in — on the words
 * the file says moved. A comparison may find the same change a few words off:
 * moved in before "He had been sitting", the sentence "He had come across the
 * marsh." is found as "come across the marsh. He had" put in after "He had",
 * which makes the same text and reads as nonsense, and is not the words moved
 * out. So where the change found is not on one of `runs`, it is looked for a
 * little to the left, as far as its own length: the same number of
 * characters, taken out or put in there instead, that leave the same text and
 * are one of the runs. Its words are the run, to pair it by.
 */
function onMovedWords(a: string, b: string, l: LocatedHunk, runs: readonly string[]): { hunk: Hunk; words: string } {
  const removing = (l.to - l.from) > (l.toTo - l.toFrom)
  // The text the half takes out (from `a`) or puts in (in `b`), and how long it is.
  const [whole, other, start, end, offset] = removing ? [a, b, l.from, l.to, l.toFrom - l.from] : [b, a, l.toFrom, l.toTo, l.from - l.toFrom]
  const length = Math.abs((l.to - l.from) - (l.toTo - l.toFrom))
  const found = moveWords(whole.slice(end - length, end))
  if (runs.includes(found) || length === 0) return { hunk: l.hunk, words: found }
  for (let at = end - length - 1; at >= Math.max(0, start - length); at--) {
    const words = moveWords(whole.slice(at, at + length))
    if (!runs.includes(words)) continue
    // The rest the same either way: the text around it, less it, is the other text there.
    const lo = Math.min(at, start)
    if (whole.slice(lo, at) + whole.slice(at + length, end) !== other.slice(lo + offset, end - length + offset)) continue
    return removing
      ? { hunk: hunkAt(a, at, length, ''), words }
      : { hunk: hunkAt(a, at + offset, 0, b.slice(at, at + length)), words }
  }
  return { hunk: l.hunk, words: found }
}

/**
 * Tracked changes cut as the file has them, not as a comparison of their
 * words would (round-trip-plan.md, T1.3). Compared word by word, a deletion of
 * "in his hand" beside the insertion of "under his seal" is two changes —
 * "in" made "under", "hand" made "seal" — with "his" between them in common,
 * and taking one alone leaves "under his hand", which nobody wrote. So the
 * changes a comparison finds inside one of the file's runs are made one, from
 * the run's first to its last. A change is in a run where what it changes —
 * not the word an insertion is anchored on — overlaps the run, in either text.
 */
function alongRuns(a: string, b: string, found: readonly LocatedHunk[], runs: DocScene['runs']): LocatedHunk[] {
  const runOf = (l: LocatedHunk) => {
    const shown = shownChange(l.hunk.before, l.hunk.after)
    const core: [number, number] = [l.from + shown.lead.length, l.to - shown.tail.length]
    const coreB: [number, number] = [l.toFrom + shown.lead.length, l.toTo - shown.tail.length]
    const meets = (x: [number, number], y: [number, number]) => x[0] <= y[1] && y[0] <= x[1]
    return runs.findIndex((r) => meets(core, r.base) || meets(coreB, r.edited))
  }
  const out: LocatedHunk[] = []
  let group: LocatedHunk[] = []
  let groupRun = -1
  const end = () => { if (group.length) out.push(mergedHunk(a, b, group)); group = [] }
  for (const l of found) {
    const r = runOf(l)
    if (r >= 0 && r === groupRun) { group.push(l); continue }
    end()
    group = [l]
    groupRun = r
  }
  end()
  return out
}

/**
 * Edits made with tracking off have no runs to follow, and are cut as their
 * words are; but two with only one word between them, in one sentence, are
 * one edit: "in his hand" made "under his seal" is one, as the editor made it.
 */
function wordsApart(a: string, b: string, found: readonly LocatedHunk[]): LocatedHunk[] {
  const out: LocatedHunk[] = []
  let group: LocatedHunk[] = []
  const end = () => { if (group.length) out.push(mergedHunk(a, b, group)); group = [] }
  for (const l of found) {
    const last = group[group.length - 1]
    // One word between, and no sentence's or clause's end from the first to the second.
    if (last && /^\s+[\p{L}\p{N}'’-]+\s+$/u.test(a.slice(last.to, l.from)) && !/[.!?…;:]/.test(a.slice(last.from, l.from))) { group.push(l); continue }
    end()
    group = [l]
  }
  end()
  return out
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
