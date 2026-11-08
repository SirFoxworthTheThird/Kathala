import { describe, it, expect } from 'vitest'
import { plainScene, sentences, tokens, insideQuotes } from '@/lib/proseChecks/text'
import {
  echoes, echoReach, lengths, petWords, petWordsIn, proseSettings, PROSE_CHECK_DEFAULTS, rhythm, sceneRhythm,
  stockPhrases, tags, topicalWords, dialogueTags,
} from '@/lib/proseChecks/checks'
import { checkBook } from '@/lib/proseChecks'
import { countText, emptyCounts, addBook, toBaseline, without } from '@/lib/proseChecks/baseline'
import type { ProseBaseline } from '@/lib/proseChecks/types'

/** The prose checks (editorial-plan.md, R6), each on prose made to show it. */

const S = PROSE_CHECK_DEFAULTS
/** A baseline where the words named are common, uncommon or rare; any other is rare. */
const BASE: ProseBaseline = {
  total: 1_000_000,
  words: { lantern: 30, door: 300, glimmer: 5, just: 500, turned: 400, the: 60000 },
  bigrams: { 'a little': 400, 'began to': 100 },
}
const found = (fs: Array<{ text: string }>) => fs.map((f) => f.text)

describe('the text the checks read', () => {
  it('is the page’s: paragraphs a blank line apart, italics’ underscores gone, each span where it is', () => {
    const p = plainScene('She _did_ go.\n\n\nThe end.')
    expect(p.text).toBe('She did go.\n\nThe end.')
    expect(p.paragraphs.map((x) => x.start)).toEqual([0, 13])
    expect(p.paragraphs[0].spans).toEqual([{ text: 'She ', em: false, start: 0 }, { text: 'did', em: true, start: 4 }, { text: ' go.', em: false, start: 7 }])
  })

  it('sentences end at . ! ? and a paragraph, not after a title or an initial', () => {
    const t = 'Mr. Darcy came. J. R. waited! Did she?\n\nNo'
    expect(sentences(t).map((s) => t.slice(s.start, s.end))).toEqual(['Mr. Darcy came.', 'J. R. waited!', 'Did she?', 'No'])
  })

  it('speech is what is inside quotation marks, double or single, an apostrophe not closing them', () => {
    const t = '“Come in. Sit down. It’s late.” She sat. ‘Mind the cat’s tail,’ he said.'
    expect(sentences(t).map((s) => [t.slice(s.start, s.end), s.spoken])).toEqual([
      ['“Come in.', true], ['Sit down.', true], ['It’s late.”', true], ['She sat.', false], ['‘Mind the cat’s tail,’ he said.', true],
    ])
    const q = insideQuotes('a “b” c')
    expect([q[0], q[3], q[6]]).toEqual([0, 1, 0])
  })

  it('words are lower-cased keys, a possessive taken off, and say whether they are capitalised', () => {
    expect(tokens('Mira’s lantern').map((t) => [t.key, t.capital])).toEqual([['mira', true], ['lantern', false]])
  })
})

describe('echoes', () => {
  it('a word used again in the next sentence within its reach; further for a rarer word; never for a common one', () => {
    expect(echoReach(300, 20)).toBe(0)
    expect(echoReach(30, 20)).toBe(20)
    expect(echoReach(5, 20)).toBe(40)
    expect(echoReach(0, 20)).toBe(60)
    const near = 'She lit the lantern. The lantern smoked.'
    expect(found(echoes('e', near, BASE, S))).toEqual(['lantern'])
    expect(echoes('e', near, BASE, S)[0]).toMatchObject({ check: 'echo', start: near.lastIndexOf('lantern'), message: '“lantern” again, 2 words on' })
    // Twenty-five words apart: beyond an uncommon word's reach, within a rare one's.
    const filler = ' and then she walked on past the well and the gate and the trees and the wall and the field and on'
    expect(found(echoes('e', `She lit the lantern.${filler}. The lantern smoked.`, BASE, S))).toEqual([])
    expect(found(echoes('e', `She saw a glimmer.${filler}. The glimmer went.`, BASE, S))).toEqual(['glimmer'])
    expect(found(echoes('e', 'She shut the door. The door held.', BASE, S))).toEqual([])
  })

  it('not within one sentence, not in speech, not a number, not the scene’s or the book’s subject, and not when off', () => {
    expect(echoes('e', 'She lit the lantern and the lantern smoked.', BASE, S)).toEqual([])
    expect(echoes('e', '“The lantern. The lantern!” she cried.', BASE, S)).toEqual([])
    expect(echoes('e', 'Seven men came. Then seven more.', BASE, S)).toEqual([])
    const four = 'A lantern. A lantern. A lantern. A lantern.'
    expect(echoes('e', four, BASE, S)).toEqual([])
    expect(echoes('e', 'She lit the lantern. The lantern smoked.', BASE, S, new Set(['lantern']))).toEqual([])
    expect(echoes('e', 'She lit the lantern. The lantern smoked.', BASE, { ...S, echoes: false })).toEqual([])
  })

  it('a phrase of three with two words of sense said again; not the book’s stock phrases', () => {
    // Words too common to echo alone, said again together.
    const common = { ...BASE, words: { ...BASE.words, crossed: 150, cold: 150, stone: 150 } }
    const t = 'He crossed the cold stone floor. Later she crossed the cold stone stair.'
    expect(echoes('e', t, common, S).map((f) => [f.text, f.message])).toEqual([['crossed the cold stone', '“crossed the cold stone” again, 7 words on']])
    expect(echoes('e', t, common, S, new Set(), new Set(['crossed the cold', 'the cold stone']))).toEqual([])
    expect(echoes('e', t, common, { ...S, phraseSpan: 6 })).toEqual([])
    expect([...stockPhrases(['the mender of roads came. the mender of roads went. the mender of roads sat.'])]).toContain('mender of roads')
    // Three words with one of sense only: "in the lantern" is grammar round a word.
    expect(found(echoes('e', 'It was in the hall. Then it was in the hall again.', { ...BASE, words: { ...BASE.words, hall: 300 } }, S))).toEqual([])
  })

  it('a word the book uses far more than books in general is its subject', () => {
    const t = 'whale whale whale whale whale the the the the the the the the the the'
    expect(topicalWords([t], BASE)).toEqual(new Set(['whale', 'the']))
    expect(topicalWords(['a whale once'], BASE)).toEqual(new Set())
  })
})

describe('pet words', () => {
  const book = (n: number) => Array.from({ length: n }, () => 'She just went. It was just so.')
  it('a crutch the book uses three times its usual rate, often enough; never a name, and only the worst few', () => {
    const pets = petWords(book(20), BASE, S)
    expect(pets.map((p) => [p.words, p.count])).toEqual([['just', 40]])
    expect(pets[0].ratio).toBeGreaterThan(3)
    expect(petWords(book(9), BASE, S)).toEqual([])
    expect(petWords(book(20), BASE, { ...S, petRatio: 1e6 })).toEqual([])
    expect(petWords(Array.from({ length: 30 }, () => 'Just then.'), BASE, S)).toEqual([])
    expect(petWords(book(20), BASE, { ...S, petWords: false })).toEqual([])
    // A word that is no crutch is a subject, however often.
    expect(petWords(Array.from({ length: 30 }, () => 'the lantern, the lantern.'), BASE, S)).toEqual([])
    const many = Array.from({ length: 30 }, () => 'She just turned. It began to rain a little.')
    expect(petWords(many, BASE, S).map((p) => p.words).sort()).toEqual(['a little', 'began to', 'just', 'turned'])
    expect(petWords(many, BASE, { ...S, petMax: 2 })).toHaveLength(2)
  })

  it('in a scene: one finding a pet word, at its first use, the rest beside it', () => {
    const t = 'It was just so. She just went.'
    const [f, ...rest] = petWordsIn('e', t, [{ words: 'just', count: 40, ratio: 5 }])
    expect(rest).toEqual([])
    expect(f).toMatchObject({ check: 'pet', start: 7, end: 11, more: [[20, 24]] })
    expect(f.message).toBe('“just”: 2 times here, 40 in the book, 5.0× as often as books in general')
    expect(petWordsIn('e', 'It began to rain. It began, to rain.', [{ words: 'began to', count: 30, ratio: 4 }]).map((x) => [x.text, x.more])).toEqual([['began to', undefined]])
  })
})

describe('sentence rhythm', () => {
  const even = 'He went to the door. She came to the hall. They sat by the fire. We ate the cold bread. I saw the old dog. You read the long book.'
  it('six narrated sentences in a row of nearly one length; not spoken ones; not when off', () => {
    expect(rhythm('e', even, S)).toEqual([expect.objectContaining({ check: 'rhythm', start: 0, end: even.length, message: '6 sentences in a row of 5 words' })])
    expect(rhythm('e', even.replace('We ate the cold bread.', 'We ate the cold bread that the old woman had baked at dawn.'), S)).toEqual([])
    expect(rhythm('e', even.split('. ').map((x) => `“${x.replace(/\.$/, '')}.”`).join(' '), S)).toEqual([])
    expect(rhythm('e', even, { ...S, rhythm: false })).toEqual([])
    expect(rhythm('e', even, { ...S, rhythmRun: 7 })).toEqual([])
  })

  it('a scene whose sentences are far longer or shorter than the book’s', () => {
    const short = Array.from({ length: 20 }, () => 'He ran.').join(' ')
    expect(sceneRhythm('e', short, 10, S)[0].message).toBe('Short sentences: 2 words on average, against 10 in the book')
    expect(sceneRhythm('e', short, 3, S)).toEqual([])
    expect(sceneRhythm('e', Array.from({ length: 19 }, () => 'He ran.').join(' '), 10, S)).toEqual([])
  })
})

describe('dialogue tags', () => {
  it('a tag is a speech verb a few words from a quotation mark', () => {
    expect(dialogueTags('“Go,” she said. He said nothing of it for an hour.').map((t) => t.verb.text)).toEqual(['said'])
    expect(dialogueTags('She said, “Go.”').map((t) => t.verb.text)).toEqual(['said'])
  })

  it('an adverb on a tag, after it or after the name; not an -ly word that is not one; not when off', () => {
    const t = '“Go,” she said softly. “Stay,” said Mira gently. “Fine,” he said only once.'
    expect(found(tags('e', t, S))).toEqual(['said softly', 'said Mira gently'])
    expect(tags('e', t, { ...S, tagAdverbs: false })).toEqual([])
    expect(tags('e', t, { ...S, tags: false })).toEqual([])
  })

  it('where more than the share of a scene’s tags are not said or asked, each of those', () => {
    const line = (v: string) => `“Yes,” she ${v}.`
    const fancy = [...Array(7).fill('cried'), 'said'].map(line).join(' ')
    const out = tags('e', fancy, S)
    expect(out).toHaveLength(7)
    expect(out[0].message).toBe('“cried”: 88% of this scene’s tags are not said or asked')
    expect(tags('e', fancy, { ...S, tagShare: 0.9 })).toEqual([])
    // Too few tags to say.
    expect(tags('e', Array(7).fill('cried').map(line).join(' '), S)).toEqual([])
  })
})

describe('lengths', () => {
  const items = [100, 110, 90, 105, 95, 1000, 10].map((w, i) => ({ id: `s${i}`, words: w }))
  it('far longer or shorter than the book’s usual; a book of fewer than five is not measured', () => {
    expect(lengths(items, S).map((l) => [l.id, l.longer])).toEqual([['s5', true], ['s6', false]])
    expect(lengths(items, { ...S, lengthFactor: 20 })).toEqual([])
    expect(lengths(items.slice(5), S)).toEqual([])
    expect(lengths(items, { ...S, lengths: false })).toEqual([])
  })
})

describe('a book checked', () => {
  const scene = (eventId: string, text: string) => ({ eventId, text })
  const book = {
    chapters: [
      { id: 'c1', number: 1, scenes: [scene('a', 'She lit the lantern. The lantern smoked.'), scene('b', 'He waited by the gate for a while.')] },
      { id: 'c2', number: 2, scenes: [scene('c', 'The lantern swung. The lantern died.')] },
    ],
  }
  it('finds each scene’s, keyed so a dismissal stays dismissed', () => {
    const r = checkBook(book, BASE, S)
    expect(r.byScene.get('a')!.map((f) => f.key)).toEqual(['echo:a:lantern:0'])
    expect(r.byScene.get('b')).toEqual([])
    const again = checkBook(book, BASE, S, new Set(['echo:a:lantern:0']))
    expect(again.byScene.get('a')).toEqual([])
    expect(again.byScene.get('c')!.map((f) => f.key)).toEqual(['echo:c:lantern:0'])
  })

  it('settings: what is saved over the defaults', () => {
    expect(proseSettings(null)).toEqual(PROSE_CHECK_DEFAULTS)
    expect(proseSettings({ echoSpan: 5 })).toEqual({ ...PROSE_CHECK_DEFAULTS, echoSpan: 5 })
  })
})

describe('the baseline', () => {
  it('counts words and pairs, keeps words used often enough and only the pairs a pet word can be; one book can be taken out', () => {
    const a = countText('Just a little. Just a little more. A little.', emptyCounts())
    const b = countText('The cat sat. The cat ran.', emptyCounts())
    const all = addBook(addBook(emptyCounts(), a), b)
    expect(all.total).toBe(a.total + b.total)
    const base = toBaseline(all)
    expect(base.words.little).toBeCloseTo((3 / all.total) * 1e6, 0)
    expect(Object.keys(base.bigrams)).toEqual(['a little'])
    // A sentence's end parts a pair.
    expect(a.bigrams.get('little just')).toBeUndefined()
    expect(toBaseline(all, 1e6).words).toEqual({})
    const rest = without(all, b)
    expect(rest.total).toBe(a.total)
    expect(rest.words.get('cat')).toBeUndefined()
    expect(rest.words.get('little')).toBe(3)
  })
})
