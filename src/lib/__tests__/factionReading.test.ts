import {describe,expect,it} from 'vitest'
import type {FactionMembership} from '@/types'
import {reachedMemberships,type MembershipGate} from '../factionReading'

const member=(id:string,characterId:string,startEventId:string|null,endEventId:string|null=null):FactionMembership=>({id,characterId,startEventId,endEventId,worldId:'w',factionId:'order',role:'Preceptor',notes:'',createdAt:0,updatedAt:0})
const gate:MembershipGate={active:true,isRevealed:id=>id==='known',hasReached:id=>!id||id==='past'}

describe('reader-visible faction memberships',()=>{
  it('withholds an already-met character’s later affiliation and its count',()=>{
    const current=member('current','known','past'),future=member('future','known','future')
    expect(reachedMemberships([current,future],gate)).toEqual([current])
  })
  it('withholds a member not yet met even when its affiliation predates the cursor',()=>{
    expect(reachedMemberships([member('unmet','unknown','past')],gate)).toEqual([])
  })
  it('does not disclose an upcoming departure through its linked event',()=>{
    const row=member('current','known','past','future')
    expect(reachedMemberships([row],gate)[0].endEventId).toBeNull()
    expect(row.endEventId).toBe('future')
  })
  it('keeps a reached historical departure and an initial membership',()=>{
    const rows=[member('ended','known','past','past'),member('initial','known',null)]
    expect(reachedMemberships(rows,gate)).toEqual(rows)
  })
  it('preserves the writer’s full records and future ranges',()=>{
    const rows=[member('future','unknown','future','later')]
    expect(reachedMemberships(rows,{...gate,active:false})).toEqual(rows)
  })
})
