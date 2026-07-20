import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld, updateWorld } from '@/db/hooks/useWorlds'
import { createCharacter, updateCharacter } from '@/db/hooks/useCharacters'
import { collectWorldData, importWorldFromJson } from '@/lib/exportImport'
import { defaultCalendar } from '@/lib/calendar'
import type { WorldCalendar, InWorldDate } from '@/types'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

const cal: WorldCalendar = {
  startYear: 998,
  yearSuffix: 'AC',
  months: [{ name: 'Frost', days: 30 }, { name: 'Bloom', days: 31 }, { name: 'Harvest', days: 29 }],
}
const birth: InWorldDate = { year: 980, month: 1, day: 12 }

describe('export/import — calendar and birth date', () => {
  it('defaults are null on creation', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    const char = await createCharacter({ worldId: world.id, name: 'Ada', description: '' })
    expect(world.calendar).toBeNull()
    expect(char.birthDate).toBeNull()
  })

  it('persists a calendar and a character birth date', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    await updateWorld(world.id, { calendar: cal })
    const char = await createCharacter({ worldId: world.id, name: 'Ada', description: '' })
    await updateCharacter(char.id, { birthDate: birth })

    const storedWorld = (await db.worlds.get(world.id))!
    const storedChar = (await db.characters.get(char.id))!
    expect(storedWorld.calendar).toEqual(cal)
    expect(storedChar.birthDate).toEqual(birth)
  })

  it('survives a full export → import round-trip', async () => {
    const world = await createWorld({ name: 'Westeros', description: '' })
    await updateWorld(world.id, { calendar: cal })
    const char = await createCharacter({ worldId: world.id, name: 'Ada', description: '' })
    await updateCharacter(char.id, { birthDate: birth })

    const collected = await collectWorldData(world.id)
    const json = JSON.stringify({ version: 2, exportedAt: Date.now(), ...collected, blobs: [] })
    await db.delete(); await db.open()
    await importWorldFromJson(json)

    const rw = (await db.worlds.toArray())[0]
    const rc = (await db.characters.toArray())[0]
    expect(rw.calendar).toEqual(cal)
    expect(rc.birthDate).toEqual(birth)
  })

  it('backfills calendar/birthDate on a legacy export that predates them', async () => {
    const file = {
      version: 2, exportedAt: Date.now(),
      world: { id: 'w-legacy', name: 'Legacy', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: 1, updatedAt: 1 },
      mapLayers: [],
      locationMarkers: [],
      characters: [{ id: 'c1', worldId: 'w-legacy', name: 'Old', aliases: [], description: '', portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: 1, updatedAt: 1 }],
      items: [], characterSnapshots: [], characterMovements: [],
      itemPlacements: [], locationSnapshots: [], itemSnapshots: [], relationships: [], relationshipSnapshots: [],
      timelines: [], chapters: [], events: [], blobs: [], travelModes: [], timelineRelationships: [],
      crossTimelineArtifacts: [], mapRoutes: [], mapRegions: [], mapRegionSnapshots: [], mapAnnotations: [],
      loreCategories: [], lorePages: [], factions: [], factionMemberships: [], factionRelationships: [],
    }
    await importWorldFromJson(JSON.stringify(file))

    const w = (await db.worlds.get('w-legacy'))!
    const c = (await db.characters.get('c1'))!
    expect(w.calendar).toBeNull()
    expect(c.birthDate).toBeNull()
  })

  it('defaultCalendar is a usable 12-month year', () => {
    expect(defaultCalendar().months).toHaveLength(12)
  })
})
