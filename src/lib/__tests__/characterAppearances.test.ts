import { describe, it, expect } from 'vitest'
import { computeCharacterAppearances } from '@/lib/characterAppearances'
import type { WorldEvent, Chapter } from '@/types'

function chapter(id: string, number: number, title = ''): Chapter {
  return { id, worldId: 'w', timelineId: 't1', number, title, synopsis: '', notes: '', createdAt: 0, updatedAt: 0 }
}
function event(id: string, chapterId: string, sortOrder: number, extra: Partial<WorldEvent> = {}): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: 't1', title: id, description: '',
    locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], threadIds: [], involvedItemIds: [], tags: [], sortOrder,
    travelDays: null, inWorldTime: null, tension: null, structureBeat: null,
    status: 'draft', povCharacterId: null, isFlashback: false, createdAt: 0, updatedAt: 0, ...extra,
  }
}

const chapters = [chapter('c1', 1, 'One'), chapter('c2', 2, 'Two'), chapter('c3', 3, 'Three')]

describe('computeCharacterAppearances', () => {
  it('separates present (cast/POV) from mentioned, in narrative order', () => {
    const events = [
      event('e1', 'c1', 0, { involvedCharacterIds: ['kael'] }),
      event('e2', 'c2', 0, { mentionedCharacterIds: ['kael'] }),
      event('e3', 'c3', 0, { povCharacterId: 'kael' }),
    ]
    const { present, mentioned } = computeCharacterAppearances({ characterId: 'kael', events, chapters })
    expect(present.map((a) => a.eventId)).toEqual(['e1', 'e3'])
    expect(mentioned.map((a) => a.eventId)).toEqual(['e2'])
    expect(present[1].isPov).toBe(true)
  })

  it('counts a character as present (not mentioned) when both apply in one event', () => {
    const events = [event('e1', 'c1', 0, { involvedCharacterIds: ['kael'], mentionedCharacterIds: ['kael'] })]
    const { present, mentioned } = computeCharacterAppearances({ characterId: 'kael', events, chapters })
    expect(present).toHaveLength(1)
    expect(mentioned).toHaveLength(0)
  })

  it('carries chapter metadata and flashback flag', () => {
    const events = [event('e1', 'c2', 0, { mentionedCharacterIds: ['mira'], isFlashback: true })]
    const { mentioned } = computeCharacterAppearances({ characterId: 'mira', events, chapters })
    expect(mentioned[0]).toMatchObject({ chapterNumber: 2, chapterTitle: 'Two', isFlashback: true })
  })

  it('returns empty lists for an uninvolved character', () => {
    const events = [event('e1', 'c1', 0, { involvedCharacterIds: ['kael'] })]
    const { present, mentioned } = computeCharacterAppearances({ characterId: 'nobody', events, chapters })
    expect(present).toEqual([])
    expect(mentioned).toEqual([])
  })
})
