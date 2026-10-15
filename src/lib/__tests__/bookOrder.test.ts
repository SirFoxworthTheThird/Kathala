import { describe, it, expect } from 'vitest'
import { bookPosition, chapterNumbers, inBookOrder, positionLookup, positionOf } from '@/lib/bookOrder'

const chapters = [{ id: 'c1', number: 1 }, { id: 'c2', number: 2 }, { id: 'c0', number: 0 }]
const scenes = [
  { id: 'b', chapterId: 'c2', sortOrder: 0 },
  { id: 'a', chapterId: 'c1', sortOrder: 5 },
  { id: 'p', chapterId: 'c0', sortOrder: 1 },
  { id: 'a2', chapterId: 'c1', sortOrder: 12_000 },
]

describe('book order', () => {
  it('is chapter number, then place in the chapter, across every timeline', () => {
    expect(bookPosition(3, 0)).toBe(3)
    expect(bookPosition(3, 250)).toBeCloseTo(3.00025)
    const numbers = chapterNumbers(chapters)
    expect([...scenes].sort(inBookOrder(numbers)).map((s) => s.id)).toEqual(['p', 'a', 'a2', 'b'])
  })

  it('keeps a long chapter in order, where the old formula put scene 12,000 of chapter 1 after chapter 2', () => {
    const numbers = chapterNumbers(chapters)
    const long = scenes.find((s) => s.id === 'a2')!
    const next = scenes.find((s) => s.id === 'b')!
    expect(positionOf(long, numbers)).toBeLessThan(positionOf(next, numbers))
    // What the hand-written formula gave, for the record of why it went.
    expect(1 * 10_000 + 12_000).toBeGreaterThan(2 * 10_000 + 0)
  })

  it('looks a scene up by id: -1 for one that is not there, chapter 0 for one whose chapter is gone', () => {
    const at = positionLookup([...scenes, { id: 'lost', chapterId: 'gone', sortOrder: 7 }], chapters)
    expect(at('b')).toBe(2)
    expect(at('nope')).toBe(-1)
    expect(at('lost')).toBeCloseTo(0.000007)
  })
})

/*
  Every scene ordering goes through bookOrder.ts. There were four formulas
  in about twenty files, and two of them were never comparable with each other
  (see bookOrder.ts); a fifth will not grow back unnoticed. The historical Dexie
  upgrade functions in database.ts are exempt: an old version's migration must
  keep computing what it computed (CLAUDE.md, "Never remove old .version(N)
  blocks").
*/
describe('nothing else computes a scene position', () => {
  const sources = import.meta.glob(['../../**/*.ts', '../../**/*.tsx', '!../../**/__tests__/**'], {
    eager: true, query: '?raw', import: 'default',
  }) as Record<string, string>
  const files = Object.keys(sources)
  const exempt = new Set(['../bookOrder.ts', '../../db/database.ts'])
  // A chapter number scaled up, or a sort order scaled down, in code rather than a comment.
  const formula = /(\*\s*[\d_]{4,}\s*\+[^\n;]*sortOrder)|(sortOrder\s*\/\s*[\d_]{4,})|(number[^\n;]{0,40}\*\s*[\d_]{4,}\s*\+)/

  it('finds the rule’s files', () => {
    expect(files.length).toBeGreaterThan(100)
    expect(files).toContain('../bookOrder.ts')
    expect(files).toContain('../../components/TimeCursor.tsx')
  })

  it('in any file but bookOrder.ts', () => {
    const offenders: string[] = []
    for (const [f, text] of Object.entries(sources)) {
      if (exempt.has(f)) continue
      // Block comments blanked, line breaks kept, so the line numbers still point at the file.
      const source = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
      source.split('\n').forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '')
        if (formula.test(code)) offenders.push(`${f}:${i + 1}: ${line.trim()}`)
      })
    }
    expect(offenders).toEqual([])
  })

  it('and the rule would catch one', () => {
    expect(formula.test('const at = (n.get(e.chapterId) ?? 0) * 10_000 + e.sortOrder')).toBe(true)
    expect(formula.test('return chapNum + ev.sortOrder / 1_000_000')).toBe(true)
    expect(formula.test('const at = bookPosition(n.get(e.chapterId) ?? 0, e.sortOrder)')).toBe(false)
  })
})
