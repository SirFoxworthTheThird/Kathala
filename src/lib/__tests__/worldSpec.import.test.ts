import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/database'
import { createWorldFromSpec, type WorldSpec } from '@/lib/worldSpec'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const SPEC: WorldSpec = {
  world: { name: 'Eldoria' },
  characters: [{ name: 'Aria' }, { name: 'Cael' }],
  items: [{ name: 'Sunblade', icon: 'weapon' }],
  factions: [{ name: 'The Order', members: ['Aria'] }],
  relationships: [{ a: 'Aria', b: 'Cael', label: 'allies', strength: 'strong', sentiment: 'positive' }],
  chapters: [
    {
      title: 'The Call', synopsis: 'It begins.',
      events: [
        { id: 'e1', title: 'Aria takes up the blade', characters: ['Aria'], changes: [{ who: 'Aria', gains: ['Sunblade'] }] },
      ],
    },
    {
      title: 'The Fall',
      events: [
        { id: 'e2', title: 'Cael betrays the Order', characters: ['Aria', 'Cael'], changes: [{ who: 'Cael', note: 'Turns.' }] },
      ],
    },
  ],
  knowledge: [{ title: 'Cael is a traitor', origin: 'e2', revealedTo: [{ who: 'Aria', at: 'e2' }] }],
}

describe('createWorldFromSpec', () => {
  it('expands a spec and imports it as a fully-wired world', async () => {
    const worldId = await createWorldFromSpec(SPEC)

    expect((await db.worlds.get(worldId))?.name).toBe('Eldoria')

    const chapters = await db.chapters.where('worldId').equals(worldId).sortBy('number')
    expect(chapters.map((c) => c.title)).toEqual(['The Call', 'The Fall'])

    const characters = await db.characters.where('worldId').equals(worldId).toArray()
    const aria = characters.find((c) => c.name === 'Aria')!
    expect(aria).toBeDefined()

    // Snapshot inventory references the real imported item id.
    const items = await db.items.where('worldId').equals(worldId).toArray()
    const sunblade = items.find((i) => i.name === 'Sunblade')!
    const ariaSnaps = await db.characterSnapshots.where('worldId').equals(worldId).toArray()
    const ariaInv = ariaSnaps.find((s) => s.characterId === aria.id && s.inventoryItemIds.length > 0)
    expect(ariaInv?.inventoryItemIds).toEqual([sunblade.id])

    // Faction membership resolved by name.
    const memberships = await db.factionMemberships.where('worldId').equals(worldId).toArray()
    expect(memberships).toHaveLength(1)
    expect(memberships[0].characterId).toBe(aria.id)

    // Knowledge fact + reveal wired to real event/character ids.
    const events = await db.events.where('worldId').equals(worldId).toArray()
    const e2 = events.find((e) => e.title === 'Cael betrays the Order')!
    const facts = await db.knowledgeFacts.where('worldId').equals(worldId).toArray()
    expect(facts[0].originEventId).toBe(e2.id)
    const reveals = await db.knowledgeReveals.where('worldId').equals(worldId).toArray()
    expect(reveals[0].eventId).toBe(e2.id)
    expect(reveals[0].characterId).toBe(aria.id)

    // No scene prose is generated.
    expect(await db.sceneTexts.where('worldId').equals(worldId).count()).toBe(0)
  })
})
