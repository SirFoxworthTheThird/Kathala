import { describe, it, expect } from 'vitest'
import { composeDraft, readDraft, proseStart, lineEndAt, draftBook, sceneRegion, sceneHeaderLine, HEADING_PREFIX, type DraftChapter } from '@/lib/draftDocument'
import type { Chapter, SceneText, WorldEvent } from '@/types'

const book: DraftChapter[] = [
  { id: 'c1', title: 'The Arrival', scenes: [
    { id: 's1', title: 'At the quay', text: 'The ship came in.\n\nNobody waved.' },
    { id: 's2', title: 'Empty so far', text: '' },
    { id: 's3', title: 'The letter', text: 'Dear Maximilian,\nwait and hope.' },
  ] },
  { id: 'c2', title: '', scenes: [] },
  { id: 'c3', title: 'The Return', scenes: [
    { id: 's4', title: 'Last', text: 'The end.' },
  ] },
]

const scenesOf = (chapters: DraftChapter[]) => chapters.flatMap((c) => c.scenes)

describe('composeDraft', () => {
  it('writes chapters and scenes as headings, a blank line between every part', () => {
    const { text } = composeDraft(book.slice(0, 1))
    expect(text).toBe([
      '# The Arrival',
      '## At the quay',
      'The ship came in.\n\nNobody waved.',
      '## Empty so far',
      '## The letter',
      'Dear Maximilian,\nwait and hope.',
    ].join('\n\n'))
  })

  it('says where every heading starts, in order, with its record', () => {
    const { text, headings } = composeDraft(book)
    expect(headings.map((h) => [h.id, h.kind])).toEqual([
      ['c1', 'chapter'], ['s1', 'scene'], ['s2', 'scene'], ['s3', 'scene'], ['c2', 'chapter'], ['c3', 'chapter'], ['s4', 'scene'],
    ])
    for (const h of headings) {
      expect(h.pos === 0 || text[h.pos - 1] === '\n').toBe(true)
      expect(text.startsWith(HEADING_PREFIX[h.kind], h.pos)).toBe(true)
    }
  })

  it('shows a title with a line break in it on one line', () => {
    const { text, headings } = composeDraft([{ id: 'c', title: 'Two\nlines', scenes: [] }])
    expect(text).toBe('# Two lines')
    expect(readDraft(text, headings)[0].title).toBe('Two lines')
  })
})

describe('readDraft', () => {
  it('gives back every title and every scene’s prose exactly', () => {
    const { text, headings } = composeDraft(book)
    const read = readDraft(text, headings)
    expect(read.filter((s) => s.kind === 'scene').map((s) => [s.id, s.title, s.text]))
      .toEqual(scenesOf(book).map((s) => [s.id, s.title, s.text]))
    expect(read.filter((s) => s.kind === 'chapter').map((s) => s.title)).toEqual(['The Arrival', '', 'The Return'])
  })

  it('keeps prose that starts or ends with line breaks, and a prose line that looks like a heading', () => {
    const odd: DraftChapter[] = [{ id: 'c', title: 'C', scenes: [
      { id: 'a', title: 'A', text: '\n\nIndented by two blank lines' },
      { id: 'b', title: 'B', text: 'Trailing\n\n\n' },
      { id: 'd', title: 'D', text: '## Not a heading\n# nor this' },
      { id: 'e', title: 'E', text: '\n' },
    ] }]
    const { text, headings } = composeDraft(odd)
    expect(readDraft(text, headings).slice(1).map((s) => s.text)).toEqual(odd[0].scenes.map((s) => s.text))
  })

  it('round-trips any prose: a thousand generated scenes', () => {
    // A seeded generator, so a failure names the same case every run.
    let seed = 7
    const rand = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31 }
    const pieces = ['word', ' ', '\n', '\n\n', '## ', '# ', '“', 'é', '']
    const texts = Array.from({ length: 1000 }, () =>
      Array.from({ length: Math.floor(rand() * 12) }, () => pieces[Math.floor(rand() * pieces.length)]).join(''))
    const chapters: DraftChapter[] = Array.from({ length: 50 }, (_, c) => ({
      id: `c${c}`, title: `Chapter ${c}`,
      scenes: texts.slice(c * 20, c * 20 + 20).map((t, i) => ({ id: `c${c}s${i}`, title: `S${i}`, text: t })),
    }))
    const { text, headings } = composeDraft(chapters)
    expect(readDraft(text, headings).filter((s) => s.kind === 'scene').map((s) => s.text)).toEqual(texts)
  })

  it('tolerates the blank line either side of a heading being deleted', () => {
    const { text, headings } = composeDraft(book.slice(0, 1))
    // Delete the blank line under "## At the quay" and the one above "## Empty so far".
    const underQuay = text.indexOf('## At the quay') + '## At the quay'.length + 1
    const aboveEmpty = headings[2].pos - 1
    const edited = text.slice(0, underQuay) + text.slice(underQuay + 1, aboveEmpty - 1) + text.slice(aboveEmpty)
    const shift = (pos: number) => pos - (pos > underQuay ? 1 : 0) - (pos >= aboveEmpty ? 1 : 0)
    const moved = headings.map((h) => ({ ...h, pos: shift(h.pos) }))
    expect(edited).toContain('## At the quay\nThe ship came in.\n\nNobody waved.\n## Empty so far')
    expect(readDraft(edited, moved)[1].text).toBe('The ship came in.\n\nNobody waved.')
  })

  it('keeps a blank line the writer added as prose', () => {
    const { text, headings } = composeDraft(book.slice(0, 1))
    const at = headings[1].pos + '## At the quay'.length
    const edited = text.slice(0, at) + '\n' + text.slice(at)
    const moved = headings.map((h) => ({ ...h, pos: h.pos > at ? h.pos + 1 : h.pos }))
    expect(readDraft(edited, moved)[1].text).toBe('\nThe ship came in.\n\nNobody waved.')
  })
})

describe('proseStart', () => {
  const { text, headings } = composeDraft(book)
  it('is the start of the prose under a scene that has some', () => {
    expect(text.slice(proseStart(text, headings, 1)!)).toMatch(/^The ship came in\./)
  })
  it('is the blank line under a scene with none, never the next heading', () => {
    const at = proseStart(text, headings, 2)!
    expect(at).toBe(lineEndAt(text, headings[2].pos) + 1)
    expect(at).toBeLessThan(headings[3].pos)
  })
  it('is null for a scene with no prose at the very end of the book', () => {
    const last = composeDraft([{ id: 'c', title: 'C', scenes: [{ id: 's', title: 'S', text: '' }] }])
    expect(proseStart(last.text, last.headings, 1)).toBeNull()
    const typed = last.text + '\n\n'
    expect(proseStart(typed, last.headings, 1)).toBe(typed.length)
  })
})

describe('draftBook', () => {
  const chapters = [
    { id: 'c2', number: 2, title: 'Two' }, { id: 'c1', number: 1, title: 'One' },
  ] as Chapter[]
  const events = [
    { id: 'b', chapterId: 'c1', title: 'Second', sortOrder: 2 },
    { id: 'a', chapterId: 'c1', title: 'First', sortOrder: 1 },
    { id: 'z', chapterId: 'c2', title: 'Only', sortOrder: 1 },
  ] as WorldEvent[]
  const texts = [{ eventId: 'a', text: 'Prose of the first.' }] as SceneText[]

  it('orders chapters by number and scenes by position, with each scene’s prose', () => {
    expect(draftBook(chapters, events, texts)).toEqual([
      { id: 'c1', title: 'One', scenes: [{ id: 'a', title: 'First', text: 'Prose of the first.' }, { id: 'b', title: 'Second', text: '' }] },
      { id: 'c2', title: 'Two', scenes: [{ id: 'z', title: 'Only', text: '' }] },
    ])
  })

  it('is nothing at all until every query has answered — never a book with its prose missing', () => {
    expect(draftBook(chapters, events, undefined)).toBeNull()
    expect(draftBook(chapters, undefined, texts)).toBeNull()
    expect(draftBook(undefined, events, texts)).toBeNull()
    // An answer of "no prose yet" is an answer.
    expect(draftBook(chapters, events, [])![0].scenes[0].text).toBe('')
  })
})

describe('the header line', () => {
  const withHeaders: DraftChapter[] = [
    { id: 'c1', title: 'Arrival', scenes: [
      { id: 's1', title: 'The quay', text: 'The ship came in.', header: '[#The Quay @@Edmond]' },
      { id: 's2', title: 'The letter', text: '[#Not a header, a note in the prose]\n\nWait.' },
      { id: 's3', title: 'Empty', text: '', header: '[@@Mercédès]' },
    ] },
  ]

  it('is composed as the first line under a scene’s title, and read back out of its prose', () => {
    const { text, headings, headers } = composeDraft(withHeaders)
    expect(text).toBe('# Arrival\n\n## The quay\n\n[#The Quay @@Edmond]\n\nThe ship came in.\n\n## The letter\n\n[#Not a header, a note in the prose]\n\nWait.\n\n## Empty\n\n[@@Mercédès]')
    expect(headers).toEqual(['s1', 's3'])
    const read = readDraft(text, headings, new Set(headers))
    expect(read.map((s) => [s.id, s.header, s.text])).toEqual([
      ['c1', null, ''],
      ['s1', '[#The Quay @@Edmond]', 'The ship came in.'],
      // Prose that starts with a bracket, in a scene that shows no header line, is prose.
      ['s2', null, '[#Not a header, a note in the prose]\n\nWait.'],
      ['s3', '[@@Mercédès]', ''],
    ])
  })

  it('without the scenes that show one, the same text is all prose', () => {
    const { text, headings } = composeDraft(withHeaders)
    expect(readDraft(text, headings)[1].text).toBe('[#The Quay @@Edmond]\n\nThe ship came in.')
  })

  it('a line that no longer reads as a header is prose again, as in a card', () => {
    const { text, headings, headers } = composeDraft(withHeaders)
    const broken = text.replace('[#The Quay @@Edmond]', '[]')
    const shift = broken.length - text.length
    const moved = headings.map((h, i) => (i > 1 ? { ...h, pos: h.pos + shift } : h))
    const region = sceneRegion(broken, moved, 1, new Set(headers))
    expect([region.header, region.text]).toEqual([null, '[]\n\nThe ship came in.'])
  })

  it('blank lines typed above it are not prose, and the prose starts under it', () => {
    const { text, headings, headers } = composeDraft(withHeaders)
    const pushed = text.replace('## The quay\n\n', '## The quay\n\n\n\n')
    const at = readDraft(pushed, headings.map((h, i) => (i > 1 ? { ...h, pos: h.pos + 2 } : h)), new Set(headers))
    expect([at[1].header, at[1].text]).toEqual(['[#The Quay @@Edmond]', 'The ship came in.'])
    const region = sceneRegion(pushed, headings, 1, new Set(headers))
    expect(pushed.slice(region.headerFrom!, region.headerFrom! + 5)).toBe('[#The')
    expect(pushed.slice(region.bodyFrom, region.bodyFrom + 8)).toBe('The ship')
  })

  it('reading the line alone agrees with reading the whole scene', () => {
    const { text, headings, headers } = composeDraft(withHeaders)
    const set = new Set(headers)
    for (let i = 0; i < headings.length; i++) {
      const line = sceneHeaderLine(text, headings, i, set)
      const region = headings[i].kind === 'scene' ? sceneRegion(text, headings, i, set) : null
      expect(line && [line.header, line.from], headings[i].id).toEqual(region?.header ? [region.header, region.headerFrom] : null)
    }
  })

  it('the caret goes under it, to the prose', () => {
    const { text, headings, headers } = composeDraft(withHeaders)
    const set = new Set(headers)
    expect(text.slice(proseStart(text, headings, 1, set)!).startsWith('The ship came in.')).toBe(true)
    // A scene with a header and no prose, at the end of the book: nothing under it to go to.
    expect(proseStart(text, headings, 3, set)).toBeNull()
  })

  it('draftBook draws each scene’s header from its records, and leaves it off where there is none', () => {
    const events = [
      { id: 'e1', chapterId: 'c1', title: 'A', sortOrder: 1, involvedCharacterIds: ['x'] },
      { id: 'e2', chapterId: 'c1', title: 'B', sortOrder: 2, involvedCharacterIds: [] },
    ] as unknown as WorldEvent[]
    const chapters = [{ id: 'c1', number: 1, title: 'One' }] as unknown as Chapter[]
    const out = draftBook(chapters, events, [], (e) => (e.involvedCharacterIds.length ? '[@@X]' : ''))
    expect(out![0].scenes).toEqual([{ id: 'e1', title: 'A', text: '', header: '[@@X]' }, { id: 'e2', title: 'B', text: '' }])
  })
})
