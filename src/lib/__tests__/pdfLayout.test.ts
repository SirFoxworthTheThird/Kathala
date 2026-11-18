import { describe, it, expect } from 'vitest'
import {
  layoutBook, layoutPrint, layoutSubmission, pageSpec, bookContent, linesOf, gutterFor, TRIM_SIZES, PAPER_SIZES,
  type LayoutFonts, type BookContent, type LaidPage, type Block,
} from '@/lib/pdfLayout'
import type { BuiltManuscript } from '@/lib/manuscriptCompile'

/*
  The PDF's layout decisions (issue #701), on a fixed-width stand-in for the
  fonts: every character half its size wide, and ✓ in the fallback face. So a
  line's capacity is known, and a paragraph's line count can be worked out.
*/

const fonts: LayoutFonts = {
  width: (text, _font, size) => [...text].length * size * 0.5,
  split: (text, style) => {
    const out: Array<{ text: string; font: 'roman' | 'italic' | 'fallback' }> = []
    for (const ch of text) {
      const font = ch === '✓' ? 'fallback' : style
      const last = out[out.length - 1]
      if (last && last.font === font) last.text += ch
      else out.push({ text: ch, font })
    }
    return out
  },
}

const textOf = (p: LaidPage) => p.lines.map((l) => l.pieces.map((q, i) => (i > 0 && q.space ? ' ' : '') + q.text).join(''))
const headText = (p: LaidPage) => p.head?.pieces.map((q, i) => (i > 0 && q.space ? ' ' : '') + q.text).join('') ?? null

/** A paragraph of `n` words "w1 w2 …", tagged so a line can be found. */
const para = (tag: string, n: number, first = false): Block => ({ kind: 'para', spans: [{ text: Array.from({ length: n }, (_, i) => `${tag}${i}`).join(' '), em: false }], first })

const book = (sections: Block[][], extra: Partial<BookContent> = {}): BookContent =>
  ({ title: 'The Salt Road', author: 'Anna Vell', sections: sections.map((blocks) => ({ blocks })), words: 1000, ...extra })

const chapter = (n: number, paras: number, words = 60): Block[] =>
  [{ kind: 'heading', lines: [`Chapter ${n}`] }, ...Array.from({ length: paras }, (_, i) => para(`c${n}p${i}w`, words, i === 0))]

describe('a print interior', () => {
  const spec = pageSpec('print', { title: 'The Salt Road', author: 'Anna Vell', trim: TRIM_SIZES.find((t) => t.id === '6x9') })

  it('starts every chapter on a right-hand page, with a blank page before it where it must', () => {
    // Chapters of different lengths, so some end on a right-hand page and need a blank.
    const laid = layoutBook(book([chapter(1, 3), chapter(2, 9), chapter(3, 2), chapter(4, 5)]), spec, fonts)
    const openings = laid.pages.filter((p) => p.role === 'opening')
    expect(openings).toHaveLength(4)
    for (const p of openings) expect(p.number % 2).toBe(1)
    const blanks = laid.pages.filter((p) => p.role === 'blank')
    expect(blanks.length).toBeGreaterThan(0)
    // A blank page is the one before an opening, and is empty: no text, no head, no number.
    for (const b of blanks) {
      expect(laid.pages[b.number]?.role).toBe('opening')
      expect(b.lines).toEqual([])
      expect(b.head).toBeNull()
      expect(b.folio).toBeNull()
    }
  })

  it('has running heads, the author on the left and the title on the right, and none on an opening or the title page', () => {
    const laid = layoutBook(book([chapter(1, 12), chapter(2, 12)]), spec, fonts)
    const body = laid.pages.filter((p) => p.role === 'body')
    expect(body.length).toBeGreaterThan(4)
    for (const p of body) expect(headText(p)).toBe(p.number % 2 === 1 ? 'The Salt Road' : 'Anna Vell')
    for (const p of laid.pages.filter((p) => p.role !== 'body')) expect(p.head).toBeNull()
    // Every page of text, and every opening, has its number; the title page and blanks have none.
    for (const p of laid.pages) expect(p.folio !== null).toBe(p.role === 'body' || p.role === 'opening')
    expect(laid.pages[0].role).toBe('title')
  })

  it('mirrors its margins: the wider at the spine, on the left of a right-hand page and the right of a left-hand one', () => {
    const laid = layoutBook(book([chapter(1, 20)]), spec, fonts)
    expect(spec.inner).toBeGreaterThan(spec.outer)
    const recto = laid.pages.find((p) => p.role === 'body' && p.number % 2 === 1)!
    const verso = laid.pages.find((p) => p.role === 'body' && p.number % 2 === 0)!
    // A justified line's start: the left margin, on each side.
    expect(Math.min(...recto.lines.map((l) => l.x))).toBeCloseTo(spec.inner)
    expect(Math.min(...verso.lines.map((l) => l.x))).toBeCloseTo(spec.outer)
  })

  it('offers the six trim sizes, each its own page size', () => {
    expect(TRIM_SIZES.map((t) => t.id)).toEqual(['5x8', '5.25x8', '5.5x8.5', '6x9', 'a5', 'b-format'])
    const sizes = (id: string) => { const t = TRIM_SIZES.find((x) => x.id === id)!; return [Math.round(t.width * 100) / 100, Math.round(t.height * 100) / 100] }
    expect(sizes('5x8')).toEqual([360, 576])
    expect(sizes('5.25x8')).toEqual([378, 576])
    expect(sizes('5.5x8.5')).toEqual([396, 612])
    expect(sizes('6x9')).toEqual([432, 648])
    expect(sizes('a5')).toEqual([419.53, 595.28])
    expect(sizes('b-format')).toEqual([365.67, 561.26])
    for (const trim of TRIM_SIZES) {
      const s = pageSpec('print', { title: 't', author: 'a', trim })
      expect([s.width, s.height]).toEqual([trim.width, trim.height])
    }
  })

  it('chooses its inside margin by the page count, laying out again where the count crosses a band', () => {
    expect(gutterFor(100)).toBeLessThan(gutterFor(200))
    expect(gutterFor(400)).toBeLessThan(gutterFor(600))
    // Past the 150-page band, so the margin is the wider one, which a first pass at no pages would not have chosen.
    const laid = layoutPrint(book([...Array.from({ length: 6 }, (_, i) => chapter(i + 1, 120, 80))]), { title: 't', author: 'a', trim: TRIM_SIZES[3] }, fonts)
    expect(laid.pages.length).toBeGreaterThan(150)
    expect(laid.spec.inner).toBe(gutterFor(laid.pages.length))
    expect(laid.spec.inner).toBeGreaterThan(gutterFor(0))
  })

  it('puts the copyright on the back of the title page and the dedication on a right-hand page, the first chapter after them on one too', () => {
    const laid = layoutBook(book([chapter(1, 2)], { front: { copyright: '© 2026 Anna Vell\nAll rights reserved.', dedication: 'For B.' } }), spec, fonts)
    expect(laid.pages.slice(0, 5).map((p) => p.role)).toEqual(['title', 'copyright', 'dedication', 'blank', 'opening'])
    expect(textOf(laid.pages[1])).toEqual(['© 2026 Anna Vell', 'All rights reserved.'])
    expect(textOf(laid.pages[2])).toEqual(['For B.'])
  })
})

describe('widows, orphans and stranded lines', () => {
  const spec = pageSpec('reading', { title: 't', author: 'a', paper: 'a4' })
  const L = linesOf(spec)
  const measureChars = Math.floor((spec.width - spec.inner - spec.outer) / (spec.size * 0.5))
  /** A paragraph of exactly `lines` lines: words of 9 characters, as many as fill each line. */
  const linesPara = (tag: string, lines: number): Block => {
    const perLine = Math.floor((measureChars + 1) / 10)
    return { kind: 'para', spans: [{ text: Array.from({ length: perLine * lines }, (_, i) => `${tag}${String(i).padStart(9 - tag.length, '0')}`).join(' '), em: false }], first: true }
  }
  /** Where a tag's lines are: [page, row-on-page] for each line that starts with it. */
  const where = (pages: LaidPage[], tag: string) => pages.flatMap((p) => textOf(p).flatMap((t, i) => (t.startsWith(tag) ? [[p.number, i]] : [])))

  it('a paragraph that would leave one line at the foot of a page goes to the next', () => {
    // No heading, so the text starts on the first row; fill all but one row, then a 4-line paragraph.
    const laid = layoutBook(book([[linesPara('fill', L - 1), linesPara('x', 4)]]), spec, fonts)
    const x = where(laid.pages, 'x')
    expect(x).toHaveLength(4)
    expect(new Set(x.map(([p]) => p)).size).toBe(1)
    expect(x[0][1]).toBe(0)
  })

  it('a paragraph that would carry one line to the next page carries two', () => {
    // Fill all but three rows, then a 4-line paragraph: three would fit and one go over; two go over instead.
    const laid = layoutBook(book([[linesPara('fill', L - 3), linesPara('x', 4)]]), spec, fonts)
    const x = where(laid.pages, 'x')
    const pages = x.map(([p]) => p)
    expect(pages.filter((p) => p === pages[0])).toHaveLength(2)
    expect(pages.filter((p) => p !== pages[0])).toHaveLength(2)
  })

  it('a paragraph that fits exactly stays whole', () => {
    const laid = layoutBook(book([[linesPara('fill', L - 4), linesPara('x', 4)]]), spec, fonts)
    expect(new Set(where(laid.pages, 'x').map(([p]) => p)).size).toBe(1)
  })

  it('a scene break is never the last thing on a page: it goes over with the lines after it', () => {
    // Room for the break's three rows and one more line: not enough to keep two lines with it.
    const laid = layoutBook(book([[linesPara('fill', L - 4), { kind: 'break' }, linesPara('x', 3)]]), spec, fonts)
    const breakAt = laid.pages.flatMap((p) => textOf(p).map((t, i) => [p.number, i, t] as const)).find(([, , t]) => t === '* * *')!
    const x = where(laid.pages, 'x')
    expect(breakAt[0]).toBe(x[0][0])
    // At the top of its page the space above it goes: the page break is the space.
    expect(breakAt[1]).toBe(0)
  })

  it('a scene break goes over with a paragraph that could leave only one line after it', () => {
    // Room for the break and two lines: a 3-line paragraph would split 2 and 1, or leave the break alone.
    const laid = layoutBook(book([[linesPara('fill', L - 5), { kind: 'break' }, linesPara('x', 3)]]), spec, fonts)
    const breakAt = laid.pages.flatMap((p) => textOf(p).map((t, i) => [p.number, i, t] as const)).find(([, , t]) => t === '* * *')!
    const x = where(laid.pages, 'x')
    expect(x.map(([p]) => p)).toEqual([breakAt[0], breakAt[0], breakAt[0]])
    expect(breakAt[1]).toBe(0)
    expect([laid.widows, laid.orphans, laid.stranded]).toEqual([0, 0, 0])
  })

  it('counts widows, orphans and stranded breaks from the pages as they close: none with two lines kept, some with one', () => {
    // A long run of paragraphs of 3 and 4 lines, with breaks: every kind of page foot comes up.
    const blocks: Block[] = []
    for (let i = 0; i < 60; i++) {
      blocks.push(linesPara(`p${i}x`, 3 + (i % 3)))
      if (i % 7 === 6) blocks.push({ kind: 'break' })
    }
    const kept = layoutBook(book([blocks]), spec, fonts)
    expect(kept.pages.length).toBeGreaterThan(4)
    expect([kept.widows, kept.orphans, kept.stranded]).toEqual([0, 0, 0])
    // The same with only one line kept: the counts are not zero, so they count.
    const loose = layoutBook(book([blocks]), { ...spec, keep: 1 }, fonts)
    expect(loose.widows).toBeGreaterThan(0)
    expect(loose.orphans).toBeGreaterThan(0)
    // And with nothing kept, a break that lands at the very foot of a page is left there, and counted.
    const bare = layoutBook(book([[linesPara('fill', L - 3), { kind: 'break' }, linesPara('x', 3)]]), { ...spec, keep: 0 }, fonts)
    expect(bare.stranded).toBe(1)
  })

  it('a chapter heading always has text under it on its page', () => {
    const laid = layoutBook(book([chapter(1, 1, 10)]), spec, fonts)
    const opening = laid.pages.find((p) => p.role === 'opening')!
    expect(textOf(opening)[0]).toBe('Chapter 1')
    expect(textOf(opening).length).toBeGreaterThan(1)
  })
})

describe('a reading copy', () => {
  it('is A4 or Letter, with a title page, each chapter on a new page (left or right), page numbers and no running heads', () => {
    for (const paper of ['a4', 'letter'] as const) {
      const spec = pageSpec('reading', { title: 'The Salt Road', author: 'Anna Vell', paper })
      expect([spec.width, spec.height]).toEqual([PAPER_SIZES[paper].width, PAPER_SIZES[paper].height])
      const laid = layoutBook(book([chapter(1, 3), chapter(2, 3), chapter(3, 3)]), spec, fonts)
      expect(textOf(laid.pages[0])).toEqual(['The Salt Road', 'Anna Vell'])
      const openings = laid.pages.filter((p) => p.role === 'opening')
      expect(openings).toHaveLength(3)
      // Not held to a right-hand page: an opening may fall on an even page, and there are no blanks.
      expect(laid.pages.some((p) => p.role === 'blank')).toBe(false)
      expect(laid.pages.every((p) => p.head === null)).toBe(true)
      expect(laid.pages.filter((p) => p.role !== 'title').every((p) => p.folio !== null)).toBe(true)
    }
  })

  it('sets italics in the italic face, and a character the face lacks in the fallback', () => {
    const spec = pageSpec('reading', { title: 't', author: 'a' })
    const b = book([[{ kind: 'para', spans: [{ text: 'She ticked ', em: false }, { text: 'Aalto', em: true }, { text: ' ✓.', em: false }], first: true }]])
    const pieces = layoutBook(b, spec, fonts).pages[1].lines[0].pieces
    expect(pieces.map((p) => [p.text, p.font])).toEqual([['She', 'roman'], ['ticked', 'roman'], ['Aalto', 'italic'], ['✓', 'fallback'], ['.', 'roman']])
    // The tick and its full stop are one word: no space between them.
    expect(pieces[4].space).toBe(false)
  })
})

describe('a submission', () => {
  const sub = { name: 'Anna Vell', contact: 'anna@example.invalid', paper: 'letter' as const }
  const spec = pageSpec('submission', { title: 'The Salt Road', author: 'Anna Vell', submission: sub })

  it('is set as the Word file is: 12 pt, double-spaced, one-inch margins, ragged right, "#" between scenes, END at the close', () => {
    expect([spec.size, spec.leading, spec.top, spec.inner, spec.outer, spec.justify, spec.sceneBreak]).toEqual([12, 24, 72, 72, 72, false, '#'])
    const m: BuiltManuscript = {
      totalWords: 20, totalScenes: 2, writtenScenes: 2,
      chapters: [{ id: 'c1', number: 1, title: 'The Ford', synopsis: '', wordCount: 20, wordGoal: null, writtenScenes: 2, scenes: [
        { eventId: 'e1', title: 'a', text: 'One two three.', wordCount: 3, written: true, status: 'draft' },
        { eventId: 'e2', title: 'b', text: 'Four five six.', wordCount: 3, written: true, status: 'draft' },
      ] }],
    }
    const laid = layoutSubmission(bookContent(m, { title: 'The Salt Road', submission: true, chapterHeading: 'chapter-words-title' }), sub, spec, fonts)
    const lines = laid.pages.flatMap(textOf)
    expect(lines).toContain('#')
    expect(lines[lines.length - 1]).toBe('END')
  })

  it('has its title page, then the header "Surname / TITLE / page" on every other page, from page 2', () => {
    const laid = layoutSubmission(book([chapter(1, 6), chapter(2, 6)]), sub, spec, fonts)
    const title = textOf(laid.pages[0])
    expect(title).toContain('Anna Vell')
    expect(title).toContain('about 1,000 words')
    expect(title).toContain('anna@example.invalid')
    expect(title).toContain('The Salt Road')
    expect(title).toContain('by Anna Vell')
    expect(laid.pages[0].head).toBeNull()
    for (const p of laid.pages.slice(1)) {
      expect(headText(p)).toBe(`Vell / THE SALT ROAD / ${p.number}`)
      expect(p.folio).toBeNull()
    }
    expect(laid.pages[1].number).toBe(2)
    // Each chapter on a new page, not held to a right-hand one.
    expect(laid.pages.some((p) => p.role === 'blank')).toBe(false)
  })
})

describe('the book, from the compiled manuscript', () => {
  it('takes the chapters and scenes the other exports take, with headings, breaks, italics and verse', () => {
    const m: BuiltManuscript = {
      totalWords: 30, totalScenes: 3, writtenScenes: 2,
      chapters: [
        { id: 'c1', number: 1, title: 'The Ford', synopsis: '', wordCount: 20, wordGoal: null, writtenScenes: 2, scenes: [
          { eventId: 'e1', title: 'a', text: 'It was _late_.\n\nThe ferry waited.', wordCount: 5, written: true, status: 'draft' },
          { eventId: 'e2', title: 'b', text: '  A line of song\n  and its answer', wordCount: 7, written: true, status: 'draft' },
          { eventId: 'e3', title: 'c', text: '', wordCount: 0, written: false, status: 'idea' },
        ] },
        { id: 'c2', number: 2, title: 'Empty', synopsis: '', wordCount: 0, wordGoal: null, writtenScenes: 0, scenes: [] },
      ],
    }
    const b = bookContent(m, { title: 'The Salt Road', author: 'Anna Vell', chapterHeading: 'chapter-words-title' })
    expect(b.sections).toHaveLength(1)
    expect(b.words).toBe(12)
    expect(b.sections[0].blocks.map((x) => x.kind)).toEqual(['heading', 'para', 'para', 'break', 'verse'])
    expect(b.sections[0].blocks[0]).toEqual({ kind: 'heading', lines: ['Chapter One', 'The Ford'] })
    expect(b.sections[0].blocks[1]).toMatchObject({ spans: [{ text: 'It was ', em: false }, { text: 'late', em: true }, { text: '.', em: false }], first: true })
    expect(b.sections[0].blocks[2]).toMatchObject({ first: false })
  })

  it('carries the back matter as sections of their own, each with its heading', () => {
    const m: BuiltManuscript = { totalWords: 1, totalScenes: 1, writtenScenes: 1, chapters: [
      { id: 'c1', number: 1, title: 'One', synopsis: '', wordCount: 1, wordGoal: null, writtenScenes: 1, scenes: [{ eventId: 'e', title: '', text: 'Hi.', wordCount: 1, written: true, status: 'draft' }] },
    ] }
    const b = bookContent(m, { back: [{ title: 'About the Author', text: 'Anna Vell lives by a river.' }, { title: 'Notes', text: '  ' }] })
    expect(b.sections).toHaveLength(2)
    expect(b.sections[1].blocks[0]).toEqual({ kind: 'heading', lines: ['About the Author'] })
  })
})
