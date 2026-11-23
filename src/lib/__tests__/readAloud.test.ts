import { describe, it, expect } from 'vitest'
import {
  aloudQueue, BREAK_MS, DIVIDER_MS, hasWords, headingSaid, nextSpoken, PART_CHARS, previousSpoken, speechParts, spokenText,
  startAt, type AloudChapter, type AloudItem,
} from '@/lib/readAloud'
import { plainScene } from '@/lib/proseChecks/text'
import { paragraphBlocks } from '@/lib/manuscriptParagraphs'
import { emphasisSpans } from '@/lib/proseEmphasis'

/*
  Reading the prose aloud (issue #704): docs/records/read-aloud-plan.md.
*/

const fixtures = import.meta.glob('../../test/fixtures/worlds/*.pwk', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

type Raw = { chapters: Array<{ id: string; number: number; title: string }>; events: Array<{ id: string; chapterId: string; sortOrder: number }>; sceneTexts?: Array<{ eventId: string; text: string }> }

function bookOf(name: string): AloudChapter[] {
  const raw = Object.entries(fixtures).find(([p]) => p.includes(name))?.[1]
  if (!raw) throw new Error(`no fixture ${name}`)
  const b = JSON.parse(raw) as Raw
  const texts = new Map((b.sceneTexts ?? []).map((t) => [t.eventId, t.text]))
  return [...b.chapters].sort((x, y) => x.number - y.number).map((c) => ({
    id: c.id,
    number: c.number,
    title: c.title,
    scenes: b.events.filter((e) => e.chapterId === c.id).sort((x, y) => x.sortOrder - y.sortOrder)
      .map((e) => ({ eventId: e.id, text: texts.get(e.id) ?? '', written: !!(texts.get(e.id) ?? '').trim() })),
  }))
}

const count = (q: AloudItem[], kind: AloudItem['kind']) => q.filter((x) => x.kind === kind).length

describe('the books, read aloud', () => {
  it('The Prisoner of Zenda: its chapters, sentences, breaks and two dividers, as the Library probe counts them', () => {
    const q = aloudQueue(bookOf('zenda'))
    expect(count(q, 'heading')).toBe(22)
    expect(count(q, 'sentence')).toBe(4004)
    expect(q.filter((x) => x.kind === 'pause' && x.ms === DIVIDER_MS)).toHaveLength(2)
    expect(q.filter((x) => x.kind === 'pause' && x.ms === BREAK_MS)).toHaveLength(33)
    // The probe's 4,006 sentences are these, and the two dividers.
    expect(count(q, 'sentence') + 2).toBe(4006)
  })

  it('Jekyll and Hyde: 1,180 sentences, and nothing said of markup', () => {
    const q = aloudQueue(bookOf('jekyll'))
    expect(count(q, 'heading')).toBe(10)
    expect(count(q, 'sentence')).toBe(1180)
    for (const x of q) if (x.kind !== 'pause') for (const part of x.say) {
      expect(part).not.toMatch(/[_*]|\[\d+\]|\s{2}/)
      expect(part.length).toBeLessThanOrEqual(PART_CHARS)
      expect(hasWords(part)).toBe(true)
    }
  })

  it('each sentence is where the page has it: its paragraph’s text, as Read renders it, holds it at its offsets', () => {
    for (const name of ['zenda', 'jekyll']) {
      const chapters = bookOf(name)
      const q = aloudQueue(chapters)
      const textOf = new Map(chapters.flatMap((c) => c.scenes).map((s) => [s.eventId, s.text]))
      let checked = 0
      for (const x of q) {
        if (x.kind !== 'sentence') continue
        // Read draws a paragraph as its emphasis spans' text (`useManuscriptBook`).
        const para = paragraphBlocks(textOf.get(x.eventId)!)[x.paragraph]
        const shown = emphasisSpans(para.text).map((s) => s.text).join('')
        expect(shown.slice(x.from, x.to)).toBe(x.text)
        checked++
      }
      expect(checked).toBeGreaterThan(1000)
    }
  })
})

describe('what is spoken (D-3)', () => {
  it('takes out the italics left behind, footnote markers and runs of space; keeps an editor’s words', () => {
    expect(spokenText('“_Un_important, of course,” the King said.')).toBe('“Unimportant, of course,” the King said.')
    expect(spokenText('_“We are, dear Sirs,')).toBe('“We are, dear Sirs,')
    expect(spokenText('night.”[1] And [*] then [†] [12]')).toBe('night.” And then')
    expect(spokenText('the wild calots [dogs] in the arena')).toBe('the wild calots [dogs] in the arena')
    expect(spokenText('Twinkle, twinkle,\nlittle bat!\n  How I wonder')).toBe('Twinkle, twinkle, little bat! How I wonder')
    expect(spokenText('* * * * *')).toBe('')
  })

  it('a divider is a pause, a scene break a longer one, and a chapter is announced', () => {
    const q = aloudQueue([{
      id: 'c4', number: 4, title: 'The Lizard on the _Wall_',
      scenes: [
        { eventId: 'a', text: 'He climbed. He paused.\n\n* * * * *\n\nThen he _ran_.', written: true },
        { eventId: 'gone', text: '', written: false },
        { eventId: 'b', text: 'Night fell.', written: true },
      ],
    }])
    expect(q).toEqual([
      { kind: 'heading', chapterId: 'c4', say: ['Chapter 4. The Lizard on the Wall.'] },
      { kind: 'sentence', chapterId: 'c4', eventId: 'a', paragraph: 0, from: 0, to: 11, text: 'He climbed.', say: ['He climbed.'] },
      { kind: 'sentence', chapterId: 'c4', eventId: 'a', paragraph: 0, from: 12, to: 22, text: 'He paused.', say: ['He paused.'] },
      { kind: 'pause', chapterId: 'c4', eventId: 'a', ms: DIVIDER_MS },
      // Its paragraph shows "Then he ran." with the underscores gone: the offsets are the page's.
      { kind: 'sentence', chapterId: 'c4', eventId: 'a', paragraph: 2, from: 0, to: 12, text: 'Then he ran.', say: ['Then he ran.'] },
      { kind: 'pause', chapterId: 'c4', eventId: 'b', ms: BREAK_MS },
      { kind: 'sentence', chapterId: 'c4', eventId: 'b', paragraph: 0, from: 0, to: 11, text: 'Night fell.', say: ['Night fell.'] },
    ])
  })

  it('a chapter with nothing written is not announced', () => {
    expect(aloudQueue([{ id: 'c1', number: 1, title: 'Empty', scenes: [{ eventId: 'x', text: '', written: false }] }])).toEqual([])
  })

  it('a heading: its number, its title, and a full stop where it has none', () => {
    expect(headingSaid(4, 'The Lizard on the Wall')).toBe('Chapter 4. The Lizard on the Wall.')
    expect(headingSaid(9, 'Who Goes There?')).toBe('Chapter 9. Who Goes There?')
    expect(headingSaid(2, '')).toBe('Chapter 2.')
    expect(headingSaid(3, '  ')).toBe('Chapter 3.')
  })

  it('a verse paragraph’s sentence keeps its place across the lines', () => {
    const text = 'Before.\n\n    How doth the little crocodile\n    Improve his shining tail!\n\nAfter.'
    const q = aloudQueue([{ id: 'c', number: 1, title: 'T', scenes: [{ eventId: 'e', text, written: true }] }])
    const verse = q.find((x) => x.kind === 'sentence' && x.paragraph === 1)
    expect(verse).toMatchObject({ from: 0, text: 'How doth the little crocodile\nImprove his shining tail!', say: ['How doth the little crocodile Improve his shining tail!'] })
    expect(plainScene(text).paragraphs[1].verse).toBe(true)
  })
})

describe('a long sentence in parts (D-4)', () => {
  it('one part within the limit', () => {
    expect(speechParts('A short one.')).toEqual(['A short one.'])
  })

  it('cut at a semicolon before a comma, and each part within the limit', () => {
    const clause = 'the whale swam on through the grey and heaving sea'
    const text = `${clause}, ${clause}; ${clause}, ${clause}, ${clause}, ${clause}; and then it dived.`
    const parts = speechParts(text, 120)
    expect(parts.every((p) => p.length <= 120)).toBe(true)
    expect(parts.join(' ')).toBe(text)
    expect(parts[0].endsWith(';')).toBe(true)
  })

  it('falls back to a comma, then a space, and never makes a scrap of a part', () => {
    const commas = Array.from({ length: 12 }, (_, i) => `part number ${i}`).join(', ') + '.'
    const parts = speechParts(commas, 60)
    expect(parts.every((p) => p.length <= 60)).toBe(true)
    expect(parts.slice(0, -1).every((p) => p.endsWith(','))).toBe(true)
    const words = Array.from({ length: 40 }, () => 'word').join(' ')
    expect(speechParts(words, 50).every((p) => p.length <= 50 && p.length > 50 / 3)).toBe(true)
    // A comma right at the start is not where to cut.
    expect(speechParts('Ah, ' + 'x'.repeat(10) + ' ' + 'y'.repeat(60), 50)[0]).not.toBe('Ah,')
  })
})

describe('moving through it (D-7)', () => {
  const q = aloudQueue([
    { id: 'c1', number: 1, title: 'One', scenes: [{ eventId: 'a', text: 'First. Second.', written: true }, { eventId: 'b', text: 'Third.\n\nFourth is here.', written: true }] },
    { id: 'c2', number: 2, title: 'Two', scenes: [{ eventId: 'c', text: 'Fifth.', written: true }] },
  ])
  const at = (i: number) => (q[i].kind === 'sentence' ? (q[i] as { text: string }).text : q[i].kind)

  it('starts at the chapter’s heading for its first scene, at the scene for a later one, at a selected sentence', () => {
    expect(at(startAt(q, 'a'))).toBe('heading')
    expect(at(startAt(q, 'b'))).toBe('Third.')
    expect(at(startAt(q, 'b', { paragraph: 1, offset: 3 }))).toBe('Fourth is here.')
    expect(at(startAt(q, 'a', { paragraph: 0, offset: 8 }))).toBe('Second.')
    expect(startAt(q, 'nowhere')).toBe(-1)
  })

  it('next and previous step over pauses, and stop at the ends', () => {
    const third = q.findIndex((x) => x.kind === 'sentence' && x.text === 'Third.')
    expect(q[third - 1].kind).toBe('pause')
    expect(at(previousSpoken(q, third))).toBe('Second.')
    expect(at(nextSpoken(q, third - 2))).toBe('Third.')
    expect(at(nextSpoken(q, q.findIndex((x) => x.kind === 'sentence' && x.text === 'Fourth is here.')))).toBe('heading')
    expect(nextSpoken(q, q.length - 1)).toBe(-1)
    expect(previousSpoken(q, 0)).toBe(0)
  })
})
