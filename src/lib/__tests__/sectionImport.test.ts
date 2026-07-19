import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/database'
import {
  parseCharactersSpec, addCharactersToWorld,
  parseItemsSpec, addItemsToWorld,
  parseFactionsSpec, addFactionsToWorld,
  parseRelationshipsSpec, addRelationshipsToWorld,
  parseLoreSpec, addLoreToWorld,
  parseKnowledgeSpec, addKnowledgeToWorld,
  parseLocationsSpec, addLocationsToWorld, countLocations, LOCATIONS_MAP_NAME,
  formatLocationTree,
} from '@/lib/sectionImport'

describe('parseCharactersSpec', () => {
  it('accepts a bare array of characters', () => {
    const { characters, error } = parseCharactersSpec('[{"name":"Aria"},{"name":"Bran"}]')
    expect(error).toBeUndefined()
    expect(characters?.map((c) => c.name)).toEqual(['Aria', 'Bran'])
  })

  it('accepts an object with a "characters" array and keeps optional fields', () => {
    const json = JSON.stringify({
      format: 'plotweave-characters',
      characters: [{ name: 'Aria', aliases: ['The Fox'], description: 'A thief', tags: ['protagonist'], alive: false }],
    })
    const { characters } = parseCharactersSpec(json)
    expect(characters).toHaveLength(1)
    expect(characters![0]).toMatchObject({ name: 'Aria', aliases: ['The Fox'], description: 'A thief', tags: ['protagonist'], alive: false })
  })

  it('drops entries without a usable name', () => {
    const { characters } = parseCharactersSpec('[{"name":"Aria"},{"name":"   "},{"description":"no name"}]')
    expect(characters?.map((c) => c.name)).toEqual(['Aria'])
  })

  it('errors on invalid JSON', () => {
    expect(parseCharactersSpec('not json').error).toMatch(/valid JSON/)
  })

  it('errors when nothing usable is present', () => {
    expect(parseCharactersSpec('[]').error).toMatch(/No characters/)
    expect(parseCharactersSpec('{"foo":1}').error).toMatch(/Expected a JSON array/)
  })
})

describe('addCharactersToWorld', () => {
  const worldId = 'w1'

  beforeEach(async () => {
    await db.delete()
    await db.open()
    await db.worlds.put({ id: worldId, name: 'W', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: 0, updatedAt: 0 })
  })

  it('adds new characters with their fields set', async () => {
    const res = await addCharactersToWorld(worldId, [
      { name: 'Aria', aliases: ['The Fox'], description: 'A thief', tags: ['protagonist'], alive: false, color: '#f00' },
    ])
    expect(res).toMatchObject({ added: 1, skipped: 0, addedNames: ['Aria'] })
    const chars = await db.characters.where('worldId').equals(worldId).toArray()
    expect(chars).toHaveLength(1)
    expect(chars[0]).toMatchObject({ name: 'Aria', aliases: ['The Fox'], description: 'A thief', tags: ['protagonist'], isAlive: false, color: '#f00' })
  })

  it('defaults alive to true and fills empty optional fields', async () => {
    await addCharactersToWorld(worldId, [{ name: 'Bran' }])
    const [bran] = await db.characters.where('worldId').equals(worldId).toArray()
    expect(bran).toMatchObject({ name: 'Bran', aliases: [], description: '', tags: [], isAlive: true, color: null })
  })

  it('skips names already present (case-insensitive) and repeats within the batch', async () => {
    await db.characters.put({ id: 'c-existing', worldId, name: 'Aria', aliases: [], description: '', portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: 0, updatedAt: 0 })
    const res = await addCharactersToWorld(worldId, [
      { name: 'aria' },     // dupes the existing one
      { name: 'Bran' },
      { name: 'Bran' },     // dupes within the batch
    ])
    expect(res).toMatchObject({ added: 1, skipped: 2, addedNames: ['Bran'] })
    const names = (await db.characters.where('worldId').equals(worldId).toArray()).map((c) => c.name).sort()
    expect(names).toEqual(['Aria', 'Bran'])
  })

  it('does not touch characters in other worlds', async () => {
    await db.characters.put({ id: 'other', worldId: 'w2', name: 'Aria', aliases: [], description: '', portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: 0, updatedAt: 0 })
    const res = await addCharactersToWorld(worldId, [{ name: 'Aria' }])
    expect(res.added).toBe(1) // same name, different world — still added here
  })

  it('overwrites supplied fields on an existing character and leaves omitted ones', async () => {
    await db.characters.put({ id: 'c1', worldId, name: 'Aria', aliases: ['Old Alias'], description: 'old', portraitImageId: null, tags: ['a'], isAlive: true, color: null, createdAt: 0, updatedAt: 0 })
    const res = await addCharactersToWorld(worldId, [{ name: 'aria', description: 'A cunning thief', tags: ['thief'], alive: false }])
    expect(res).toMatchObject({ added: 0, updated: 1, skipped: 0, updatedNames: ['aria'] })
    const c = await db.characters.get('c1')
    expect(c).toMatchObject({ description: 'A cunning thief', tags: ['thief'], isAlive: false, aliases: ['Old Alias'] })
  })

  it('counts a match as unchanged (skipped) when nothing new is supplied', async () => {
    await db.characters.put({ id: 'c1', worldId, name: 'Aria', aliases: [], description: 'set', portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: 0, updatedAt: 0 })
    const res = await addCharactersToWorld(worldId, [{ name: 'Aria', description: 'set' }])
    expect(res).toMatchObject({ added: 0, updated: 0, skipped: 1 })
  })
})

describe('parseItemsSpec', () => {
  it('accepts a bare array and an object form, keeping icon + tags', () => {
    expect(parseItemsSpec('[{"name":"Sword"}]').items?.map((i) => i.name)).toEqual(['Sword'])
    const { items } = parseItemsSpec('{"items":[{"name":"Amulet","icon":"ring","tags":["cursed"],"description":"glows"}]}')
    expect(items![0]).toMatchObject({ name: 'Amulet', icon: 'ring', tags: ['cursed'], description: 'glows' })
  })

  it('errors on invalid JSON and when nothing usable is present', () => {
    expect(parseItemsSpec('nope').error).toMatch(/valid JSON/)
    expect(parseItemsSpec('[]').error).toMatch(/No items/)
    expect(parseItemsSpec('{"foo":1}').error).toMatch(/Expected a JSON array/)
  })
})

describe('addItemsToWorld', () => {
  const worldId = 'w1'

  beforeEach(async () => {
    await db.delete()
    await db.open()
    await db.worlds.put({ id: worldId, name: 'W', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: 0, updatedAt: 0 })
  })

  it('adds new items with fields set and default icon', async () => {
    const res = await addItemsToWorld(worldId, [
      { name: 'Excalibur', icon: 'weapon', description: 'A famous sword.', tags: ['legendary'] },
      { name: 'Pebble' },
    ])
    expect(res).toMatchObject({ added: 2, skipped: 0 })
    const items = (await db.items.where('worldId').equals(worldId).toArray()).sort((a, b) => a.name.localeCompare(b.name))
    expect(items[0]).toMatchObject({ name: 'Excalibur', iconType: 'weapon', description: 'A famous sword.', tags: ['legendary'], imageId: null })
    expect(items[1]).toMatchObject({ name: 'Pebble', iconType: 'other', tags: [] })
  })

  it('adds new items but leaves an unchanged match and in-batch repeat alone', async () => {
    await db.items.put({ id: 'x', worldId, name: 'Sword', description: '', iconType: 'weapon', imageId: null, tags: [] })
    const res = await addItemsToWorld(worldId, [{ name: 'sword' }, { name: 'Shield' }, { name: 'Shield' }])
    expect(res).toMatchObject({ added: 1, updated: 0, skipped: 2, addedNames: ['Shield'] })
  })

  it('overwrites supplied fields on an existing item', async () => {
    await db.items.put({ id: 'i1', worldId, name: 'Sword', description: 'old', iconType: 'other', imageId: null, tags: [] })
    const res = await addItemsToWorld(worldId, [{ name: 'sword', icon: 'weapon', description: 'A fine blade' }])
    expect(res).toMatchObject({ added: 0, updated: 1 })
    expect(await db.items.get('i1')).toMatchObject({ iconType: 'weapon', description: 'A fine blade' })
  })
})

describe('parseFactionsSpec', () => {
  it('normalises members into names and {name, role}', () => {
    const json = JSON.stringify({ factions: [
      { name: 'The Watch', members: ['Aria', { name: 'Bran', role: 'Captain' }, { role: 'no name' }, '  '] },
    ]})
    const { factions } = parseFactionsSpec(json)
    expect(factions![0].members).toEqual(['Aria', { name: 'Bran', role: 'Captain' }])
  })

  it('errors on invalid JSON and when nothing usable is present', () => {
    expect(parseFactionsSpec('nope').error).toMatch(/valid JSON/)
    expect(parseFactionsSpec('[]').error).toMatch(/No factions/)
  })
})

describe('addFactionsToWorld', () => {
  const worldId = 'w1'

  beforeEach(async () => {
    await db.delete()
    await db.open()
    await db.worlds.put({ id: worldId, name: 'W', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: 0, updatedAt: 0 })
  })

  async function putChar(id: string, name: string, aliases: string[] = []) {
    await db.characters.put({ id, worldId, name, aliases, description: '', portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: 0, updatedAt: 0 })
  }

  it('adds factions and links members to existing characters by name or alias', async () => {
    await putChar('c-aria', 'Aria Vale', ['The Fox'])
    await putChar('c-bran', 'Bran Holt')
    const res = await addFactionsToWorld(worldId, [
      { name: 'The Watch', description: 'City guard', members: ['The Fox', { name: 'Bran Holt', role: 'Captain' }, 'Nobody'] },
    ])
    expect(res).toMatchObject({ added: 1, skipped: 0 })
    const faction = (await db.factions.where('worldId').equals(worldId).toArray())[0]
    expect(faction).toMatchObject({ name: 'The Watch', description: 'City guard' })
    expect(faction.color).toMatch(/^#/)
    const memberships = await db.factionMemberships.where('worldId').equals(worldId).toArray()
    expect(memberships.map((m) => m.characterId).sort()).toEqual(['c-aria', 'c-bran'])
    expect(memberships.find((m) => m.characterId === 'c-bran')?.role).toBe('Captain')
  })

  it('adds new factions, honours an explicit colour, and leaves unchanged matches', async () => {
    await db.factions.put({ id: 'f0', worldId, name: 'The Watch', description: '', color: '#000', coverImageId: null, tags: [], createdAt: 0, updatedAt: 0 })
    const res = await addFactionsToWorld(worldId, [
      { name: 'the watch' },                    // unchanged match
      { name: 'Mages Guild', color: '#abcdef' },
      { name: 'Mages Guild' },                  // dupe within batch
    ])
    expect(res).toMatchObject({ added: 1, updated: 0, skipped: 2, addedNames: ['Mages Guild'] })
    const guild = (await db.factions.where('worldId').equals(worldId).toArray()).find((f) => f.name === 'Mages Guild')
    expect(guild?.color).toBe('#abcdef')
  })

  it('updates an existing faction in place and unions its members', async () => {
    await putChar('c-aria', 'Aria Vale')
    await putChar('c-bran', 'Bran Holt')
    await db.factions.put({ id: 'f1', worldId, name: 'The Watch', description: 'old', color: '#000', coverImageId: null, tags: [], createdAt: 0, updatedAt: 0 })
    await db.factionMemberships.put({ id: 'm1', worldId, factionId: 'f1', characterId: 'c-aria', role: null, startEventId: null, endEventId: null, notes: '', createdAt: 0, updatedAt: 0 })
    const res = await addFactionsToWorld(worldId, [
      { name: 'the watch', description: 'City guard', members: ['Aria Vale', { name: 'Bran Holt', role: 'Captain' }] },
    ])
    expect(res).toMatchObject({ added: 0, updated: 1 })
    expect(await db.factions.get('f1')).toMatchObject({ description: 'City guard' })
    const memberships = await db.factionMemberships.where('factionId').equals('f1').toArray()
    expect(memberships.map((m) => m.characterId).sort()).toEqual(['c-aria', 'c-bran']) // Aria not duplicated
    expect(memberships.find((m) => m.characterId === 'c-bran')?.role).toBe('Captain')
  })
})

describe('parseRelationshipsSpec', () => {
  it('requires both endpoints and clamps strength/sentiment to known values', () => {
    const json = JSON.stringify({ relationships: [
      { a: 'Aria', b: 'Bran', label: 'rivals', strength: 'bond', sentiment: 'complex' },
      { a: 'Aria', strength: 'weak' },   // missing b — dropped
      { a: 'Aria', b: 'Cid', strength: 'huge', sentiment: 'meh' }, // invalid enums → undefined
    ]})
    const { relationships } = parseRelationshipsSpec(json)
    expect(relationships).toHaveLength(2)
    expect(relationships![0]).toMatchObject({ a: 'Aria', b: 'Bran', label: 'rivals', strength: 'bond', sentiment: 'complex' })
    expect(relationships![1].strength).toBeUndefined()
    expect(relationships![1].sentiment).toBeUndefined()
  })

  it('errors on invalid JSON and when nothing usable is present', () => {
    expect(parseRelationshipsSpec('nope').error).toMatch(/valid JSON/)
    expect(parseRelationshipsSpec('[{"a":"only"}]').error).toMatch(/No relationships/)
  })
})

describe('addRelationshipsToWorld', () => {
  const worldId = 'w1'

  beforeEach(async () => {
    await db.delete()
    await db.open()
    await db.worlds.put({ id: worldId, name: 'W', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: 0, updatedAt: 0 })
  })

  async function putChar(id: string, name: string, aliases: string[] = []) {
    await db.characters.put({ id, worldId, name, aliases, description: '', portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: 0, updatedAt: 0 })
  }

  it('links endpoints by name/alias and applies defaults', async () => {
    await putChar('c-aria', 'Aria Vale', ['The Fox'])
    await putChar('c-bran', 'Bran Holt')
    const res = await addRelationshipsToWorld(worldId, [
      { a: 'The Fox', b: 'Bran Holt', label: 'allies', strength: 'strong', sentiment: 'positive' },
      { a: 'Aria Vale', b: 'Nobody' },   // unknown endpoint — skipped
    ])
    expect(res).toMatchObject({ added: 1, skipped: 1 })
    const rel = (await db.relationships.where('worldId').equals(worldId).toArray())[0]
    expect(rel).toMatchObject({ characterAId: 'c-aria', characterBId: 'c-bran', label: 'allies', strength: 'strong', sentiment: 'positive', isBidirectional: true })
  })

  it('skips self-pairs and leaves an unchanged existing pair (either order)', async () => {
    await putChar('c-a', 'A')
    await putChar('c-b', 'B')
    await db.relationships.put({ id: 'r0', worldId, characterAId: 'c-a', characterBId: 'c-b', label: 'x', strength: 'moderate', sentiment: 'neutral', description: '', isBidirectional: true, startEventId: null, createdAt: 0, updatedAt: 0 })
    const res = await addRelationshipsToWorld(worldId, [
      { a: 'B', b: 'A' },   // reverse of existing, no new fields → unchanged
      { a: 'A', b: 'A' },   // self → skipped
    ])
    expect(res).toMatchObject({ added: 0, updated: 0, skipped: 2 })
  })

  it('updates an existing pair in place (matched in either order)', async () => {
    await putChar('c-a', 'A')
    await putChar('c-b', 'B')
    await db.relationships.put({ id: 'r0', worldId, characterAId: 'c-a', characterBId: 'c-b', label: 'x', strength: 'moderate', sentiment: 'neutral', description: '', isBidirectional: true, startEventId: null, createdAt: 0, updatedAt: 0 })
    const res = await addRelationshipsToWorld(worldId, [{ a: 'B', b: 'A', label: 'rivals', sentiment: 'negative' }])
    expect(res).toMatchObject({ added: 0, updated: 1 })
    expect(await db.relationships.get('r0')).toMatchObject({ label: 'rivals', sentiment: 'negative', strength: 'moderate' })
  })

  it('defaults the label to "connected" when none is given', async () => {
    await putChar('c-a', 'A')
    await putChar('c-b', 'B')
    await addRelationshipsToWorld(worldId, [{ a: 'A', b: 'B' }])
    const rel = (await db.relationships.where('worldId').equals(worldId).toArray())[0]
    expect(rel).toMatchObject({ label: 'connected', strength: 'moderate', sentiment: 'neutral' })
  })

  it('writes per-event snapshots from "changes" and re-runs idempotently', async () => {
    await putChar('c-a', 'A')
    await putChar('c-b', 'B')
    await db.chapters.put({ id: 'ch1', worldId, timelineId: 't', number: 1, title: 'Ch1', synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 })
    await db.events.put({ id: 'e-betray', worldId, chapterId: 'ch1', timelineId: 't', title: 'The Betrayal', description: '', locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], threadIds: [], involvedItemIds: [], tags: [], sortOrder: 0, travelDays: null, inWorldTime: null, tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false, createdAt: 0, updatedAt: 0 })

    const res = await addRelationshipsToWorld(worldId, [
      { a: 'A', b: 'B', label: 'allies', sentiment: 'positive', changes: [
        { at: 'The Betrayal', label: 'enemies', sentiment: 'negative' },
        { at: 'Nowhere', label: 'x' }, // unresolved event — dropped
      ]},
    ])
    expect(res).toMatchObject({ added: 1 })
    const rel = (await db.relationships.where('worldId').equals(worldId).toArray())[0]
    const snaps = await db.relationshipSnapshots.where('relationshipId').equals(rel.id).toArray()
    expect(snaps).toHaveLength(1) // only "The Betrayal" resolved
    // Unspecified fields (strength) inherit the base relationship.
    expect(snaps[0]).toMatchObject({ eventId: 'e-betray', label: 'enemies', sentiment: 'negative', strength: 'moderate', isActive: true })
    expect(snaps[0].sortKey).toBe(1) // chapter 1, sortOrder 0

    // Re-run: the snapshot at that event is updated in place, not duplicated.
    const res2 = await addRelationshipsToWorld(worldId, [
      { a: 'B', b: 'A', changes: [{ at: 'The Betrayal', label: 'rivals', ended: true }] },
    ])
    expect(res2).toMatchObject({ added: 0, updated: 1 })
    const snaps2 = await db.relationshipSnapshots.where('relationshipId').equals(rel.id).toArray()
    expect(snaps2).toHaveLength(1)
    expect(snaps2[0]).toMatchObject({ label: 'rivals', isActive: false, sentiment: 'positive' }) // sentiment inherits base
  })
})

describe('parseLoreSpec', () => {
  it('requires a title and keeps category/body/tags', () => {
    const json = JSON.stringify({ lore: [
      { category: 'Magic', title: 'The Weave', body: '# Magic\nText', tags: ['system'] },
      { body: 'no title' },
    ]})
    const { lore } = parseLoreSpec(json)
    expect(lore).toHaveLength(1)
    expect(lore![0]).toMatchObject({ category: 'Magic', title: 'The Weave', body: '# Magic\nText', tags: ['system'] })
  })

  it('errors on invalid JSON and when nothing usable is present', () => {
    expect(parseLoreSpec('nope').error).toMatch(/valid JSON/)
    expect(parseLoreSpec('[{"body":"x"}]').error).toMatch(/No lore pages/)
  })
})

describe('addLoreToWorld', () => {
  const worldId = 'w1'

  beforeEach(async () => {
    await db.delete()
    await db.open()
    await db.worlds.put({ id: worldId, name: 'W', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: 0, updatedAt: 0 })
  })

  it('creates categories on demand, reuses them, and files pages under them', async () => {
    const res = await addLoreToWorld(worldId, [
      { category: 'Magic', title: 'The Weave', body: 'a' },
      { category: 'Magic', title: 'Wild Magic', body: 'b' },
      { category: 'History', title: 'The Sundering' },
      { title: 'Loose Note' },   // no category → uncategorised
    ])
    expect(res).toMatchObject({ added: 4, skipped: 0 })
    const cats = await db.loreCategories.where('worldId').equals(worldId).toArray()
    expect(cats.map((c) => c.name).sort()).toEqual(['History', 'Magic'])
    const pages = await db.lorePages.where('worldId').equals(worldId).toArray()
    const magicId = cats.find((c) => c.name === 'Magic')!.id
    expect(pages.filter((p) => p.categoryId === magicId)).toHaveLength(2)
    expect(pages.find((p) => p.title === 'Loose Note')!.categoryId).toBeNull()
  })

  it('reuses an existing category by name and leaves unchanged page titles', async () => {
    await db.loreCategories.put({ id: 'cat-magic', worldId, name: 'Magic', color: null, sortOrder: 0 })
    await db.lorePages.put({ id: 'p0', worldId, categoryId: 'cat-magic', title: 'The Weave', body: '', tags: [], coverImageId: null, linkedEntityIds: [], visibleFromEventId: null, createdAt: 0, updatedAt: 0 })
    const res = await addLoreToWorld(worldId, [
      { category: 'magic', title: 'the weave' },   // same category, no body → unchanged
      { category: 'Magic', title: 'Runes' },        // reuse existing category
      { category: 'Magic', title: 'Runes' },        // dupe within batch
    ])
    expect(res).toMatchObject({ added: 1, updated: 0, skipped: 2, addedNames: ['Runes'] })
    const cats = await db.loreCategories.where('worldId').equals(worldId).toArray()
    expect(cats).toHaveLength(1) // no new "Magic" category created
    const runes = (await db.lorePages.where('worldId').equals(worldId).toArray()).find((p) => p.title === 'Runes')
    expect(runes?.categoryId).toBe('cat-magic')
  })

  it('updates an existing page body and can refile its category', async () => {
    await db.loreCategories.put({ id: 'cat-hist', worldId, name: 'History', color: null, sortOrder: 0 })
    await db.lorePages.put({ id: 'p0', worldId, categoryId: null, title: 'The Weave', body: 'old', tags: [], coverImageId: null, linkedEntityIds: [], visibleFromEventId: null, createdAt: 0, updatedAt: 0 })
    const res = await addLoreToWorld(worldId, [{ title: 'the weave', body: 'new body', category: 'History' }])
    expect(res).toMatchObject({ added: 0, updated: 1 })
    expect(await db.lorePages.get('p0')).toMatchObject({ body: 'new body', categoryId: 'cat-hist' })
  })
})

describe('parseKnowledgeSpec', () => {
  it('requires a title and keeps well-formed reveals only', () => {
    const json = JSON.stringify({ knowledge: [
      { title: 'The king is dead', origin: 'The Murder', readerLearnsAt: 'The Reveal',
        revealedTo: [{ who: 'Aria', at: 'The Murder' }, { who: 'Bran' }, { at: 'x' }] },
      { description: 'no title' },
    ]})
    const { knowledge } = parseKnowledgeSpec(json)
    expect(knowledge).toHaveLength(1)
    expect(knowledge![0]).toMatchObject({ title: 'The king is dead', origin: 'The Murder', readerLearnsAt: 'The Reveal' })
    expect(knowledge![0].revealedTo).toEqual([{ who: 'Aria', at: 'The Murder' }])
  })

  it('errors on invalid JSON and when nothing usable is present', () => {
    expect(parseKnowledgeSpec('nope').error).toMatch(/valid JSON/)
    expect(parseKnowledgeSpec('[{"description":"x"}]').error).toMatch(/No knowledge facts/)
  })
})

describe('addKnowledgeToWorld', () => {
  const worldId = 'w1'

  beforeEach(async () => {
    await db.delete()
    await db.open()
    await db.worlds.put({ id: worldId, name: 'W', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: 0, updatedAt: 0 })
  })

  async function putChar(id: string, name: string, aliases: string[] = []) {
    await db.characters.put({ id, worldId, name, aliases, description: '', portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: 0, updatedAt: 0 })
  }
  async function putEvent(id: string, title: string) {
    await db.events.put({ id, worldId, chapterId: 'ch', timelineId: 't', title, description: '', locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], threadIds: [], involvedItemIds: [], tags: [], sortOrder: 0, travelDays: null, inWorldTime: null, tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false, createdAt: 0, updatedAt: 0 })
  }

  it('links origin/reader events by title and reveals by character + event', async () => {
    await putChar('c-aria', 'Aria Vale', ['The Fox'])
    await putEvent('e-murder', 'The Murder')
    await putEvent('e-reveal', 'The Reveal')
    const res = await addKnowledgeToWorld(worldId, [
      { title: 'The king is dead', origin: 'The Murder', readerLearnsAt: 'The Reveal',
        revealedTo: [{ who: 'The Fox', at: 'The Murder' }, { who: 'Ghost', at: 'The Reveal' }] },
    ])
    expect(res).toMatchObject({ added: 1, skipped: 0 })
    const fact = (await db.knowledgeFacts.where('worldId').equals(worldId).toArray())[0]
    expect(fact).toMatchObject({ title: 'The king is dead', originEventId: 'e-murder', readerLearnsAtEventId: 'e-reveal' })
    const reveals = await db.knowledgeReveals.where('worldId').equals(worldId).toArray()
    expect(reveals).toHaveLength(1) // "Ghost" doesn't resolve, so only Aria's reveal is kept
    expect(reveals[0]).toMatchObject({ characterId: 'c-aria', eventId: 'e-murder' })
  })

  it('still creates the fact when event references do not resolve', async () => {
    const res = await addKnowledgeToWorld(worldId, [{ title: 'A secret', origin: 'Nonexistent Event' }])
    expect(res.added).toBe(1)
    const fact = (await db.knowledgeFacts.where('worldId').equals(worldId).toArray())[0]
    expect(fact).toMatchObject({ title: 'A secret', originEventId: null, readerLearnsAtEventId: null })
  })

  it('adds new fact titles and leaves an unchanged match and in-batch repeat', async () => {
    await db.knowledgeFacts.put({ id: 'f0', worldId, title: 'A secret', description: '', tags: [], readerLearnsAtEventId: null, originEventId: null, createdAt: 0, updatedAt: 0 })
    const res = await addKnowledgeToWorld(worldId, [{ title: 'a secret' }, { title: 'New one' }, { title: 'New one' }])
    expect(res).toMatchObject({ added: 1, updated: 0, skipped: 2, addedNames: ['New one'] })
  })

  it('updates an existing fact in place and unions its reveals', async () => {
    await putChar('c-aria', 'Aria Vale')
    await putEvent('e-murder', 'The Murder')
    await db.knowledgeFacts.put({ id: 'f1', worldId, title: 'The king is dead', description: 'old', tags: [], readerLearnsAtEventId: null, originEventId: null, createdAt: 0, updatedAt: 0 })
    const res = await addKnowledgeToWorld(worldId, [
      { title: 'the king is dead', description: 'A guarded secret', origin: 'The Murder', revealedTo: [{ who: 'Aria Vale', at: 'The Murder' }] },
    ])
    expect(res).toMatchObject({ added: 0, updated: 1 })
    expect(await db.knowledgeFacts.get('f1')).toMatchObject({ description: 'A guarded secret', originEventId: 'e-murder' })
    const reveals = await db.knowledgeReveals.where('factId').equals('f1').toArray()
    expect(reveals).toHaveLength(1)
    expect(reveals[0]).toMatchObject({ characterId: 'c-aria', eventId: 'e-murder' })
  })
})

describe('parseLocationsSpec / countLocations', () => {
  it('parses a nested tree, dropping nameless nodes', () => {
    const json = JSON.stringify({ locations: [
      { name: 'Aethel', type: 'region', children: [
        { name: 'Ironhold', type: 'city', children: [{ name: 'The Keep' }, { description: 'no name' }] },
        { name: 'Greywood' },
      ]},
      { name: '   ' },
    ]})
    const { locations, error } = parseLocationsSpec(json)
    expect(error).toBeUndefined()
    expect(locations).toHaveLength(1)
    expect(locations![0].children).toHaveLength(2)
    expect(locations![0].children![0].children).toEqual([{ name: 'The Keep', description: undefined, type: undefined, children: undefined }])
    expect(countLocations(locations!)).toBe(4) // Aethel, Ironhold, The Keep, Greywood
  })

  it('parses a place with "levels" and counts the floor locations', () => {
    const json = JSON.stringify({ locations: [
      { name: 'Castle', type: 'building', levels: [
        { name: 'Ground floor', children: [{ name: 'Great Hall' }, { name: '  ' }] },
        { name: 'First floor', children: [{ name: 'Library' }] },
        { description: 'no name' },
      ]},
    ]})
    const { locations, error } = parseLocationsSpec(json)
    expect(error).toBeUndefined()
    expect(locations![0].levels).toHaveLength(2) // nameless level dropped
    expect(locations![0].levels![0].children!.map((c) => c.name)).toEqual(['Great Hall'])
    // Castle + Great Hall + Library.
    expect(countLocations(locations!)).toBe(3)
  })

  it('errors on invalid JSON and when nothing usable is present', () => {
    expect(parseLocationsSpec('nope').error).toMatch(/valid JSON/)
    expect(parseLocationsSpec('[{"description":"x"}]').error).toMatch(/No locations/)
  })

  it('unwraps a stray "Locations" root, promoting its children to the top level', () => {
    const json = JSON.stringify({ locations: [
      { name: 'Locations', children: [
        { name: 'Aethelgard', children: [{ name: 'Ironhold' }] },
        { name: 'Suden Reach' },
      ]},
    ]})
    const { locations } = parseLocationsSpec(json)
    expect(locations!.map((l) => l.name)).toEqual(['Aethelgard', 'Suden Reach'])
    expect(locations![0].children!.map((c) => c.name)).toEqual(['Ironhold'])
    expect(countLocations(locations!)).toBe(3) // the wrapper is gone
  })

  it('drops a bare "Locations" node but keeps real siblings', () => {
    const { locations } = parseLocationsSpec(JSON.stringify({ locations: [
      { name: 'locations' }, // case-insensitive, no children → dropped
      { name: 'Aethelgard' },
    ]}))
    expect(locations!.map((l) => l.name)).toEqual(['Aethelgard'])
  })
})

describe('formatLocationTree', () => {
  it('renders markers as an indented tree following sub-map links', () => {
    const layers = [
      { id: 'root', parentMapId: null },
      { id: 'sub-aethel', parentMapId: 'root' },
    ]
    const markers = [
      { name: 'Aethelgard', mapLayerId: 'root', linkedMapLayerId: 'sub-aethel' },
      { name: 'Suden Reach', mapLayerId: 'root', linkedMapLayerId: null },
      { name: 'Ironhold', mapLayerId: 'sub-aethel', linkedMapLayerId: null },
      { name: 'Greywood', mapLayerId: 'sub-aethel', linkedMapLayerId: null },
    ]
    expect(formatLocationTree(layers, markers)).toBe(
      ['- Aethelgard', '  - Ironhold', '  - Greywood', '- Suden Reach'].join('\n')
    )
  })

  it('returns empty string when there are no markers', () => {
    expect(formatLocationTree([{ id: 'root', parentMapId: null }], [])).toBe('')
  })

  it('shows a leveled place as floor headers with each floor\'s own locations', () => {
    // A castle (sub-map of the root) that is a level group with two floors.
    const layers = [
      { id: 'root', parentMapId: null },
      { id: 'ground', parentMapId: 'root', levelGroupId: 'G', levelIndex: 0, levelLabel: 'Ground floor' },
      { id: 'first', parentMapId: 'root', levelGroupId: 'G', levelIndex: 1, levelLabel: 'First floor' },
    ]
    const markers = [
      { name: 'Hogwarts Castle', mapLayerId: 'root', linkedMapLayerId: 'ground' },
      { name: 'Great Hall', mapLayerId: 'ground', linkedMapLayerId: null },
      { name: 'Library', mapLayerId: 'first', linkedMapLayerId: null },
    ]
    expect(formatLocationTree(layers, markers)).toBe(
      [
        '- Hogwarts Castle',
        '  [Ground floor]',
        '    - Great Hall',
        '  [First floor]',
        '    - Library',
      ].join('\n'),
    )
  })
})

describe('addLocationsToWorld', () => {
  const worldId = 'w1'
  // Inject a fake placeholder image so tests don't need a real canvas.
  const fakeImage = async () => ({ blob: new Blob(['x'], { type: 'image/png' }), width: 1600, height: 1000 })

  beforeEach(async () => {
    await db.delete()
    await db.open()
    await db.worlds.put({ id: worldId, name: 'W', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: 0, updatedAt: 0 })
  })

  it('creates a Locations map with markers and a linked sub-map for children', async () => {
    const res = await addLocationsToWorld(worldId, [
      { name: 'Aethel', type: 'region', children: [
        { name: 'Ironhold', type: 'city' },
        { name: 'Greywood', type: 'town' },
      ]},
    ], fakeImage)
    expect(res).toMatchObject({ added: 3, updated: 0 })

    const layers = await db.mapLayers.where('worldId').equals(worldId).toArray()
    const root = layers.find((l) => l.parentMapId === null)!
    expect(root.name).toBe(LOCATIONS_MAP_NAME)

    const rootMarkers = await db.locationMarkers.where('mapLayerId').equals(root.id).toArray()
    expect(rootMarkers.map((m) => m.name)).toEqual(['Aethel'])
    const aethel = rootMarkers[0]
    // Aethel drills into a sub-map holding its children.
    const sub = layers.find((l) => l.id === aethel.linkedMapLayerId)!
    expect(sub.parentMapId).toBe(root.id)
    const subMarkers = await db.locationMarkers.where('mapLayerId').equals(sub.id).toArray()
    expect(subMarkers.map((m) => m.name).sort()).toEqual(['Greywood', 'Ironhold'])
    // Markers sit within the map bounds.
    for (const m of [...rootMarkers, ...subMarkers]) {
      expect(m.x).toBeGreaterThanOrEqual(0)
      expect(m.x).toBeLessThanOrEqual(root.imageWidth)
      expect(m.y).toBeGreaterThanOrEqual(0)
      expect(m.y).toBeLessThanOrEqual(root.imageHeight)
    }
  })

  it('reuses the Locations map on re-run, extending the tree without duplicating', async () => {
    await addLocationsToWorld(worldId, [{ name: 'Aethel', children: [{ name: 'Ironhold' }] }], fakeImage)
    const res = await addLocationsToWorld(worldId, [
      { name: 'Aethel', description: 'A northern realm', children: [{ name: 'Ironhold' }, { name: 'Greywood' }] },
      { name: 'Suden' },
    ], fakeImage)
    // Aethel updated (gained a description), Greywood + Suden added, Ironhold unchanged.
    expect(res).toMatchObject({ added: 2, updated: 1 })

    const roots = (await db.mapLayers.where('worldId').equals(worldId).toArray()).filter((l) => l.parentMapId === null)
    expect(roots).toHaveLength(1) // no second Locations map
    const rootMarkers = await db.locationMarkers.where('mapLayerId').equals(roots[0].id).toArray()
    expect(rootMarkers.map((m) => m.name).sort()).toEqual(['Aethel', 'Suden'])
    const aethel = rootMarkers.find((m) => m.name === 'Aethel')!
    expect(aethel.description).toBe('A northern realm')
    const subMarkers = await db.locationMarkers.where('mapLayerId').equals(aethel.linkedMapLayerId!).toArray()
    expect(subMarkers.map((m) => m.name).sort()).toEqual(['Greywood', 'Ironhold']) // Ironhold not duplicated
  })

  it('never duplicates a place, even when the AI re-nests it under a different parent', async () => {
    // First run: London › Diagon Alley
    await addLocationsToWorld(worldId, [{ name: 'London', children: [{ name: 'Diagon Alley' }] }], fakeImage)

    // Re-run: the AI moves Diagon Alley under a new "The Leaky Cauldron" and adds a shop.
    const res = await addLocationsToWorld(worldId, [
      { name: 'London', children: [
        { name: 'The Leaky Cauldron', children: [
          { name: 'Diagon Alley', children: [{ name: 'Flourish and Blotts' }] },
        ]},
      ]},
    ], fakeImage)

    const all = await db.locationMarkers.where('worldId').equals(worldId).toArray()
    // Each place exists exactly once, despite the re-nesting.
    expect(all.filter((m) => m.name === 'Diagon Alley')).toHaveLength(1)
    expect(all.filter((m) => m.name === 'London')).toHaveLength(1)
    // Diagon Alley stayed where it first was; the new shop landed under it.
    const diagon = all.find((m) => m.name === 'Diagon Alley')!
    const flourish = all.find((m) => m.name === 'Flourish and Blotts')!
    expect(flourish.mapLayerId).toBe(diagon.linkedMapLayerId)
    // Only the genuinely new places are added.
    expect(res.addedNames.sort()).toEqual(['Flourish and Blotts', 'The Leaky Cauldron'])
  })

  it('adds a sub-map when an existing leaf later gains children', async () => {
    await addLocationsToWorld(worldId, [{ name: 'Ironhold' }], fakeImage)
    let markers = await db.locationMarkers.where('worldId').equals(worldId).toArray()
    expect(markers[0].linkedMapLayerId).toBeNull()

    const res = await addLocationsToWorld(worldId, [{ name: 'Ironhold', children: [{ name: 'The Keep' }] }], fakeImage)
    expect(res).toMatchObject({ added: 1, updated: 1 }) // The Keep added, Ironhold linked
    markers = await db.locationMarkers.where('worldId').equals(worldId).toArray()
    const ironhold = markers.find((m) => m.name === 'Ironhold')!
    expect(ironhold.linkedMapLayerId).not.toBeNull()
    const children = await db.locationMarkers.where('mapLayerId').equals(ironhold.linkedMapLayerId!).toArray()
    expect(children.map((m) => m.name)).toEqual(['The Keep'])
  })

  it('builds a level group from a place with "levels", each floor holding its own locations', async () => {
    const res = await addLocationsToWorld(worldId, [
      { name: 'Hogwarts Castle', type: 'building', levels: [
        { name: 'Ground floor', children: [{ name: 'Great Hall' }] },
        { name: 'First floor', children: [{ name: 'Library' }] },
      ]},
    ], fakeImage)
    // Castle + Great Hall + Library.
    expect(res).toMatchObject({ added: 3 })

    const layers = await db.mapLayers.where('worldId').equals(worldId).toArray()
    const root = layers.find((l) => l.parentMapId === null)!
    const castle = (await db.locationMarkers.where('mapLayerId').equals(root.id).toArray())[0]
    expect(castle.name).toBe('Hogwarts Castle')

    // The castle drills into its ground floor (the group representative).
    const ground = layers.find((l) => l.id === castle.linkedMapLayerId)!
    expect(ground.levelGroupId).toBeTruthy()
    expect(ground.levelIndex).toBe(0)
    expect(ground.levelLabel).toBe('Ground floor')
    expect(ground.parentMapId).toBe(root.id)

    const floors = layers.filter((l) => l.levelGroupId === ground.levelGroupId)
    expect(floors).toHaveLength(2)
    const first = floors.find((l) => l.levelIndex === 1)!
    expect(first.levelLabel).toBe('First floor')
    expect(first.parentMapId).toBe(root.id)

    // Each floor keeps its own locations.
    const groundMarkers = await db.locationMarkers.where('mapLayerId').equals(ground.id).toArray()
    const firstMarkers = await db.locationMarkers.where('mapLayerId').equals(first.id).toArray()
    expect(groundMarkers.map((m) => m.name)).toEqual(['Great Hall'])
    expect(firstMarkers.map((m) => m.name)).toEqual(['Library'])
  })

  it('is idempotent: re-running the same levels reuses floors instead of duplicating', async () => {
    const spec = [
      { name: 'Keep', type: 'building', levels: [
        { name: 'Cellar', children: [{ name: 'Wine Store' }] },
        { name: 'Hall', children: [{ name: 'Throne Room' }] },
      ]},
    ]
    await addLocationsToWorld(worldId, spec, fakeImage)
    const res2 = await addLocationsToWorld(worldId, spec, fakeImage)
    expect(res2.added).toBe(0) // nothing new the second time

    const layers = await db.mapLayers.where('worldId').equals(worldId).toArray()
    const groupIds = new Set(layers.filter((l) => l.levelGroupId).map((l) => l.levelGroupId))
    expect(groupIds.size).toBe(1) // one group
    expect(layers.filter((l) => l.levelGroupId).length).toBe(2) // still two floors, not four
    const markers = await db.locationMarkers.where('worldId').equals(worldId).toArray()
    expect(markers.filter((m) => m.name === 'Throne Room')).toHaveLength(1)
  })

  it('adds a new floor to an existing level group on a later run', async () => {
    await addLocationsToWorld(worldId, [
      { name: 'Tower', type: 'building', levels: [{ name: 'Base', children: [{ name: 'Gate' }] }] },
    ], fakeImage)
    // Second run adds an upper floor to the same tower.
    await addLocationsToWorld(worldId, [
      { name: 'Tower', type: 'building', levels: [
        { name: 'Base', children: [{ name: 'Gate' }] },
        { name: 'Top', children: [{ name: 'Beacon' }] },
      ]},
    ], fakeImage)

    const layers = await db.mapLayers.where('worldId').equals(worldId).toArray()
    const floors = layers.filter((l) => l.levelGroupId)
    expect(floors).toHaveLength(2)
    expect(floors.map((l) => l.levelLabel).sort()).toEqual(['Base', 'Top'])
    const beacon = (await db.locationMarkers.where('worldId').equals(worldId).toArray()).find((m) => m.name === 'Beacon')!
    const top = floors.find((l) => l.levelLabel === 'Top')!
    expect(beacon.mapLayerId).toBe(top.id)
  })
})
