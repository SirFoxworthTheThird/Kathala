import type {Relationship,RelationshipSnapshot} from '@/types'

export function relationshipsWithState(relationships:readonly Relationship[],snapshots:readonly RelationshipSnapshot[]):Array<Relationship&{isActive:boolean;stateEventId:string|null}>{
  const byRelationship=new Map(snapshots.map(snapshot=>[snapshot.relationshipId,snapshot]))
  return relationships.map(relationship=>{
    const state=byRelationship.get(relationship.id)
    return state?{...relationship,label:state.label||relationship.label,strength:state.strength,sentiment:state.sentiment,description:state.description,isActive:state.isActive,stateEventId:state.eventId}:{...relationship,isActive:true,stateEventId:relationship.startEventId}
  })
}
