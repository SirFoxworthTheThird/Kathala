import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { applyReportedDeaths, applyReportedStates } from '@/db/hooks/useSnapshots'
import { storyOf } from '@/lib/stateEngine'
import type { CharacterSnapshot, KnowledgeFact } from '@/types'

describe('reported offstage deaths', () => {
  const chapters = [{ id: 'chapter', number: 1 }]
  const events = ['before', 'report', 'return', 'later', 'new-report'].map((id, sortOrder) => ({ id, chapterId: 'chapter', sortOrder }))
  const reported = (eventId: string, description: string) => ({ readerLearnsAtEventId: eventId, tags: ['offstage-death:athelstane'], description } as KnowledgeFact)

  it('lets a later direct living state correct an earlier death report, including on rewind', () => {
    const before = { id: 'before-state', characterId: 'athelstane', eventId: 'before', isAlive: true, inventoryItemIds: [], statusNotes: 'Struck down.' } as unknown as unknown as CharacterSnapshot
    const returned = { ...before, id: 'returned-state', eventId: 'return', currentLocationMarkerId: 'guest-room', currentMapLayerId: 'keep', statusNotes: 'Appears alive and explains his captivity.' }
    const fact = reported('report', 'The household reports Athelstane dead.')
    expect(applyReportedDeaths([before], [fact], 'report', storyOf(events.map(e=>({...e,timelineId:'tl'})),chapters,[]))[0]).toMatchObject({ isAlive: false, statusNotes: fact.description })
    expect(applyReportedDeaths([returned], [fact], 'return', storyOf(events.map(e=>({...e,timelineId:'tl'})),chapters,[]))[0]).toBe(returned)
    expect(applyReportedDeaths([returned], [fact], 'later', storyOf(events.map(e=>({...e,timelineId:'tl'})),chapters,[]))[0]).toBe(returned)
    expect(applyReportedDeaths([before], [fact], 'before', storyOf(events.map(e=>({...e,timelineId:'tl'})),chapters,[]))[0]).toBe(before)
    expect(applyReportedDeaths([before], [fact], 'report', storyOf(events.map(e=>({...e,timelineId:'tl'})),chapters,[]))[0].isAlive).toBe(false)
  })

  it('chooses the latest reached report by reading order, even when facts are unsorted', () => {
    const state = { id: 'returned', characterId: 'athelstane', eventId: 'return', isAlive: true, inventoryItemIds: ['cloak'], statusNotes: 'Alive in the room.' } as unknown as unknown as CharacterSnapshot
    const old = reported('report', 'The old mistaken report.')
    const newer = reported('new-report', 'A subsequent death is reported.')
    expect(applyReportedDeaths([state], [newer, old], 'later', storyOf(events.map(e=>({...e,timelineId:'tl'})),chapters,[]))[0]).toBe(state)
    expect(applyReportedDeaths([state], [newer, old], 'new-report', storyOf(events.map(e=>({...e,timelineId:'tl'})),chapters,[]))[0]).toMatchObject({ isAlive: false, statusNotes: newer.description, inventoryItemIds: [] })
    expect(state.inventoryItemIds).toEqual(['cloak'])
  })

  it('preserves a direct state at the same scene as the report', () => {
    const state = { characterId: 'athelstane', eventId: 'report', isAlive: true, inventoryItemIds: [], statusNotes: 'The supposed victim walks into the room.' } as unknown as unknown as CharacterSnapshot
    expect(applyReportedDeaths([state], [reported('report', 'Others call him dead.')], 'report', storyOf(events.map(e=>({...e,timelineId:'tl'})),chapters,[]))[0]).toBe(state)
  })

  it('does not treat a later status-only record as a direct correction to a death report',()=>{
    const story=storyOf(events.map(e=>({...e,timelineId:'tl'})),chapters,[])
    const before={id:'first',characterId:'athelstane',eventId:'before',isAlive:true,inventoryItemIds:[],statusNotes:'Alive.'} as unknown as CharacterSnapshot
    const note={id:'note',characterId:'athelstane',eventId:'later',statusNotes:'The household prepares the room.'} as unknown as CharacterSnapshot
    const resolved={...before,...note}
    const fact=reported('report','The household reports him dead.')
    expect(applyReportedStates([resolved],[fact],'later',story,[before,note])[0].isAlive).toBe(false)
    expect(applyReportedStates([resolved],[fact],'later',story,[before,{...note,isAlive:true}])[0].isAlive).toBe(true)
  })

  it('does not carry a report between non-overlapping eras',()=>{
    const scenes=[{id:'before',chapterId:'chapter',sortOrder:0,timelineId:'old'},{id:'report',chapterId:'chapter',sortOrder:1,timelineId:'new'},{id:'later',chapterId:'chapter',sortOrder:2,timelineId:'old',travelDays:1}]
    const story=storyOf(scenes,chapters,[{id:'old',dayOffset:0},{id:'new',dayOffset:1000}])
    const alive={characterId:'athelstane',eventId:'before',isAlive:true,inventoryItemIds:[]} as unknown as CharacterSnapshot
    expect(applyReportedStates([alive],[reported('report','Dead in the later era.')],'later',story)[0]).toBe(alive)
  })

  it('changes the resolved state only after the report without inventing a snapshot', () => {
    const snapshot = {
      id: 'snap-tom', characterId: 'tom', eventId: 'before', isAlive: true,
      currentLocationMarkerId: 'harbour', currentMapLayerId: 'shoreby',
      inventoryItemIds: ['coat'], statusNotes: 'Alive aboard the ship.',
    } as unknown as CharacterSnapshot
    const fact = {
      readerLearnsAtEventId: 'report', tags: ['offstage-death:tom'],
      description: 'The captain reports that Tom died.',
    } as KnowledgeFact
    const events = [
      { id: 'before', chapterId: 'chapter', sortOrder: 0 },
      { id: 'report', chapterId: 'chapter', sortOrder: 1 },
    ]
    const chapters = [{ id: 'chapter', number: 1 }]
    const story = storyOf(events.map((e) => ({ ...e, timelineId: 'tl' })), chapters, [])

    expect(applyReportedDeaths([snapshot], [fact], 'before', story)[0].isAlive).toBe(true)
    const after = applyReportedDeaths([snapshot], [fact], 'report', story)[0]
    expect(after).toMatchObject({ isAlive: false, currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [], statusNotes: fact.description })
    expect(snapshot.isAlive).toBe(true)
  })
})
