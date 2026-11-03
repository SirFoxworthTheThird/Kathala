import { storyOf } from '@/lib/stateEngine'
import {describe,expect,it} from 'vitest'
import type {Relationship,RelationshipSnapshot} from '@/types'
import {relationshipsWithState} from '../relationshipState'
import {selectBestSnapshots} from '@/db/hooks/useRelationshipSnapshots'

const base:Relationship={id:'bond',worldId:'w',characterAId:'parent',characterBId:'child',label:'Estranged',strength:'strong',sentiment:'negative',description:'An existing dispute.',isBidirectional:true,startEventId:'early',createdAt:0,updatedAt:0}
const reconciled:RelationshipSnapshot={id:'change',worldId:'w',relationshipId:'bond',eventId:'later',sortKey:2,label:'Reconciled',strength:'bond',sentiment:'positive',description:'They accept forgiveness.',isActive:true,createdAt:1,updatedAt:1}
const events=[{id:'early',chapterId:'chapter',sortOrder:0},{id:'later',chapterId:'chapter',sortOrder:1}],chapters=[{id:'chapter',number:1}]

describe('relationship cards at the reading cursor',()=>{
  it('shows the inherited change, then restores the initial state on rewind',()=>{
    const after=relationshipsWithState([base],selectBestSnapshots([reconciled],'later',storyOf(events.map(e=>({...e,timelineId:'tl'})),chapters,[])))[0]
    expect(after).toMatchObject({id:'bond',label:'Reconciled',sentiment:'positive',strength:'bond',description:'They accept forgiveness.',stateEventId:'later'})
    const before=relationshipsWithState([base],selectBestSnapshots([reconciled],'early',storyOf(events.map(e=>({...e,timelineId:'tl'})),chapters,[])))[0]
    expect(before).toMatchObject({label:'Estranged',sentiment:'negative',stateEventId:'early'})
    expect(base.label).toBe('Estranged')
  })
  it('preserves an explicit ending and leaves unrelated initial relationships alone',()=>{
    const ended={...reconciled,isActive:false,label:'Former allies'}
    const other={...base,id:'other'}
    expect(relationshipsWithState([base,other],[ended])).toMatchObject([{label:'Former allies',isActive:false},{id:'other',label:'Estranged',isActive:true}])
  })
})
