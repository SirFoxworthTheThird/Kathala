import { storyOf } from '@/lib/stateEngine'
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { applyReportedStates } from '@/db/hooks/useSnapshots'
import type { CharacterSnapshot, KnowledgeFact } from '@/types'

describe('reported unknown locations', () => {
  const chapters=[{id:'c',number:1}]
  const events=['before','absence','seen','death','later'].map((id,sortOrder)=>({id,chapterId:'c',sortOrder}))
  const state={id:'s',characterId:'rebecca',eventId:'before',isAlive:true,currentLocationMarkerId:'upper',currentMapLayerId:'upper-floor',inventoryItemIds:['lamp'],statusNotes:'Attends her father.'} as CharacterSnapshot
  const report={id:'absence-fact',readerLearnsAtEventId:'absence',tags:['offstage-location-unknown:rebecca'],description:'Her father finds she has left the room unobserved.'} as KnowledgeFact

  it('clears only reported location, preserving life, inventory and the source snapshot',()=>{
    expect(applyReportedStates([state],[report],'before', storyOf(events.map(e=>({...e,timelineId:'tl'})),chapters,[]))[0]).toBe(state)
    const result=applyReportedStates([state],[report],'absence', storyOf(events.map(e=>({...e,timelineId:'tl'})),chapters,[]))[0]
    expect(result).toMatchObject({isAlive:true,currentLocationMarkerId:null,currentMapLayerId:null,inventoryItemIds:['lamp'],statusNotes:report.description})
    expect(state.currentLocationMarkerId).toBe('upper')
    expect(result.eventId).toBe('before')
  })
  it('lets a direct sighting supersede the report and restores the report on rewind',()=>{
    const seen={...state,id:'seen-state',eventId:'seen',currentLocationMarkerId:'side-room',currentMapLayerId:'lower-floor'}
    expect(applyReportedStates([seen],[report],'seen', storyOf(events.map(e=>({...e,timelineId:'tl'})),chapters,[]))[0]).toBe(seen)
    expect(applyReportedStates([state],[report],'absence', storyOf(events.map(e=>({...e,timelineId:'tl'})),chapters,[]))[0].currentLocationMarkerId).toBeNull()
    expect(applyReportedStates([state],[report],'before', storyOf(events.map(e=>({...e,timelineId:'tl'})),chapters,[]))[0]).toBe(state)
  })
  it('does not replace a subsequent death report with an older unknown-location notice',()=>{
    const death={...report,id:'death-fact',readerLearnsAtEventId:'death',tags:['offstage-death:rebecca'],description:'A death is reported.'}
    expect(applyReportedStates([state],[death,report],'later', storyOf(events.map(e=>({...e,timelineId:'tl'})),chapters,[]))[0]).toMatchObject({isAlive:false,inventoryItemIds:[],statusNotes:death.description})
  })
})
