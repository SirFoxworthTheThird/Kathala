import { insideQuotes, sentences, tokens, type Token } from './text'
import type { ProseBaseline, ProseCheckSettings, ProseFinding } from './types'

/*
  The line-level checks an editor makes on the sentences (editorial-plan.md,
  R6), each pure: a scene's plain text in, findings out. What is long or short,
  common or rare, is measured against the book itself where the book can say,
  and against the baseline of books in general where it cannot.

  Every number is a setting. The defaults are the Library run's
  (`scripts/prose-probe.ts`, `docs/records/r6-prose-checks.md`).
*/

export const PROSE_CHECK_DEFAULTS: ProseCheckSettings = {
  echoes: true,
  echoSpan: 20,
  phraseSpan: 40,
  petWords: true,
  petRatio: 3,
  petMinCount: 20,
  petMax: 5,
  rhythm: true,
  rhythmRun: 6,
  rhythmSpread: 3,
  sceneSentenceFactor: 1.8,
  tags: true,
  tagAdverbs: true,
  tagShare: 0.75,
  lengths: true,
  lengthFactor: 4,
}

export function proseSettings(saved?: Partial<ProseCheckSettings> | null): ProseCheckSettings {
  return { ...PROSE_CHECK_DEFAULTS, ...(saved ?? {}) }
}

/** Words that carry the grammar, not the sense: never echoes or pet words on their own. */
export const FUNCTION_WORDS = new Set((
  'a an the and or but nor so yet for of to in on at by with from into onto upon about above below over under ' +
  'between among through during before after since until till while as than then there here this that these those ' +
  'i me my mine myself you your yours yourself he him his himself she her hers herself it its itself we us our ours ' +
  'ourselves they them their theirs themselves who whom whose which what where when why how ' +
  'is am are was were be been being have has had having do does did done not no nor if would could should will shall ' +
  'may might must can cannot all any each every some such own same other only very too also just ' +
  'up down out off again once more most much many few one two said says say asked'
).split(' '))

const rate = (baseline: ProseBaseline, key: string) => baseline.words[key] ?? 0

const NUMBER_WORDS = new Set('two three four five six seven eight nine ten eleven twelve twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million first second third'.split(' '))

/** Whether a word can echo: a content word, written in lower case (a capital is a name, or a sentence's first word), and not a number. */
const echoable = (t: Token) => !t.capital && t.key.length >= 3 && !FUNCTION_WORDS.has(t.key) && !NUMBER_WORDS.has(t.key) && !/^\p{N}+$/u.test(t.key)

/**
 * How near, in words, a second use of this word is an echo: the rarer the
 * word, the further a reader hears it. A word used a hundred times in a million
 * or more is too common to be heard twice.
 */
export function echoReach(perMillion: number, span: number): number {
  if (perMillion >= 100) return 0
  if (perMillion >= 20) return span
  if (perMillion >= 4) return span * 2
  return span * 3
}

const keyOf = (check: string, eventId: string, text: string, n: number) => `${check}:${eventId}:${text.toLowerCase()}:${n}`

/** Numbered keys: the nth time in the scene a check finds the same words. */
function keyed(found: Array<Omit<ProseFinding, 'key'>>): ProseFinding[] {
  const seen = new Map<string, number>()
  return found.map((f) => {
    const base = `${f.check}:${f.text.toLowerCase()}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return { ...f, key: keyOf(f.check, f.eventId, f.text, n) }
  })
}

/**
 * The words a book is about — its subject's, used many times more than books
 * in general use them (the whale in *Moby-Dick*, the brooch in Anne's scene).
 * Said again, they are the subject, not an echo, and used often they are the
 * subject, not a habit.
 */
export function topicalWords(texts: readonly string[], baseline: ProseBaseline): Set<string> {
  const counts = new Map<string, number>()
  let total = 0
  for (const t of texts) for (const w of tokens(t)) { total++; counts.set(w.key, (counts.get(w.key) ?? 0) + 1) }
  const out = new Set<string>()
  for (const [k, n] of counts) {
    if (n < 5) continue
    if ((n / total) * 1e6 >= 5 * Math.max(rate(baseline, k), 0.5)) out.add(k)
  }
  return out
}

/** Whether three words in a row could be an echo: in lower case, two of them carrying sense. */
const phraseLike = (three: readonly Token[]) => !three.some((t) => t.capital)
  && three.filter((t) => !FUNCTION_WORDS.has(t.key) && !TAG_VERBS.has(t.key) && !NUMBER_WORDS.has(t.key)).length >= 2

/** Phrases of three words the book uses three times or more: its own, like a name, and not echoes. */
export function stockPhrases(texts: readonly string[]): Set<string> {
  const counts = new Map<string, number>()
  for (const text of texts) {
    const w = tokens(text)
    for (let i = 0; i + 2 < w.length; i++) {
      const three = [w[i], w[i + 1], w[i + 2]]
      if (!phraseLike(three)) continue
      const k = `${w[i].key} ${w[i + 1].key} ${w[i + 2].key}`
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
  }
  return new Set([...counts].filter(([, n]) => n >= 3).map(([k]) => k))
}

/**
 * Echoes: a word used again too soon, or a phrase of three words used again,
 * in the narration. The second use is the finding. Not within one sentence,
 * where a repeat is how it is built; not a word the book or the scene is
 * about; not a number.
 */
export function echoes(eventId: string, text: string, baseline: ProseBaseline, s: ProseCheckSettings, topical: ReadonlySet<string> = new Set(), stock: ReadonlySet<string> = new Set()): ProseFinding[] {
  if (!s.echoes) return []
  // Narration only: in talk, people answer each other in each other's words ("You refuse?" "I refuse.").
  const quoted = insideQuotes(text)
  const words = tokens(text).filter((t) => quoted[t.start] !== 1)
  // Which sentence each word is in: a word said twice in one sentence is how it is built ("at peace with all … at peace with none").
  const ends = sentences(text).map((x) => x.end)
  const sentence = new Map<Token, number>()
  for (let k = 0, w = 0; w < words.length; w++) {
    while (k < ends.length && ends[k] <= words[w].start) k++
    sentence.set(words[w], k)
  }
  const sentenceOf = (t: Token) => sentence.get(t) ?? 0
  const inScene = new Map<string, number>()
  for (const t of words) inScene.set(t.key, (inScene.get(t.key) ?? 0) + 1)
  const found: Array<Omit<ProseFinding, 'key'>> = []
  const last = new Map<string, Token>()
  for (const t of words) {
    if (!echoable(t) || topical.has(t.key) || (inScene.get(t.key) ?? 0) >= 4) continue
    const before = last.get(t.key)
    last.set(t.key, t)
    if (!before) continue
    const gap = t.index - before.index
    if (sentenceOf(t) === sentenceOf(before)) continue
    if (gap <= echoReach(rate(baseline, t.key), s.echoSpan)) {
      found.push({ check: 'echo', eventId, start: t.start, end: t.end, text: t.text, message: `“${t.text}” again, ${gap} words on` })
    }
  }
  /*
    Phrases: three words in a row, in lower case, not across a sentence's end,
    with two words among them that carry sense — not grammar, not a tag, not a
    number. Not the book's stock phrases (\`stockPhrases\`): "the mender of
    roads" is a man's name in *A Tale of Two Cities*.
  */
  const crosses = (a: Token, b: Token) => sentenceOf(a) !== sentenceOf(b)
  const lastPhrase = new Map<string, number>()
  const marked = new Set(found.map((f) => f.start))
  for (let i = 0; i + 2 < words.length; i++) {
    const three = [words[i], words[i + 1], words[i + 2]]
    const [a, , c] = three
    if (!phraseLike(three) || crosses(a, c)) continue
    const key = three.map((t) => t.key).join(' ')
    if (stock.has(key)) continue
    const before = lastPhrase.get(key)
    lastPhrase.set(key, i)
    if (before === undefined || i - before < 3 || i - before > s.phraseSpan || sentenceOf(words[before]) === sentenceOf(a)) continue
    if (three.some((t) => marked.has(t.start))) continue
    // A longer stretch said again is one echo, not one for each three words of it.
    const prev = found[found.length - 1]
    if (prev && prev.end > a.start && prev.text.includes(' ')) {
      prev.end = c.end
      prev.text = text.slice(prev.start, c.end)
      prev.message = `“${prev.text}” again, ${i - before} words on`
      continue
    }
    const said = text.slice(a.start, c.end)
    found.push({ check: 'echo', eventId, start: a.start, end: c.end, text: said, message: `“${said}” again, ${i - before} words on` })
  }
  return keyed(found.sort((x, y) => x.start - y.start))
}

/** A word the book uses far more often than books in general do. */
export interface PetWord {
  /** One word, or two. */
  words: string
  count: number
  /** Its rate in the book over its rate in general. */
  ratio: number
}

/**
 * The words a writer leans on, as editors list them: hedges, intensifiers, the
 * reflexes of a body in a scene.
 */
export const CRUTCHES = new Set((
  'just really very quite rather somewhat slightly suddenly actually simply somehow merely truly certainly definitely ' +
  'perhaps maybe almost nearly barely hardly utterly completely totally entirely absolutely literally basically ' +
  'still even then now so well indeed also again ' +
  'seemed seem seems appeared began started felt feel feeling realized realised noticed wondered knew thought ' +
  'looked glanced stared gazed turned nodded shrugged smiled grinned frowned sighed laughed shook ' +
  'gaze eyes breath heart face head hand hands little thing things something stuff'
).split(' '))
/** The pairs of words a writer leans on. */
export const CRUTCH_PAIRS = new Set(('began to|started to|seemed to|appeared to|tried to|managed to|a little|a bit|a moment|at once|of course|as if|as though|in fact|at last|kind of|sort of|a lot|could see|could hear|could feel|let out|looked at|looked up|looked down|turned to|turned away|took a|a deep|deep breath|his head|her head|his eyes|her eyes|shook his|shook her|nodded his|nodded her').split('|'))

/**
 * Pet words: the crutch words and pairs (`CRUTCHES`) the book uses `petRatio`
 * times more often than books in general, and at least `petMinCount` times;
 * the `petMax` it uses most out of the ordinary.
 * Only crutches: any word at all, measured so, is a book's subject as often as
 * a writer's habit — the sea in *Moby-Dick*, the children in *Peter Pan*. Only
 * words written in lower case count, so names do not.
 */
export function petWords(scenes: readonly string[], baseline: ProseBaseline, s: ProseCheckSettings): PetWord[] {
  if (!s.petWords) return []
  const one = new Map<string, number>()
  const two = new Map<string, number>()
  let total = 0
  for (const text of scenes) {
    const words = tokens(text)
    total += words.length
    for (let i = 0; i < words.length; i++) {
      const t = words[i]
      if (t.capital) continue
      one.set(t.key, (one.get(t.key) ?? 0) + 1)
      const n = words[i + 1]
      if (n && !n.capital && !/[.!?;:,]/.test(text.slice(t.end, n.start))) {
        const k = `${t.key} ${n.key}`
        if (CRUTCH_PAIRS.has(k)) two.set(k, (two.get(k) ?? 0) + 1)
      }
    }
  }
  if (total === 0) return []
  const out: PetWord[] = []
  const add = (w: string, count: number, usual: number | undefined) => {
    if (count < s.petMinCount || !usual) return
    const ratio = (count / total) * 1e6 / usual
    if (ratio >= s.petRatio) out.push({ words: w, count, ratio })
  }
  for (const [w, count] of one) if (CRUTCHES.has(w)) add(w, count, baseline.words[w])
  for (const [w, count] of two) add(w, count, baseline.bigrams[w])
  return out.sort((a, b) => b.ratio - a.ratio).slice(0, s.petMax)
}

/** A scene's uses of the book's pet words: one finding a word, at its first use, the rest beside it. */
export function petWordsIn(eventId: string, text: string, pets: readonly PetWord[]): ProseFinding[] {
  if (pets.length === 0) return []
  const words = tokens(text)
  const found: Array<Omit<ProseFinding, 'key'>> = []
  for (const p of pets) {
    const parts = p.words.split(' ')
    const at: Array<[number, number]> = []
    for (let i = 0; i < words.length; i++) {
      const t = words[i]
      if (t.capital || t.key !== parts[0]) continue
      if (parts.length === 2 && (words[i + 1]?.key !== parts[1] || /[.!?;:,]/.test(text.slice(t.end, words[i + 1].start)))) continue
      at.push([t.start, parts.length === 2 ? words[i + 1].end : t.end])
    }
    if (at.length === 0) continue
    const [[start, end], ...more] = at
    found.push({
      check: 'pet', eventId, start, end, text: text.slice(start, end),
      message: `“${p.words}”: ${at.length === 1 ? 'once' : `${at.length} times`} here, ${p.count} in the book, ${p.ratio.toFixed(1)}× as often as books in general`,
      ...(more.length ? { more } : {}),
    })
  }
  return keyed(found.sort((a, b) => a.start - b.start))
}

/**
 * Sentence rhythm: a run of `rhythmRun` sentences told in narration whose
 * lengths are all within `rhythmSpread` words of each other. Spoken lines are
 * left out: an exchange of short lines is how talk goes.
 */
export function rhythm(eventId: string, text: string, s: ProseCheckSettings): ProseFinding[] {
  if (!s.rhythm) return []
  const all = sentences(text)
  const found: Array<Omit<ProseFinding, 'key'>> = []
  let i = 0
  while (i < all.length) {
    let j = i
    let lo = Infinity
    let hi = -Infinity
    while (j < all.length && !all[j].spoken && all[j].words >= 3) {
      const nlo = Math.min(lo, all[j].words)
      const nhi = Math.max(hi, all[j].words)
      if (nhi - nlo > s.rhythmSpread) break
      lo = nlo
      hi = nhi
      j++
    }
    if (j - i >= s.rhythmRun) {
      const start = all[i].start
      const end = all[j - 1].end
      found.push({ check: 'rhythm', eventId, start, end, text: text.slice(start, end), message: `${j - i} sentences in a row of ${lo === hi ? lo : `${lo} to ${hi}`} words` })
      i = j
    } else i++
  }
  return keyed(found)
}

/** A scene's sentences on average, against the book's: words per sentence, narration and speech alike. */
export function meanSentence(text: string): { sentences: number; mean: number } {
  const all = sentences(text).filter((x) => x.words > 0)
  return { sentences: all.length, mean: all.length ? all.reduce((n, x) => n + x.words, 0) / all.length : 0 }
}

/** A scene whose sentences are, on average, `sceneSentenceFactor` times longer or shorter than the book's. */
export function sceneRhythm(eventId: string, text: string, bookMean: number, s: ProseCheckSettings): ProseFinding[] {
  if (!s.rhythm || bookMean <= 0) return []
  const { sentences: n, mean } = meanSentence(text)
  if (n < 20) return []
  const f = s.sceneSentenceFactor
  if (mean > bookMean * f) return keyed([{ check: 'rhythm', eventId, start: 0, end: 0, text: '', message: `Long sentences: ${mean.toFixed(0)} words on average, against ${bookMean.toFixed(0)} in the book` }])
  if (mean < bookMean / f) return keyed([{ check: 'rhythm', eventId, start: 0, end: 0, text: '', message: `Short sentences: ${mean.toFixed(0)} words on average, against ${bookMean.toFixed(0)} in the book` }])
  return []
}

const PLAIN_TAGS = new Set(['said', 'says', 'asked', 'asks'])
export const TAG_VERBS = new Set([...PLAIN_TAGS, ...(
  'replied answered whispered shouted cried exclaimed muttered murmured snapped growled hissed sighed laughed called added ' +
  'continued demanded insisted explained admitted suggested protested declared retorted stammered breathed groaned yelled ' +
  'screamed sobbed gasped roared barked snarled whined grumbled mumbled observed remarked returned rejoined responded ' +
  'inquired enquired interrupted agreed repeated began went urged pleaded begged chuckled giggled sneered scoffed ' +
  'whimpered moaned wailed bellowed thundered purred cooed drawled lied announced answered warned'
).split(' ')])

/** Words in -ly after a tag that are not how it was said. */
const NOT_ADVERBS = new Set(['only', 'early', 'family', 'holy', 'ugly', 'silly', 'jolly', 'lily', 'belly', 'bully', 'rely', 'reply', 'supply', 'apply', 'fly', 'july', 'italy', 'emily', 'lovely', 'lonely', 'friendly', 'likely', 'kindly'])

interface Tag { verb: Token; adverb?: Token }

/** The dialogue tags in a text: a tag verb within a few words of a closing quote, before it or after it. */
export function dialogueTags(text: string): Tag[] {
  const words = tokens(text)
  const out: Tag[] = []
  const quotes = [...text.matchAll(/[“”"]/g)].map((m) => m.index)
  const count = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length
  // After a quote: “…,” she said. Before one: she said, “…”. A few words between, and no sentence ending.
  const nearQuote = (t: Token) => {
    const before = quotes.filter((q) => q < t.start).pop()
    const after = quotes.find((q) => q >= t.end)
    const gapBefore = before === undefined ? null : text.slice(before + 1, t.start)
    const gapAfter = after === undefined ? null : text.slice(t.end, after)
    return (gapBefore !== null && gapBefore.length <= 40 && count(gapBefore) <= 3 && !/[.!?\n]/.test(gapBefore))
      || (gapAfter !== null && gapAfter.length <= 30 && count(gapAfter) <= 3 && !/[.!?\n]/.test(gapAfter))
  }
  for (let i = 0; i < words.length; i++) {
    const t = words[i]
    if (!TAG_VERBS.has(t.key) || !nearQuote(t)) continue
    // "said softly", "said Mira softly", "said she, softly".
    const adverb = [words[i + 1], words[i + 2]].find((w) => w && /ly$/.test(w.key) && !NOT_ADVERBS.has(w.key) && !/[.!?"”]/.test(text.slice(t.end, w.start)))
    out.push({ verb: t, ...(adverb ? { adverb } : {}) })
  }
  return out
}

/**
 * Dialogue tags: an adverb on a tag ("said softly"); and where more than
 * `tagShare` of a scene's tags are other than said and asked, each of those.
 */
export function tags(eventId: string, text: string, s: ProseCheckSettings): ProseFinding[] {
  if (!s.tags) return []
  const all = dialogueTags(text)
  const found: Array<Omit<ProseFinding, 'key'>> = []
  if (s.tagAdverbs) {
    for (const t of all) {
      if (!t.adverb) continue
      const said = text.slice(t.verb.start, t.adverb.end)
      found.push({ check: 'tag', eventId, start: t.verb.start, end: t.adverb.end, text: said, message: `An adverb on a tag: “${said}”` })
    }
  }
  const fancy = all.filter((t) => !PLAIN_TAGS.has(t.verb.key))
  if (all.length >= 8 && fancy.length / all.length > s.tagShare) {
    const share = Math.round((fancy.length / all.length) * 100)
    for (const t of fancy) {
      if (t.adverb && s.tagAdverbs) continue
      found.push({ check: 'tag', eventId, start: t.verb.start, end: t.verb.end, text: t.verb.text, message: `“${t.verb.text}”: ${share}% of this scene’s tags are not said or asked` })
    }
  }
  return keyed(found.sort((a, b) => a.start - b.start))
}

/** The middle value. */
export function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * Lengths: a scene, or a chapter, `lengthFactor` times longer or shorter than
 * the book's usual (its median). A book of fewer than five is not measured.
 */
export function lengths(items: ReadonlyArray<{ id: string; words: number }>, s: ProseCheckSettings): Array<{ id: string; words: number; usual: number; longer: boolean }> {
  if (!s.lengths || items.length < 5) return []
  const usual = median(items.map((i) => i.words))
  if (usual <= 0) return []
  return items
    .filter((i) => i.words > usual * s.lengthFactor || (i.words > 0 && i.words < usual / s.lengthFactor))
    .map((i) => ({ id: i.id, words: i.words, usual, longer: i.words > usual }))
}
