import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { applyReportedStates } from '@/db/hooks/useSnapshots'
import type { CharacterSnapshot, KnowledgeFact } from '@/types'

describe('reported inventory relinquishment', () => {
  const chapters=[{id:'c',number:1}]
  const events=['before','report','returned','later'].map((id,sortOrder)=>({id,chapterId:'c',sortOrder}))
  const state={id:'s',characterId:'wamba',eventId:'before',isAlive:true,currentLocationMarkerId:'court',currentMapLayerId:'castle',inventoryItemIds:['horn','baldric','sword'],inventoryNotes:'Carries his sword.',statusNotes:'Leaves with Cedric.'} as CharacterSnapshot
  const report={id:'handoff',readerLearnsAtEventId:'report',tags:['offstage-inventory-removed:wamba:horn','offstage-inventory-removed:wamba:baldric'],description:'Locksley gives the horn and baldric to the Black Knight.'} as KnowledgeFact

  it('clears the reported objects without moving the absent former holder or inventing presence',()=>{
    const result=applyReportedStates([state],[report],'report',events,chapters)[0]
    expect(result).toMatchObject({eventId:'before',currentLocationMarkerId:'court',currentMapLayerId:'castle',statusNotes:state.statusNotes,inventoryItemIds:['sword']})
    expect(result.inventoryNotes).toContain(report.description)
    expect(state.inventoryItemIds).toEqual(['horn','baldric','sword'])
  })
  it('does not reveal the relinquishment early and restores the old holding on rewind',()=>{
    expect(applyReportedStates([state],[report],'before',events,chapters)[0]).toBe(state)
    expect(applyReportedStates([state],[report],'later',events,chapters)[0].inventoryItemIds).toEqual(['sword'])
    expect(applyReportedStates([state],[report],'before',events,chapters)[0].inventoryItemIds).toContain('horn')
  })
  it('allows a later direct acquisition and keeps unknown-location reports independent',()=>{
    const returned={...state,eventId:'returned'}
    expect(applyReportedStates([returned],[report],'later',events,chapters)[0]).toBe(returned)
    const whereabouts={...report,id:'where',tags:['offstage-location-unknown:wamba'],description:'Wamba has left; his destination is not known.'}
    expect(applyReportedStates([state],[report,whereabouts],'later',events,chapters)[0]).toMatchObject({inventoryItemIds:['sword'],currentLocationMarkerId:null,statusNotes:whereabouts.description})
  })
})
