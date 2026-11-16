import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/database'
import { createWorldFromManuscript } from '@/db/hooks/useManuscript'
import { parseManuscript } from '@/lib/manuscriptImport'
import { readDraftDocx } from '@/lib/docxDraft'
import { zipStore } from '@/lib/zip'
import { readFileSync } from 'fs'
import path from 'path'

const FIXTURES = path.join(__dirname, '../../../lib/__tests__/fixtures/docx/import')

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const SRC = [
  '# My Novel',
  '',
  '## Chapter 1: Beginnings',
  '',
  'The first paragraph of the book.',
  '',
  '* * *',
  '',
  'A second scene follows.',
  '',
  '## Chapter 2',
  '',
  'The story continues onward.',
].join('\n')

describe('createWorldFromManuscript', () => {
  it('creates a world, timeline, chapters, scene events and prose', async () => {
    const parsed = parseManuscript(SRC)
    const worldId = await createWorldFromManuscript(parsed, 'My Novel')

    const world = await db.worlds.get(worldId)
    expect(world?.name).toBe('My Novel')

    const timelines = await db.timelines.where('worldId').equals(worldId).toArray()
    expect(timelines).toHaveLength(1)
    expect(timelines[0].name).toBe('Main Timeline')

    const chapters = await db.chapters.where('worldId').equals(worldId).sortBy('number')
    expect(chapters.map((c) => [c.number, c.title])).toEqual([
      [1, 'Beginnings'],
      [2, ''],
    ])

    // Chapter 1 has two scene events in order, Chapter 2 has one.
    const ch1Events = await db.events.where('chapterId').equals(chapters[0].id).sortBy('sortOrder')
    expect(ch1Events.map((e) => e.title)).toEqual(['Scene 1', 'Scene 2'])

    const ch2Events = await db.events.where('chapterId').equals(chapters[1].id).toArray()
    expect(ch2Events).toHaveLength(1)

    // Prose is stored and word-counted.
    const firstText = await db.sceneTexts.where('eventId').equals(ch1Events[0].id).first()
    expect(firstText?.text).toBe('The first paragraph of the book.')
    expect(firstText?.wordCount).toBe(6)

    // Every scene event has prose; totals line up.
    const allScenes = await db.sceneTexts.where('worldId').equals(worldId).toArray()
    expect(allScenes).toHaveLength(3)
  })

  it('falls back to the parsed title, then a default, when no name is given', async () => {
    const worldId = await createWorldFromManuscript(parseManuscript(SRC), '   ')
    expect((await db.worlds.get(worldId))?.name).toBe('My Novel')

    const bare = await createWorldFromManuscript(parseManuscript('Just prose, no title.'), '')
    expect((await db.worlds.get(bare))?.name).toBe('Imported Manuscript')
  })

  it('imports a plain draft (no headings) as a single chapter', async () => {
    const worldId = await createWorldFromManuscript(
      parseManuscript('Scene A.\n\n***\n\nScene B.'),
      'Draft'
    )
    const chapters = await db.chapters.where('worldId').equals(worldId).toArray()
    expect(chapters).toHaveLength(1)
    const events = await db.events.where('chapterId').equals(chapters[0].id).sortBy('sortOrder')
    expect(events).toHaveLength(2)
  })

  it('names each scene from its ## title, and gives a scene with no prose none', async () => {
    const parsed = parseManuscript('# One\n\n## The quay\n\nThe ship came in.\n\n## Still to write\n\n# Two\n\nUntitled prose.')
    const worldId = await createWorldFromManuscript(parsed, 'W')
    const events = (await db.events.where('worldId').equals(worldId).toArray()).sort((a, b) => a.sortOrder - b.sortOrder)
    expect(events.map((e) => e.title).sort()).toEqual(['Scene 1', 'Still to write', 'The quay'])
    const quiet = events.find((e) => e.title === 'Still to write')!
    expect(await db.sceneTexts.where('eventId').equals(quiet.id).count()).toBe(0)
  })
})

// ── A Word draft (issue #697) ────────────────────────────────────────────────

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"'
const STYLES = `<w:styles ${NS}><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>`
const run = (t: string) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`
const para = (inner: string, style?: string) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}${inner}</w:p>`
const said = (id: string, text: string, paraId: string, date = '2026-03-04T10:00:00Z') =>
  `<w:comment w:id="${id}" w:author="Jane" w:date="${date}"><w:p w14:paraId="${paraId}">${run(text)}</w:p></w:comment>`

function wordDraft(body: string, comments: string, extended: string): Uint8Array {
  const enc = new TextEncoder()
  return zipStore([
    { name: 'word/document.xml', data: enc.encode(`<w:document ${NS}><w:body>${body}</w:body></w:document>`) },
    { name: 'word/styles.xml', data: enc.encode(STYLES) },
    { name: 'word/comments.xml', data: enc.encode(`<w:comments ${NS}>${comments}</w:comments>`) },
    { name: 'word/commentsExtended.xml', data: enc.encode(`<w15:commentsEx ${NS}>${extended}</w15:commentsEx>`) },
  ])
}

const notesOf = async (worldId: string) => db.proseNotes.where('worldId').equals(worldId).toArray()

describe('createWorldFromManuscript, from a Word draft', () => {
  it('gives each part to the notes of the chapter it begins, and no other chapter a note (D-3)', async () => {
    const d = await readDraftDocx(new Uint8Array(readFileSync(path.join(FIXTURES, '05-parts-and-chapters.docx'))))
    const worldId = await createWorldFromManuscript(d.manuscript, 'Frankenstein', d)
    const chapters = await db.chapters.where('worldId').equals(worldId).sortBy('number')
    expect(chapters.map((c) => c.title).slice(0, 4)).toEqual(['Letter I', 'Letter II', 'Letter III', 'Letter IV'])
    expect(chapters.map((c) => c.notes)).toEqual(chapters.map((_, k) => (k === 0 ? 'Begins Part One' : k === 3 ? 'Begins Part Two' : '')))
  })

  it('makes each comment a note on its words, with its reply, its date and whether it was done (D-2)', async () => {
    const bytes = wordDraft(
      para(`<w:commentRangeStart w:id="1"/>${run('The Long Book')}<w:commentRangeEnd w:id="1"/>`, 'Title') +
      para(`<w:commentRangeStart w:id="2"/>${run('Chapter 1: The Road')}<w:commentRangeEnd w:id="2"/>`, 'Heading1') +
      para(`${run('She walked on ')}<w:commentRangeStart w:id="3"/>${run('through the rain')}<w:commentRangeEnd w:id="3"/>${run('.')}`) +
      para(`${run('Then she slept.')}<w:r><w:commentReference w:id="5"/></w:r>${run(' At dawn she woke.')}`),
      said('1', 'A better title?', 'A1') + said('2', 'Too plain.', 'A2') + said('3', 'Which rain?', 'A3') +
      said('4', 'The autumn rain.', 'A4', '2026-03-05T09:00:00Z') + said('5', 'Why here?', 'A5'),
      '<w15:commentEx w15:paraId="A3" w15:done="1"/><w15:commentEx w15:paraId="A4" w15:paraIdParent="A3"/>',
    )
    const d = await readDraftDocx(bytes)
    const worldId = await createWorldFromManuscript(d.manuscript, d.manuscript.title ?? '', d)
    expect((await db.worlds.get(worldId))?.name).toBe('The Long Book')
    const [event] = await db.events.where('worldId').equals(worldId).toArray()
    const notes = await notesOf(worldId)
    const by = (body: string) => notes.find((n) => n.body === body)!
    expect(notes).toHaveLength(4)
    expect(notes.every((n) => n.eventId === event.id && n.author.kind === 'me')).toBe(true)

    expect(by('A better title?')).toMatchObject({ outside: 'title page', quote: 'The Long Book' })
    expect(by('Too plain.')).toMatchObject({ outside: 'heading', quote: 'The Road' })

    const rain = by('Which rain?')
    expect(rain).toMatchObject({ quote: 'through the rain', prefix: 'She walked on ', status: 'resolved' })
    expect(rain.outside).toBeUndefined()
    expect(rain.createdAt).toBe(Date.parse('2026-03-04T10:00:00Z'))
    expect(rain.replies.map((r) => [r.body, r.createdAt])).toEqual([['The autumn rain.', Date.parse('2026-03-05T09:00:00Z')]])
    // A note never resolved is open.
    expect(by('Too plain.').status).toBe('open')

    // A comment on a point is on the word it stands before.
    expect(by('Why here?').quote).toBe('At')
  })

  it('brings in all six comments of the tracked draft, each on words its scene holds', async () => {
    const d = await readDraftDocx(new Uint8Array(readFileSync(path.join(FIXTURES, '08-tracked-and-comments.docx'))))
    const worldId = await createWorldFromManuscript(d.manuscript, 'P', d)
    const notes = await notesOf(worldId)
    expect(notes).toHaveLength(6)
    for (const n of notes) {
      const text = (await db.sceneTexts.where('eventId').equals(n.eventId).first())!.text
      expect(text).toContain(n.prefix + n.quote)
    }
  })
})
