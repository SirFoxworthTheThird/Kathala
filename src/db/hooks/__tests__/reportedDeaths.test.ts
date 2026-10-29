import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { applyReportedDeaths } from '@/db/hooks/useSnapshots'
import type { CharacterSnapshot, KnowledgeFact } from '@/types'

describe('reported offstage deaths', () => {
  const chapters = [{ id: 'chapter', number: 1 }]
  const events = ['before', 'report', 'return', 'later', 'new-report'].map((id, sortOrder) => ({ id, chapterId: 'chapter', sortOrder }))
  const reported = (eventId: string, description: string) => ({ readerLearnsAtEventId: eventId, tags: ['offstage-death:athelstane'], description } as KnowledgeFact)

  it('lets a later direct living state correct an earlier death report, including on rewind', () => {
    const before = { id: 'before-state', characterId: 'athelstane', eventId: 'before', isAlive: true, inventoryItemIds: [], statusNotes: 'Struck down.' } as unknown as CharacterSnapshot
    const returned = { ...before, id: 'returned-state', eventId: 'return', currentLocationMarkerId: 'guest-room', currentMapLayerId: 'keep', statusNotes: 'Appears alive and explains his captivity.' }
    const fact = reported('report', 'The household reports Athelstane dead.')
    expect(applyReportedDeaths([before], [fact], 'report', events, chapters)[0]).toMatchObject({ isAlive: false, statusNotes: fact.description })
    expect(applyReportedDeaths([returned], [fact], 'return', events, chapters)[0]).toBe(returned)
    expect(applyReportedDeaths([returned], [fact], 'later', events, chapters)[0]).toBe(returned)
    expect(applyReportedDeaths([before], [fact], 'before', events, chapters)[0]).toBe(before)
    expect(applyReportedDeaths([before], [fact], 'report', events, chapters)[0].isAlive).toBe(false)
  })

  it('chooses the latest reached report by reading order, even when facts are unsorted', () => {
    const state = { id: 'returned', characterId: 'athelstane', eventId: 'return', isAlive: true, inventoryItemIds: ['cloak'], statusNotes: 'Alive in the room.' } as unknown as CharacterSnapshot
    const old = reported('report', 'The old mistaken report.')
    const newer = reported('new-report', 'A subsequent death is reported.')
    expect(applyReportedDeaths([state], [newer, old], 'later', events, chapters)[0]).toBe(state)
    expect(applyReportedDeaths([state], [newer, old], 'new-report', events, chapters)[0]).toMatchObject({ isAlive: false, statusNotes: newer.description, inventoryItemIds: [] })
    expect(state.inventoryItemIds).toEqual(['cloak'])
  })

  it('preserves a direct state at the same scene as the report', () => {
    const state = { characterId: 'athelstane', eventId: 'report', isAlive: true, inventoryItemIds: [], statusNotes: 'The supposed victim walks into the room.' } as unknown as CharacterSnapshot
    expect(applyReportedDeaths([state], [reported('report', 'Others call him dead.')], 'report', events, chapters)[0]).toBe(state)
  })

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
