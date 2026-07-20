import { describe, it, expect } from 'vitest'
import { expandWorldSpec, parseWorldSpec, worldSpecStats, type WorldSpec } from '@/lib/worldSpec'

const NOW = 1_700_000_000_000

const SPEC: WorldSpec = {
  world: { name: 'Middle Earth', description: 'A high-fantasy setting.' },
  characters: [
    { name: 'Frodo', aliases: ['Mr. Underhill'], description: 'The ring-bearer.', tags: ['protagonist'] },
    { name: 'Sam' },
    { name: 'Boromir' },
  ],
  items: [{ name: 'The One Ring', icon: 'ring' }],
  factions: [{ name: 'The Fellowship', members: ['Frodo', { name: 'Sam', role: 'Companion' }] }],
  relationships: [{ a: 'Frodo', b: 'Sam', label: 'friends', strength: 'bond', sentiment: 'positive' }],
  chapters: [
    {
      title: 'A Long-expected Party', synopsis: 'Bilbo departs.',
      events: [
        {
          id: 'e1', title: 'Frodo inherits the Ring', pov: 'Frodo',
          characters: ['Frodo'], tension: 2, beat: 'inciting-incident',
          changes: [{ who: 'Frodo', location: 'Bag End', gains: ['The One Ring'], note: 'Takes up the burden.' }],
        },
      ],
    },
    {
      title: 'The Breaking', synopsis: 'The fellowship splinters.',
      events: [
        {
          id: 'e2', title: 'Boromir falls', characters: ['Frodo', 'Sam', 'Boromir'],
          changes: [{ who: 'Boromir', dies: true, note: 'Slain by orcs.' }],
        },
      ],
    },
  ],
  lore: [{ category: 'Geography', title: 'The Shire', body: 'A green land.' }],
  knowledge: [
    { title: 'The Ring is the One Ring', origin: 'e1', revealedTo: [{ who: 'Frodo', at: 'e1' }] },
  ],
}

describe('expandWorldSpec', () => {
  const out = expandWorldSpec(SPEC, { now: NOW })

  it('creates the world, a Main Story timeline, characters and items', () => {
    expect(out.world.name).toBe('Middle Earth')
    expect(out.version).toBeGreaterThanOrEqual(17)
    expect(out.timelines).toHaveLength(1)
    expect(out.characters.map((c) => c.name).sort()).toEqual(['Boromir', 'Frodo', 'Sam'])
    expect(out.items[0].iconType).toBe('ring')
  })

  it('numbers chapters and orders events with resolved cast and POV', () => {
    expect(out.chapters.map((c) => c.number)).toEqual([1, 2])
    const e1 = out.events.find((e) => e.title === 'Frodo inherits the Ring')!
    const frodo = out.characters.find((c) => c.name === 'Frodo')!
    expect(e1.povCharacterId).toBe(frodo.id)
    expect(e1.involvedCharacterIds).toContain(frodo.id)
    expect(e1.tension).toBe(2)
    expect(e1.structureBeat).toBe('inciting-incident')
  })

  it('builds delta snapshots: first appearance + on change, carrying running state', () => {
    const frodo = out.characters.find((c) => c.name === 'Frodo')!
    const ring = out.items[0]
    const frodoSnaps = out.characterSnapshots.filter((s) => s.characterId === frodo.id)
    // Frodo: one snapshot (first appearance + the ring change at the same event).
    expect(frodoSnaps).toHaveLength(1)
    expect(frodoSnaps[0].inventoryItemIds).toEqual([ring.id])
    expect(frodoSnaps[0].statusNotes).toBe('At Bag End. Takes up the burden.')
  })

  it('does not emit a snapshot for a present character whose state is unchanged', () => {
    const sam = out.characters.find((c) => c.name === 'Sam')!
    // Sam only appears in e2 (first appearance → exactly one anchor snapshot).
    expect(out.characterSnapshots.filter((s) => s.characterId === sam.id)).toHaveLength(1)
  })

  it('records a death as isAlive:false from the change event', () => {
    const boromir = out.characters.find((c) => c.name === 'Boromir')!
    const snap = out.characterSnapshots.find((s) => s.characterId === boromir.id)!
    expect(snap.isAlive).toBe(false)
  })

  it('resolves faction members and relationships by name', () => {
    expect(out.factions[0].name).toBe('The Fellowship')
    expect(out.factionMemberships).toHaveLength(2)
    const rel = out.relationships[0]
    const frodo = out.characters.find((c) => c.name === 'Frodo')!
    const sam = out.characters.find((c) => c.name === 'Sam')!
    expect([rel.characterAId, rel.characterBId].sort()).toEqual([frodo.id, sam.id].sort())
    expect(rel.strength).toBe('bond')
  })

  it('resolves knowledge origin and reveals to real event/character ids', () => {
    const e1 = out.events.find((e) => e.title === 'Frodo inherits the Ring')!
    const fact = out.knowledgeFacts![0]
    expect(fact.originEventId).toBe(e1.id)
    expect(out.knowledgeReveals).toHaveLength(1)
    expect(out.knowledgeReveals![0].eventId).toBe(e1.id)
  })

  it('groups lore pages under created categories', () => {
    expect(out.loreCategories.map((c) => c.name)).toEqual(['Geography'])
    expect(out.lorePages[0].categoryId).toBe(out.loreCategories[0].id)
  })

  it('drops references it cannot resolve instead of throwing', () => {
    const spec: WorldSpec = {
      world: { name: 'W' },
      characters: [{ name: 'A' }],
      chapters: [{ events: [{ title: 'x', characters: ['A', 'Ghost'], changes: [{ who: 'Nobody', note: 'n' }] }] }],
      relationships: [{ a: 'A', b: 'Ghost' }],
    }
    const o = expandWorldSpec(spec, { now: NOW })
    expect(o.events[0].involvedCharacterIds).toHaveLength(1) // Ghost dropped
    expect(o.relationships).toHaveLength(0) // unresolved pair dropped
    // Only A's first-appearance snapshot; the "Nobody" change is ignored.
    expect(o.characterSnapshots).toHaveLength(1)
  })

  it('uses the same timestamp everywhere', () => {
    expect(out.exportedAt).toBe(NOW)
    expect(out.world.createdAt).toBe(NOW)
    expect(out.events[0].createdAt).toBe(NOW)
  })
})

describe('parseWorldSpec', () => {
  it('accepts a minimal valid spec', () => {
    const { spec, error } = parseWorldSpec('{"world":{"name":"W"},"chapters":[]}')
    expect(error).toBeUndefined()
    expect(spec?.world.name).toBe('W')
  })

  it('reports invalid JSON', () => {
    expect(parseWorldSpec('{not json').error).toMatch(/valid JSON/i)
  })

  it('requires world.name and chapters', () => {
    expect(parseWorldSpec('{"chapters":[]}').error).toMatch(/world\.name/)
    expect(parseWorldSpec('{"world":{"name":"W"}}').error).toMatch(/chapters/)
  })
})

describe('worldSpecStats', () => {
  it('counts characters, chapters, events and factions', () => {
    expect(worldSpecStats(SPEC)).toEqual({ characters: 3, chapters: 2, events: 2, factions: 1 })
  })
})
