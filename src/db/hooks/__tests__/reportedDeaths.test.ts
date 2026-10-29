import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { applyReportedDeaths } from '@/db/hooks/useSnapshots'
import type { CharacterSnapshot, KnowledgeFact } from '@/types'

describe('reported offstage deaths', () => {
  const events = [
    { id: 'before', chapterId: 'chapter', sortOrder: 0 },
    { id: 'report', chapterId: 'chapter', sortOrder: 1 },
    { id: 'later', chapterId: 'chapter', sortOrder: 2 },
  ]
  const chapters = [{ id: 'chapter', number: 1 }]
  const report = {
    id: 'nun-death', worldId: 'world', title: 'The nun has died',
    readerLearnsAtEventId: 'report', originEventId: 'report',
    tags: ['offstage-death:nun'], description: 'The gardener reports her death.',
    createdAt: 1, updatedAt: 1,
  } satisfies KnowledgeFact

  it('resolves a reported death with no physical snapshot, only from the report onward', () => {
    const history: CharacterSnapshot[] = []
    expect(applyReportedDeaths(history, [report], 'before', events, chapters)).toEqual([])
    const after = applyReportedDeaths(history, [report], 'report', events, chapters)
    expect(after).toHaveLength(1)
    expect(after[0]).toMatchObject({
      characterId: 'nun', isAlive: false, currentLocationMarkerId: null,
      currentMapLayerId: null, inventoryItemIds: [], statusNotes: report.description,
    })
    expect(history).toEqual([])
    expect(applyReportedDeaths(history, [report], 'before', events, chapters)).toEqual([])
  })

  it('does not resolve an ordinary fact or a missing report event into a character state', () => {
    expect(applyReportedDeaths([], [{ ...report, tags: [] }], 'report', events, chapters)).toEqual([])
    expect(applyReportedDeaths([], [{ ...report, readerLearnsAtEventId: 'missing' }], 'later', events, chapters)).toEqual([])
    expect(applyReportedDeaths([], [report], null, events, chapters)).toEqual([])
  })

  it('keeps single-character and timeline queries from acquiring an unrelated reported state', () => {
    expect(applyReportedDeaths([], [report], 'report', events, chapters, { characterId: 'doctor' })).toEqual([])
    expect(applyReportedDeaths([], [report], 'report', events, chapters, { characterId: 'nun' })).toHaveLength(1)
    expect(applyReportedDeaths([], [report], 'report', events, chapters, { timelineEventIds: new Set(['before']) })).toEqual([])
    expect(applyReportedDeaths([], [report], 'report', events, chapters, { timelineEventIds: new Set(['report']) })).toHaveLength(1)
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
