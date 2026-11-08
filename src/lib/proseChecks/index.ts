import { echoes, lengths, meanSentence, petWords, petWordsIn, rhythm, sceneRhythm, stockPhrases, tags, topicalWords, type PetWord } from './checks'
import { plainScene, tokens, type PlainScene } from './text'
import type { ProseBaseline, ProseCheckSettings, ProseFinding } from './types'

export * from './types'
export { PROSE_CHECK_DEFAULTS, proseSettings, type PetWord } from './checks'
export { plainScene, type PlainScene } from './text'

/*
  The prose checks run over a book (editorial-plan.md, R6): each scene's plain
  text checked on its own, and measured against the book's own lengths, rhythm
  and words.
*/

export interface BookProse {
  /** In the book's order. */
  chapters: ReadonlyArray<{ id: string; number: number; scenes: ReadonlyArray<{ eventId: string; text: string }> }>
}

export interface ProseReport {
  /** Each scene's plain text, as the findings' offsets are in. */
  plain: Map<string, PlainScene>
  /** Each scene's findings, in the order they come in it. */
  byScene: Map<string, ProseFinding[]>
  /** The book's pet words. */
  pets: PetWord[]
  /** Chapters far longer or shorter than the book's usual. */
  chapterLengths: Map<string, string>
}

const ORDER: Record<ProseFinding['check'], number> = { length: 0, rhythm: 1, pet: 2, echo: 3, tag: 4 }

export function checkBook(book: BookProse, baseline: ProseBaseline, s: ProseCheckSettings, dismissed: ReadonlySet<string> = new Set()): ProseReport {
  const plain = new Map<string, PlainScene>()
  const scenes = book.chapters.flatMap((c) => c.scenes)
  for (const sc of scenes) plain.set(sc.eventId, plainScene(sc.text))
  const texts = scenes.map((sc) => plain.get(sc.eventId)!.text)
  const pets = petWords(texts, baseline, s)
  const topical = topicalWords(texts, baseline)
  const stock = stockPhrases(texts)

  // The book's sentences on average, every sentence counted once.
  let n = 0
  let words = 0
  for (const t of texts) { const m = meanSentence(t); n += m.sentences; words += m.mean * m.sentences }
  const bookMean = n ? words / n : 0

  const wordsOf = new Map(scenes.map((sc) => [sc.eventId, tokens(plain.get(sc.eventId)!.text).length]))
  const longShort = new Map(lengths(scenes.map((sc) => ({ id: sc.eventId, words: wordsOf.get(sc.eventId) ?? 0 })).filter((x) => x.words > 0), s).map((l) => [l.id, l]))

  const byScene = new Map<string, ProseFinding[]>()
  for (const sc of scenes) {
    const text = plain.get(sc.eventId)!.text
    const found: ProseFinding[] = []
    const len = longShort.get(sc.eventId)
    if (len) {
      found.push({
        check: 'length', eventId: sc.eventId, start: 0, end: 0, text: '',
        message: `${len.longer ? 'A long scene' : 'A short scene'}: ${len.words.toLocaleString('en')} words, against ${Math.round(len.usual).toLocaleString('en')} usually in this book`,
        key: `length:${sc.eventId}::0`,
      })
    }
    found.push(...sceneRhythm(sc.eventId, text, bookMean, s), ...rhythm(sc.eventId, text, s), ...petWordsIn(sc.eventId, text, pets), ...echoes(sc.eventId, text, baseline, s, topical, stock), ...tags(sc.eventId, text, s))
    const kept = found.filter((f) => !dismissed.has(f.key))
    kept.sort((a, b) => a.start - b.start || ORDER[a.check] - ORDER[b.check])
    byScene.set(sc.eventId, kept)
  }

  const chapterLengths = new Map<string, string>()
  const chapterWords = book.chapters.map((c) => ({ id: c.id, words: c.scenes.reduce((w, sc) => w + (wordsOf.get(sc.eventId) ?? 0), 0) })).filter((c) => c.words > 0)
  for (const l of lengths(chapterWords, s)) {
    chapterLengths.set(l.id, `${l.longer ? 'A long chapter' : 'A short chapter'}: ${l.words.toLocaleString('en')} words, against ${Math.round(l.usual).toLocaleString('en')} usually in this book`)
  }
  return { plain, byScene, pets, chapterLengths }
}

/** How many of each check a scene, or a chapter, has: for the checker's summary. */
export function tally(findings: readonly ProseFinding[]): Record<ProseFinding['check'], number> {
  const out = { echo: 0, pet: 0, rhythm: 0, tag: 0, length: 0 }
  for (const f of findings) out[f.check]++
  return out
}
