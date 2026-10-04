import { describe, it, expect } from 'vitest'
import { chapterTimelines, isReadersBook } from '../readersBook'
import type { Timeline } from '@/types'

const timeline = (id: string, name: string): Timeline => ({
  id, worldId: 'w', name, description: '', color: '#000', createdAt: 0,
} as Timeline)

describe('isReadersBook', () => {
  it('is one book only for a reader, and only where there is more than one timeline', () => {
    expect(isReadersBook(true, 2)).toBe(true)
    expect(isReadersBook(true, 1)).toBe(false)
    expect(isReadersBook(false, 2)).toBe(false)
  })
})

describe('chapterTimelines', () => {
  it('names each chapter’s own timeline', () => {
    const present = timeline('t1', 'The Homecoming Present')
    const wanderings = timeline('t2', 'The Wanderings Recounted')
    const out = chapterTimelines(
      [{ id: 'c8', timelineId: 't1' }, { id: 'c9', timelineId: 't2' }, { id: 'c13', timelineId: 't1' }],
      [present, wanderings],
    )
    expect(out.get('c8')).toBe(present)
    expect(out.get('c9')).toBe(wanderings)
    expect(out.get('c13')).toBe(present)
  })

  it('leaves out a chapter whose timeline is not there', () => {
    const out = chapterTimelines([{ id: 'c1', timelineId: 'gone' }], [timeline('t1', 'One')])
    expect(out.has('c1')).toBe(false)
  })
})
