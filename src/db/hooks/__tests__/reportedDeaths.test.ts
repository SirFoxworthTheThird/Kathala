import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { applyReportedDeaths } from '@/db/hooks/useSnapshots'
import type { CharacterSnapshot, KnowledgeFact } from '@/types'

describe('reported offstage deaths', () => {
  it('changes the resolved state only after the report without inventing a snapshot', () => {
    const snapshot = {
      id: 'snap-tom', characterId: 'tom', eventId: 'before', isAlive: true,
      currentLocationMarkerId: 'harbour', currentMapLayerId: 'shoreby',
      inventoryItemIds: ['coat'], statusNotes: 'Alive aboard the ship.',
    } as CharacterSnapshot
    const fact = {
      readerLearnsAtEventId: 'report', tags: ['offstage-death:tom'],
      description: 'The captain reports that Tom died.',
    } as KnowledgeFact
    const events = [
      { id: 'before', chapterId: 'chapter', sortOrder: 0 },
      { id: 'report', chapterId: 'chapter', sortOrder: 1 },
    ]
    const chapters = [{ id: 'chapter', number: 1 }]

    expect(applyReportedDeaths([snapshot], [fact], 'before', events, chapters)[0].isAlive).toBe(true)
    const after = applyReportedDeaths([snapshot], [fact], 'report', events, chapters)[0]
    expect(after).toMatchObject({ isAlive: false, currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [], statusNotes: fact.description })
    expect(snapshot.isAlive).toBe(true)
  })
})
