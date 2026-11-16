import { describe, expect, it } from 'vitest'
import { identityFirstAppearances } from '../characterIdentity'

const records=[{id:'masked',revealedAs:{characterId:'named',eventId:'disclosure'}},{id:'named'}]
const sort=(id:string)=>id==='disclosure'?8:undefined
describe('an explicit identity introduces the named record',()=>{
  it('reveals the head at the disclosure without altering the disguise appearance',()=>{
    const original=new Map([['masked',3]])
    const result=identityFirstAppearances(records,original,sort)
    expect(result.get('masked')).toBe(3)
    expect(result.get('named')).toBe(8)
    expect(original.has('named')).toBe(false)
  })
  it('retains an earlier independent meeting with the named person',()=>{
    expect(identityFirstAppearances(records,new Map([['masked',3],['named',1]]),sort).get('named')).toBe(1)
  })
  it('does not reveal an unmet disguise, an unplaceable disclosure, or an absent head',()=>{
    expect(identityFirstAppearances(records,new Map(),sort).has('named')).toBe(false)
    expect(identityFirstAppearances(records,new Map([['masked',3]]),()=>undefined).has('named')).toBe(false)
    expect(identityFirstAppearances(records.slice(0,1),new Map([['masked',3]]),sort).has('named')).toBe(false)
  })
  it('cannot introduce the head before the disguise first appears',()=>{
    expect(identityFirstAppearances(records,new Map([['masked',10]]),sort).get('named')).toBe(10)
  })
})
