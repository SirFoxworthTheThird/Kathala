import { describe, it, expect } from 'vitest'
import { buildManuscript, compileManuscript, scenesForExport } from '@/lib/manuscriptCompile'
import type { Chapter, WorldEvent, SceneText } from '@/types'

function chapter(id: string, number: number, title: string, synopsis = ''): Chapter {
  return { id, worldId: 'w', timelineId: 't1', number, title, synopsis, notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }
}
function event(id: string, chapterId: string, sortOrder: number, title: string): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: 't1', title, description: '',
    locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], threadIds: [], involvedItemIds: [], tags: [], sortOrder,
    travelDays: null, inWorldTime: null, tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false,
    createdAt: 0, updatedAt: 0,
  }
}
function scene(text: string): Pick<SceneText, 'text' | 'wordCount'> {
  return { text, wordCount: text.trim() ? text.trim().split(/\s+/).length : 0 }
}

const chapters = [chapter('c2', 2, 'The Road'), chapter('c1', 1, 'A Beginning', 'Our hero sets out.')]
const events = [
  event('e2', 'c1', 1, 'Second scene'),
  event('e1', 'c1', 0, 'First scene'),
  event('e3', 'c2', 0, 'On the road'),
  event('e4', 'c2', 1, 'Empty scene'),
]
const texts = new Map<string, Pick<SceneText, 'text' | 'wordCount'>>([
  ['e1', scene('The sun rose over the hills.')], // 6 words
  ['e2', scene('She packed her bags.')],         // 4 words
  ['e3', scene('The road was long.')],            // 4 words
  // e4 has no prose
])

describe('buildManuscript', () => {
  it('orders chapters by number and scenes by sortOrder, with totals', () => {
    const m = buildManuscript({ chapters, events, sceneTextByEvent: texts })
    expect(m.chapters.map((c) => c.number)).toEqual([1, 2])
    expect(m.chapters[0].scenes.map((s) => s.eventId)).toEqual(['e1', 'e2'])
    expect(m.totalWords).toBe(14)
    expect(m.chapters[0].wordCount).toBe(10)
    expect(m.totalScenes).toBe(4)
    expect(m.writtenScenes).toBe(3)
    expect(m.chapters[1].writtenScenes).toBe(1)
  })

  it('marks scenes without prose as not written', () => {
    const m = buildManuscript({ chapters, events, sceneTextByEvent: texts })
    const empty = m.chapters[1].scenes.find((s) => s.eventId === 'e4')
    expect(empty?.written).toBe(false)
    expect(empty?.wordCount).toBe(0)
  })

  it('carries per-chapter word goals through', () => {
    const m = buildManuscript({
      chapters: [{ ...chapter('c1', 1, 'A'), wordGoal: 2000 }, chapter('c2', 2, 'B')],
      events: [],
      sceneTextByEvent: new Map(),
    })
    expect(m.chapters[0].wordGoal).toBe(2000)
    expect(m.chapters[1].wordGoal).toBeNull()
  })
})

describe('compileManuscript', () => {
  const m = buildManuscript({ chapters, events, sceneTextByEvent: texts })

  it('markdown: chapter headings, scene separators, written prose only', () => {
    const out = compileManuscript(m, 'markdown')
    expect(out).toContain('# Ch. 1 — A Beginning')
    expect(out).toContain('# Ch. 2 — The Road')
    expect(out).toContain('The sun rose over the hills.')
    expect(out).toContain('* * *') // between e1 and e2
    expect(out).not.toContain('[No prose yet]') // e4 skipped by default
  })

  it('onlyWritten:false includes empty-scene placeholders', () => {
    const out = compileManuscript(m, 'markdown', { onlyWritten: false })
    expect(out).toContain('[No prose yet]')
  })

  it('chapterTitles:false omits headings', () => {
    const out = compileManuscript(m, 'markdown', { chapterTitles: false })
    expect(out).not.toContain('# Ch.')
    expect(out).toContain('The road was long.')
  })

  it('html: wraps a document with headings, paragraphs and scene breaks', () => {
    const out = compileManuscript(m, 'html', { title: 'My Book' })
    expect(out.startsWith('<!doctype html>')).toBe(true)
    expect(out).toContain('<title>My Book</title>')
    expect(out).toContain('<h2>Ch. 1 — A Beginning</h2>')
    expect(out).toContain('<p>The sun rose over the hills.</p>')
    expect(out).toContain('scene-break')
  })

  it('html escapes prose', () => {
    const m2 = buildManuscript({
      chapters: [chapter('c1', 1, 'T')],
      events: [event('e1', 'c1', 0, 'S')],
      sceneTextByEvent: new Map([['e1', scene('A <b>bold</b> & risky move')]]),
    })
    const out = compileManuscript(m2, 'html')
    expect(out).toContain('&lt;b&gt;bold&lt;/b&gt; &amp; risky')
    expect(out).not.toContain('<b>bold</b>')
  })

  it('text: plain chapter labels, no markdown hashes', () => {
    const out = compileManuscript(m, 'text')
    expect(out).toContain('Ch. 1 — A Beginning')
    expect(out).not.toContain('# Ch.')
  })

  it('skips chapters with no written scenes when onlyWritten', () => {
    const m3 = buildManuscript({
      chapters: [chapter('c1', 1, 'Written'), chapter('c2', 2, 'Blank')],
      events: [event('e1', 'c1', 0, 'S'), event('e2', 'c2', 0, 'S')],
      sceneTextByEvent: new Map([['e1', scene('Some words here.')]]),
    })
    const out = compileManuscript(m3, 'markdown')
    expect(out).toContain('# Ch. 1 — Written')
    expect(out).not.toContain('# Ch. 2 — Blank')
  })
})

/**
 * Gutenberg's `_italics_` reach the compiled formats.
 *
 * Every book in the Library writes its italics that way, and all three of these
 * printed the underscores. Markdown is the exception on purpose: `_like this_`
 * *is* markdown, so converting it would be translating a language into itself.
 */
describe('underscored emphasis', () => {
  const emphatic = [
    event('x1', 'x', 0, 'Only scene'),
  ]
  const emphaticChapters = [chapter('x', 1, 'Italics')]
  const emphaticTexts = new Map<string, Pick<SceneText, 'text' | 'wordCount'>>([
    ['x1', scene('She read the _Times_ & wept over <it>.')],
  ])
  const built = () => buildManuscript({
    chapters: emphaticChapters, events: emphatic, sceneTextByEvent: emphaticTexts,
  })

  it('becomes <em> in HTML, with the surrounding prose still escaped', () => {
    const html = compileManuscript(built(), 'html')
    expect(html).toContain('<em>Times</em>')
    expect(html).not.toContain('_Times_')
    // The escaper still ran on everything around it.
    expect(html).toContain('&amp;')
    expect(html).toContain('&lt;it&gt;')
  })

  it('stays underscored in Markdown, which is the form it is already in', () => {
    const md = compileManuscript(built(), 'markdown')
    expect(md).toContain('_Times_')
    expect(md).not.toContain('<em>')
  })

  it('stays underscored in plain text, which has no other way to say it', () => {
    expect(compileManuscript(built(), 'text')).toContain('_Times_')
  })
})

/**
 * Sending out a draft without the scenes that are not ready.
 *
 * The filter is shared with `manuscriptExport.ts` — DOCX and EPUB compile
 * separately — because a rule written twice disagrees with itself the first
 * time one side gains an option.
 */
describe('scenesForExport', () => {
  const scene = (id: string, status: string, written = true) =>
    ({ eventId: id, title: id, text: written ? 'Words.' : '', wordCount: written ? 1 : 0, written, status }) as never

  const all = [
    scene('idea', 'idea'),
    scene('draft', 'draft'),
    scene('revised', 'revised'),
    scene('final', 'final'),
  ]
  const ids = (s: readonly { eventId: string }[]) => s.map((x) => x.eventId)

  it('takes everything when no stage is asked for', () => {
    // The default, and what every export did before this option existed.
    expect(ids(scenesForExport(all, {}))).toEqual(['idea', 'draft', 'revised', 'final'])
  })

  it('takes the stage asked for and everything past it', () => {
    expect(ids(scenesForExport(all, { minStatus: 'revised' }))).toEqual(['revised', 'final'])
    expect(ids(scenesForExport(all, { minStatus: 'final' }))).toEqual(['final'])
  })

  it('composes with onlyWritten rather than replacing it', () => {
    /*
      An unwritten scene marked final is still unwritten, and a submission
      draft must not carry "[No prose yet]" under a heading. Both halves
      asserted: the unwritten final is dropped by one rule, the written draft
      by the other.
    */
    const mixed = [scene('unwritten-final', 'final', false), scene('written-draft', 'draft')]
    expect(ids(scenesForExport(mixed, { onlyWritten: true, minStatus: 'final' }))).toEqual([])
    expect(ids(scenesForExport(mixed, { onlyWritten: false, minStatus: 'final' }))).toEqual(['unwritten-final'])
    expect(ids(scenesForExport(mixed, { onlyWritten: true }))).toEqual(['written-draft'])
  })
})

describe('compiling with a status threshold', () => {
  it('leaves out the scenes that are not ready, and the chapters left empty', () => {
    const m = {
      chapters: [
        {
          id: 'c1', number: 1, title: 'Ready', synopsis: '', wordCount: 2, wordGoal: null, writtenScenes: 2,
          scenes: [
            { eventId: 'e1', title: 'Done', text: 'Polished prose.', wordCount: 2, written: true, status: 'final' },
            { eventId: 'e2', title: 'Rough', text: 'Rough prose.', wordCount: 2, written: true, status: 'draft' },
          ],
        },
        {
          id: 'c2', number: 2, title: 'All rough', synopsis: '', wordCount: 2, wordGoal: null, writtenScenes: 1,
          scenes: [
            { eventId: 'e3', title: 'Also rough', text: 'More rough prose.', wordCount: 3, written: true, status: 'draft' },
          ],
        },
      ],
      totalWords: 7, totalScenes: 3, writtenScenes: 3,
    } as never

    const finalOnly = compileManuscript(m, 'markdown', { minStatus: 'final' })
    expect(finalOnly).toContain('Polished prose.')
    expect(finalOnly).not.toContain('Rough prose.')
    // A chapter with nothing left in it does not print a bare heading.
    expect(finalOnly).not.toContain('All rough')

    // The pair: without the threshold, the same manuscript carries all three.
    const everything = compileManuscript(m, 'markdown', {})
    expect(everything).toContain('Polished prose.')
    expect(everything).toContain('Rough prose.')
    expect(everything).toContain('All rough')
  })
})
