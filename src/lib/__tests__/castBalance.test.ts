import { describe, it, expect } from 'vitest'
import { computeCastBalance } from '@/lib/castBalance'
import type { WorldEvent, Chapter, Character } from '@/types'

function chapter(id: string, number: number): Chapter {
  return { id, worldId: 'w', timelineId: 't1', number, title: '', synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }
}
function event(id: string, chapterId: string, sortOrder: number, extra: Partial<WorldEvent> = {}): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: 't1', title: id, description: '',
    locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], threadIds: [], involvedItemIds: [], tags: [], sortOrder,
    travelDays: null, inWorldTime: null, tension: null, structureBeat: null,
    status: 'draft', povCharacterId: null, isFlashback: false, createdAt: 0, updatedAt: 0, ...extra,
  }
}
function char(id: string, name: string): Character {
  return { id, worldId: 'w', name } as unknown as Character
}

const chapters = [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3), chapter('c4', 4)]
const cast = [char('kael', 'Kael'), char('mira', 'Mira'), char('rook', 'Rook')]

describe('computeCastBalance', () => {
  it('counts scenes, POV, mentions and orders by word-weighted screen time', () => {
    const events = [
      event('e1', 'c1', 0, { involvedCharacterIds: ['kael', 'mira'], povCharacterId: 'kael' }),
      event('e2', 'c2', 0, { involvedCharacterIds: ['kael'], mentionedCharacterIds: ['mira'] }),
    ]
    const wordCountByEvent = new Map([['e1', 100], ['e2', 400]])
    const { members, totalWords } = computeCastBalance({ characters: cast, chapters, events, wordCountByEvent })

    expect(totalWords).toBe(500)
    // Kael present in both (500 words) → leads; Mira present in e1 only (100).
    expect(members.map((m) => m.character.id)).toEqual(['kael', 'mira', 'rook'])

    const kael = members.find((m) => m.character.id === 'kael')!
    expect(kael.sceneCount).toBe(2)
    expect(kael.povCount).toBe(1)
    expect(kael.wordCount).toBe(500)
    expect(kael.wordShare).toBe(1)

    const mira = members.find((m) => m.character.id === 'mira')!
    expect(mira.sceneCount).toBe(1)          // present in e1
    expect(mira.mentionCount).toBe(1)        // mentioned in e2 (not present)
    expect(mira.wordCount).toBe(100)
  })

  it('reports never-appearing characters with zeros', () => {
    const events = [event('e1', 'c1', 0, { involvedCharacterIds: ['kael'] })]
    const { members } = computeCastBalance({ characters: cast, chapters, events })
    const rook = members.find((m) => m.character.id === 'rook')!
    expect(rook.sceneCount).toBe(0)
    expect(rook.firstChapterNumber).toBeNull()
    expect(rook.trailingGap).toBe(4) // never appears → gap spans all chapters
  })

  it('computes trailing gap and interior dormancy across chapters', () => {
    // Kael appears in ch1 and ch4 only → interior dormancy of 2 (ch2, ch3),
    // trailing gap 0 (last chapter). Mira appears only in ch1 → trailing gap 3.
    const events = [
      event('e1', 'c1', 0, { involvedCharacterIds: ['kael', 'mira'] }),
      event('e4', 'c4', 0, { involvedCharacterIds: ['kael'] }),
    ]
    const { members } = computeCastBalance({ characters: cast, chapters, events })
    const kael = members.find((m) => m.character.id === 'kael')!
    expect(kael.presenceByChapter).toEqual([true, false, false, true])
    expect(kael.longestDormancy).toBe(2)
    expect(kael.trailingGap).toBe(0)
    expect(kael.firstChapterNumber).toBe(1)
    expect(kael.lastChapterNumber).toBe(4)

    const mira = members.find((m) => m.character.id === 'mira')!
    expect(mira.longestDormancy).toBe(0)   // only one appearance → no interior gap
    expect(mira.trailingGap).toBe(3)       // last seen ch1, three chapters remain
  })

  it('falls back to scene counts when no prose exists (wordShare 0)', () => {
    const events = [event('e1', 'c1', 0, { involvedCharacterIds: ['kael'] })]
    const { members, totalWords } = computeCastBalance({ characters: cast, chapters, events })
    expect(totalWords).toBe(0)
    const kael = members.find((m) => m.character.id === 'kael')!
    expect(kael.wordShare).toBe(0)
    expect(kael.sceneCount).toBe(1)
  })
})
