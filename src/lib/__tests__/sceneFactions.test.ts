import { describe, it, expect } from 'vitest'
import { livingCast, sceneFactions } from '@/lib/sceneFactions'
import type { Faction, FactionMembership } from '@/types'

const faction = (id: string): Faction => ({ id, worldId: 'w', name: id, description: '', color: '#000', createdAt: 0, updatedAt: 0 } as Faction)
const member = (factionId: string, characterId: string): FactionMembership =>
  ({ id: `${factionId}-${characterId}`, worldId: 'w', factionId, characterId, role: null, startEventId: null, endEventId: null, createdAt: 0, updatedAt: 0 } as FactionMembership)

describe('sceneFactions (writer run 9)', () => {
  const factions = [faction('police'), faction('exchange'), faction('union')]
  const memberships = [member('police', 'tom'), member('exchange', 'tranter'), member('union', 'sean'), member('union', 'kieran')]

  it('is the factions of the scene’s own cast — on stage, on the phone, its point of view', () => {
    const cast = livingCast({ involvedCharacterIds: ['sean'], remoteCharacterIds: ['tom'], povCharacterId: 'nell' }, new Set())
    expect([...cast].sort()).toEqual(['nell', 'sean', 'tom'])
    expect(sceneFactions(cast, factions, memberships).map((s) => [s.faction.id, s.memberIds])).toEqual([['police', ['tom']], ['union', ['sean']]])
  })

  it('leaves out the dead', () => {
    const cast = livingCast({ involvedCharacterIds: ['sean', 'kieran'], povCharacterId: null }, new Set(['kieran']))
    expect(sceneFactions(cast, factions, memberships).map((s) => [s.faction.id, s.memberIds])).toEqual([['union', ['sean']]])
    // Paired: alive, he is in it.
    expect(sceneFactions(livingCast({ involvedCharacterIds: ['sean', 'kieran'], povCharacterId: null }, new Set()), factions, memberships)[0].memberIds).toEqual(['sean', 'kieran'])
  })

  it('no scene, no sides', () => {
    expect(sceneFactions(livingCast(undefined, new Set()), factions, memberships)).toEqual([])
  })
})
