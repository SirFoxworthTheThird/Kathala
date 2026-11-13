import { wordCount } from '@/lib/manuscript'

/*
  A named draft of the book (editorial-plan.md, R3): the whole book's prose,
  its scenes and its chapters, as they stood when it was saved — "Draft 2,
  sent to Ana". The journal keeps 500 operations and leaves prose out, and a
  scene keeps its last 20 revisions, so neither can say what has changed since
  a draft went out. A draft can.

  Comparing two (`compareDrafts`) matches scenes by id, the records' own
  identity, and names what happened to each that changed:
  - **edited**: its prose is different;
  - **renamed**: its title is;
  - **moved**: it is in another chapter, or out of order with the scenes
    around it;
  - **added**, or **split from** a scene — a split keeps the first half in
    the scene and gives the rest to a new one, so a new scene most of whose
    paragraphs were in a scene before is that scene's second half;
  - **removed**, or **joined into** a scene — a join moves the second scene's
    prose to the end of the first and deletes it, so a scene gone most of
    whose paragraphs are now in another was joined into it.
*/

export interface DraftScene { id: string; title: string; text: string }
export interface DraftChapter { id: string; number: number; title: string; timelineId: string; scenes: DraftScene[] }

/** The book as a draft holds it: chapters in the book's order, each with its scenes in order. */
export interface DraftBook { version: 1; chapters: DraftChapter[] }

/** The book from its records, in the order given (`inBookChapterOrder`), scenes by their order in the chapter. */
export function draftOf(
  chapters: ReadonlyArray<{ id: string; number: number; title: string; timelineId: string }>,
  events: ReadonlyArray<{ id: string; chapterId: string; sortOrder: number; title: string }>,
  texts: ReadonlyArray<{ eventId: string; text: string }>,
): DraftBook {
  const prose = new Map(texts.map((t) => [t.eventId, t.text]))
  return {
    version: 1,
    chapters: chapters.map((c) => ({
      id: c.id,
      number: c.number,
      title: c.title,
      timelineId: c.timelineId,
      scenes: events
        .filter((e) => e.chapterId === c.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((e) => ({ id: e.id, title: e.title, text: prose.get(e.id) ?? '' })),
    })),
  }
}

export function draftWords(book: DraftBook): number {
  return book.chapters.reduce((n, c) => n + c.scenes.reduce((k, s) => k + wordCount(s.text), 0), 0)
}

export function draftScenes(book: DraftBook): number {
  return book.chapters.reduce((n, c) => n + c.scenes.length, 0)
}

export interface SceneChange {
  sceneId: string
  /** Its title now, or — gone — when last seen. */
  title: string
  /** Its title before, where that was another. */
  titleBefore?: string
  /** The chapter it is in, and was in, by number: null where it is not in one. */
  chapter: number | null
  chapterBefore: number | null
  state: 'kept' | 'added' | 'removed'
  edited: boolean
  /**
   * Edited, and nothing but: its paragraph breaks (the words the same, run
   * differently into paragraphs), or a header line at its start. Compare said
   * only *Edited*, with no figure, and the writer looked for what had changed
   * (round-trip-plan-3.md, T12.4).
   */
  editedOnly?: 'breaks' | 'header'
  renamed: boolean
  moved: boolean
  /** A new scene that is another's second half: that scene. */
  splitFrom?: string
  /** A scene gone into another: that one. */
  joinedInto?: string
  /** A scene split: the new scenes its other half went to. Its prose is shorter for that, not cut. */
  splitInto?: string[]
  /** A scene that took in others by a join: those. Its prose is longer for that, not written. */
  tookIn?: string[]
  textBefore: string
  textAfter: string
  wordsBefore: number
  wordsAfter: number
}

export interface DraftComparison {
  changes: SceneChange[]
  wordsBefore: number
  wordsAfter: number
}

/** A scene's paragraphs, compared as such: blank lines set aside, each trimmed. */
function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
}

/** The share of `part`'s paragraphs that are in `whole`'s. */
function shareIn(part: string, whole: string): number {
  const ps = paragraphs(part)
  if (ps.length === 0) return 0
  const have = new Set(paragraphs(whole))
  return ps.filter((p) => have.has(p)).length / ps.length
}

/** The words of a scene, its whitespace one space: paragraph breaks set aside. */
const flat = (text: string) => text.replace(/\s+/g, ' ').trim()
/** A scene's prose without a header line at its start, one bracketed line or block. */
const unheaded = (text: string) => text.replace(/^\s*\[[^\]]*\]\s*/, '')

/** Whether an edit was only to paragraph breaks, or only to a header line at the scene's start. */
function editedOnly(before: string, after: string): SceneChange['editedOnly'] {
  if (flat(before) === flat(after)) return 'breaks'
  if (flat(unheaded(before)) === flat(unheaded(after))) return 'header'
  return undefined
}

/** Half a scene's paragraphs found elsewhere is enough to say where it went: its other half may since have been edited. */
const CARRIED = 0.5

/** The longest run of `a`'s items that are also in `b` in the same order: the scenes that did not move. */
function inOrder(a: readonly string[], b: readonly string[]): Set<string> {
  const m = a.length
  const n = b.length
  const t: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1])
  const keep = new Set<string>()
  for (let i = 0, j = 0; i < m && j < n;) {
    if (a[i] === b[j]) { keep.add(a[i]); i++; j++ } else if (t[i + 1][j] >= t[i][j + 1]) i++
    else j++
  }
  return keep
}

/** What changed from `before` to `after`, scene by scene, in `after`'s order, with the scenes gone at the end. */
export function compareDrafts(before: DraftBook, after: DraftBook): DraftComparison {
  type Seen = DraftScene & { chapter: number; chapterId: string }
  const flat = (b: DraftBook): Seen[] => b.chapters.flatMap((c) => c.scenes.map((s) => ({ ...s, chapter: c.number, chapterId: c.id })))
  const was = flat(before)
  const now = flat(after)
  const wasById = new Map(was.map((s) => [s.id, s]))
  const nowById = new Map(now.map((s) => [s.id, s]))
  const common = now.filter((s) => wasById.has(s.id)).map((s) => s.id)
  const stayed = inOrder(was.filter((s) => nowById.has(s.id)).map((s) => s.id), common)

  const changes: SceneChange[] = []
  for (const s of now) {
    const old = wasById.get(s.id)
    if (old) {
      const edited = old.text !== s.text
      const renamed = old.title !== s.title
      const moved = old.chapterId !== s.chapterId || !stayed.has(s.id)
      if (!edited && !renamed && !moved) continue
      const only = edited ? editedOnly(old.text, s.text) : undefined
      changes.push({
        sceneId: s.id, title: s.title, ...(renamed ? { titleBefore: old.title } : {}),
        chapter: s.chapter, chapterBefore: old.chapter, state: 'kept', edited, ...(only ? { editedOnly: only } : {}), renamed, moved,
        textBefore: old.text, textAfter: s.text, wordsBefore: wordCount(old.text), wordsAfter: wordCount(s.text),
      })
    } else {
      // A split's second half: most of it was in a scene that is still here, and has lost it.
      const source = was.find((w) => nowById.has(w.id) && shareIn(s.text, w.text) >= CARRIED && shareIn(s.text, nowById.get(w.id)!.text) < CARRIED)
      changes.push({
        sceneId: s.id, title: s.title, chapter: s.chapter, chapterBefore: null, state: 'added', edited: false, renamed: false, moved: false,
        ...(source ? { splitFrom: source.id } : {}),
        textBefore: '', textAfter: s.text, wordsBefore: 0, wordsAfter: wordCount(s.text),
      })
    }
  }
  for (const w of was) {
    if (nowById.has(w.id)) continue
    // A join: most of the scene gone is now in one that was here before, and did not have it.
    const into = now.find((n) => wasById.has(n.id) && shareIn(w.text, n.text) >= CARRIED && shareIn(w.text, wasById.get(n.id)!.text) < CARRIED)
    changes.push({
      sceneId: w.id, title: w.title, chapter: null, chapterBefore: w.chapter, state: 'removed', edited: false, renamed: false, moved: false,
      ...(into ? { joinedInto: into.id } : {}),
      textBefore: w.text, textAfter: '', wordsBefore: wordCount(w.text), wordsAfter: 0,
    })
  }
  // Each split and join named on the scene it came from, or went into, too: its prose changed because of it.
  const byId = new Map(changes.map((c) => [c.sceneId, c]))
  for (const c of changes) {
    if (c.splitFrom) { const from = byId.get(c.splitFrom); if (from) (from.splitInto ??= []).push(c.sceneId) }
    if (c.joinedInto) { const into = byId.get(c.joinedInto); if (into) (into.tookIn ??= []).push(c.sceneId) }
  }
  return { changes, wordsBefore: draftWords(before), wordsAfter: draftWords(after) }
}
