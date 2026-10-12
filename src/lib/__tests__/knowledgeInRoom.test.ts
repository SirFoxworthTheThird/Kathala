import { describe, it, expect } from 'vitest'
import { knowledgeInRoom, roomAt } from '@/lib/knowledgeInRoom'

/** "Knowledge in the room": the scene's living people, and what they know by now (writer run 5, S4). */

const fact = (id: string, title: string) => ({ id, worldId: 'w', title, description: '', tags: [] }) as never
const reveal = (factId: string, characterId: string, eventId: string) => ({ id: `${factId}-${characterId}`, worldId: 'w', factId, characterId, eventId }) as never
const names: Record<string, string> = { eleanor: 'Eleanor Vane', tobias: 'Tobias Wren', agnes: 'Agnes Thorne' }

describe('knowledgeInRoom', () => {
  const facts = [fact('sluice', 'The sluice was opened on purpose')]
  const reveals = [reveal('sluice', 'eleanor', 'e1'), reveal('sluice', 'tobias', 'e1'), reveal('sluice', 'agnes', 'e9')]
  const knownAt = (eventId: string) => eventId !== 'e9'

  it('lists only who is in the room, and who knows by now', () => {
    const rows = knowledgeInRoom({ facts, reveals, room: new Set(['eleanor', 'agnes']), knownAt, nameOf: (id) => names[id] })
    // Tobias knows but is not here; Agnes is here but learns it later.
    expect(rows.map((r) => r.knowers)).toEqual([['Eleanor Vane']])
  })

  it('says nothing for a fact nobody in the room knows', () => {
    expect(knowledgeInRoom({ facts, reveals, room: new Set(['agnes']), knownAt, nameOf: (id) => names[id] })).toEqual([])
  })
})

describe('roomAt', () => {
  it('is the cast and the point of view, less the dead', () => {
    const scene = { involvedCharacterIds: ['eleanor', 'tobias'], povCharacterId: 'agnes' }
    expect([...roomAt(scene, (id) => id === 'tobias')].sort()).toEqual(['agnes', 'eleanor'])
    expect([...roomAt(scene, () => false)].sort()).toEqual(['agnes', 'eleanor', 'tobias'])
  })
})
