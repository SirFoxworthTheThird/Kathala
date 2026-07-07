import { describe, it, expect } from 'vitest'
import { buildManuscript, compileManuscript } from '@/lib/manuscriptCompile'
import type { Chapter, WorldEvent, SceneText } from '@/types'

function chapter(id: string, number: number, title: string, synopsis = ''): Chapter {
  return { id, worldId: 'w', timelineId: 't1', number, title, synopsis, notes: '', createdAt: 0, updatedAt: 0 }
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
