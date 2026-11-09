import { describe, it, expect } from 'vitest'
import { proseCraftIssues } from '@/lib/continuity/proseCraft'
import type { ProseFinding, ProseReport } from '@/lib/proseChecks'

/** The prose pass in the Continuity Checker (editorial-plan.md, R6): a chapter's findings, counted, as a note. */

const f = (check: ProseFinding['check'], eventId: string, key: string): ProseFinding => ({ check, eventId, start: 0, end: 1, text: 'x', message: '', key })
const report = (byScene: Array<[string, ProseFinding[]]>, lengths: Array<[string, string]> = []): ProseReport =>
  ({ plain: new Map(), byScene: new Map(byScene), pets: [], chapterLengths: new Map(lengths) })

describe('the prose pass, chapter by chapter, in the checker', () => {
  const chapters = [{ id: 'c2', number: 2 }, { id: 'c1', number: 1 }, { id: 'c3', number: 3 }]
  const events = [{ id: 'a', chapterId: 'c1' }, { id: 'b', chapterId: 'c1' }, { id: 'c', chapterId: 'c2' }, { id: 'd', chapterId: 'c3' }]

  it('counts each chapter’s findings, in the book’s order, as a note to its chapter; a chapter with none says nothing', () => {
    const r = report([['a', [f('echo', 'a', 'k1'), f('echo', 'a', 'k2')]], ['b', [f('tag', 'b', 'k3')]], ['c', [f('pet', 'c', 'k4')]], ['d', []]])
    const issues = proseCraftIssues(r, chapters, events, 'w')
    expect(issues.map((i) => [i.message, i.severity, i.kind, i.category, i.navigatePath, i.eventId])).toEqual([
      ['Ch. 1: 2 echoes, 1 dialogue tag', 'note', 'prose-craft', 'prose', '/worlds/w/manuscript/c1', 'a'],
      ['Ch. 2: 1 use of a pet word', 'note', 'prose-craft', 'prose', '/worlds/w/manuscript/c2', 'c'],
    ])
  })

  it('leaves out what was dismissed; says a chapter’s length on its own', () => {
    const r = report([['a', [f('echo', 'a', 'k1')]]], [['c3', 'A long chapter: 9,000 words, against 3,000 usually in this book']])
    expect(proseCraftIssues(r, chapters, events, 'w', new Set(['k1'])).map((i) => [i.message, i.detail])).toEqual([
      ['Ch. 3: its length', 'A long chapter: 9,000 words, against 3,000 usually in this book'],
    ])
  })
})
