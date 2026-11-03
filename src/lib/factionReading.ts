import type {FactionMembership} from '@/types'
import type {ReadingGate} from '@/db/hooks/useReading'

export type MembershipGate=Pick<ReadingGate,'active'|'isRevealed'|'hasReached'>

export function reachedMemberships(rows: readonly FactionMembership[], gate: MembershipGate): FactionMembership[]{
  if(!gate.active)return [...rows]
  return rows.filter(row=>gate.isRevealed(row.characterId)&&gate.hasReached(row.startEventId))
    .map(row=>row.endEventId&&!gate.hasReached(row.endEventId)?{...row,endEventId:null}:row)
}
