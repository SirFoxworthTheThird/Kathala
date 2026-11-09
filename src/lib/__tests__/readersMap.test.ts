import { describe, it, expect } from 'vitest'
import { readersMap } from '@/lib/readersMap'
import type { BetaReader, ProseNote, Reaction } from '@/types'

/** The reactions map (editorial-plan.md, R7): chapter by chapter, how readers reacted and where each stopped. */

const note = (eventId: string, name: string | undefined, reaction?: Reaction, kind: ProseNote['author']['kind'] = 'reader'): ProseNote => ({
  id: Math.random().toString(), worldId: 'w', eventId, quote: 'q', prefix: '', suffix: '', kind: 'note', author: { kind, ...(name ? { name } : {}) },
  body: '', status: 'open', replies: [], createdAt: 0, updatedAt: 0, ...(reaction ? { reaction } : {}),
})
const reader = (name: string, eventId: string, chapter: number | null): BetaReader => ({ name, readTo: { eventId, chapter, scene: '' }, notes: 0, sentAt: 0, receivedAt: 0 })

describe('the reactions map', () => {
  const chapters = [{ id: 'c2', number: 2, title: 'Gate' }, { id: 'c1', number: 1, title: 'Road' }]
  const events = [{ id: 's1', chapterId: 'c1' }, { id: 's2', chapterId: 'c1' }, { id: 's3', chapterId: 'c2' }]
  const notes = [
    note('s1', 'Ines', 'lost'), note('s2', 'Ines', 'lost'), note('s2', 'Tomas', 'loved'), note('s3', 'Tomas'),
    note('gone', 'Ines', 'slow'), note('s1', undefined, 'lost'), note('s1', 'Ana', 'lost', 'editor'),
  ]
  const readers = [reader('Ines', 's3', 2), reader('Tomas', 'gone', 1)]

  it('counts each chapter’s reactions by readers, in the book’s order, and where each reader stopped — by scene, or by chapter number with the scene gone', () => {
    expect(readersMap(chapters, events, notes, readers)).toEqual([
      { chapterId: 'c1', number: 1, title: 'Road', reactions: { lost: 2, loved: 1 }, plain: 0, stopped: ['Tomas'] },
      { chapterId: 'c2', number: 2, title: 'Gate', reactions: {}, plain: 1, stopped: ['Ines'] },
    ])
  })

  it('one reader’s alone', () => {
    expect(readersMap(chapters, events, notes, readers, 'Ines').map((r) => [r.reactions, r.plain, r.stopped])).toEqual([
      [{ lost: 2 }, 0, []],
      [{}, 0, ['Ines']],
    ])
  })
})
