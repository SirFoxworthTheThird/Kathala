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

  it('skips names already present (case-insensitive) and repeats within the batch', async () => {
    await db.items.put({ id: 'x', worldId, name: 'Sword', description: '', iconType: 'weapon', imageId: null, tags: [] })
    const res = await addItemsToWorld(worldId, [{ name: 'sword' }, { name: 'Shield' }, { name: 'Shield' }])
    expect(res).toMatchObject({ added: 1, skipped: 2, addedNames: ['Shield'] })
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

  it('skips duplicate faction names and honours an explicit colour', async () => {
    await db.factions.put({ id: 'f0', worldId, name: 'The Watch', description: '', color: '#000', coverImageId: null, tags: [], createdAt: 0, updatedAt: 0 })
    const res = await addFactionsToWorld(worldId, [
      { name: 'the watch' },                    // dupe
      { name: 'Mages Guild', color: '#abcdef' },
      { name: 'Mages Guild' },                  // dupe within batch
    ])
    expect(res).toMatchObject({ added: 1, skipped: 2, addedNames: ['Mages Guild'] })
    const guild = (await db.factions.where('worldId').equals(worldId).toArray()).find((f) => f.name === 'Mages Guild')
    expect(guild?.color).toBe('#abcdef')
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

  it('skips self-pairs and pairs that already have a relationship (either order)', async () => {
    await putChar('c-a', 'A')
    await putChar('c-b', 'B')
    await db.relationships.put({ id: 'r0', worldId, characterAId: 'c-a', characterBId: 'c-b', label: 'x', strength: 'moderate', sentiment: 'neutral', description: '', isBidirectional: true, startEventId: null, createdAt: 0, updatedAt: 0 })
    const res = await addRelationshipsToWorld(worldId, [
      { a: 'B', b: 'A' },   // reverse of existing → skipped
      { a: 'A', b: 'A' },   // self → skipped
    ])
    expect(res).toMatchObject({ added: 0, skipped: 2 })
  })

  it('defaults the label to "connected" when none is given', async () => {
    await putChar('c-a', 'A')
    await putChar('c-b', 'B')
    await addRelationshipsToWorld(worldId, [{ a: 'A', b: 'B' }])
    const rel = (await db.relationships.where('worldId').equals(worldId).toArray())[0]
    expect(rel).toMatchObject({ label: 'connected', strength: 'moderate', sentiment: 'neutral' })
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

  it('reuses an existing category by name and skips duplicate page titles', async () => {
    await db.loreCategories.put({ id: 'cat-magic', worldId, name: 'Magic', color: null, sortOrder: 0 })
    await db.lorePages.put({ id: 'p0', worldId, categoryId: 'cat-magic', title: 'The Weave', body: '', tags: [], coverImageId: null, linkedEntityIds: [], visibleFromEventId: null, createdAt: 0, updatedAt: 0 })
    const res = await addLoreToWorld(worldId, [
      { category: 'magic', title: 'the weave' },   // dupe title
      { category: 'Magic', title: 'Runes' },        // reuse existing category
      { category: 'Magic', title: 'Runes' },        // dupe within batch
    ])
    expect(res).toMatchObject({ added: 1, skipped: 2, addedNames: ['Runes'] })
    const cats = await db.loreCategories.where('worldId').equals(worldId).toArray()
    expect(cats).toHaveLength(1) // no new "Magic" category created
    const runes = (await db.lorePages.where('worldId').equals(worldId).toArray()).find((p) => p.title === 'Runes')
    expect(runes?.categoryId).toBe('cat-magic')
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

  it('skips duplicate fact titles (case-insensitive) and repeats within the batch', async () => {
    await db.knowledgeFacts.put({ id: 'f0', worldId, title: 'A secret', description: '', tags: [], readerLearnsAtEventId: null, originEventId: null, createdAt: 0, updatedAt: 0 })
    const res = await addKnowledgeToWorld(worldId, [{ title: 'a secret' }, { title: 'New one' }, { title: 'New one' }])
    expect(res).toMatchObject({ added: 1, skipped: 2, addedNames: ['New one'] })
  })
})
