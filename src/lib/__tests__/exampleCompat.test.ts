import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/database'
import { importWorldFromJson } from '@/lib/exportImport'

// The shipped example worlds (in /example) must keep importing as the schema
// and export format evolve. These are older exports (v7), so this also
// exercises the backfill of every field/array added since. Loaded via Vite's
// raw glob import so the test needs no Node fs types.
const examples = import.meta.glob('/example/*.pwk', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('bundled example worlds stay importable', () => {
  const entries = Object.entries(examples)

  it('finds the bundled example files', () => {
    expect(entries.length).toBeGreaterThanOrEqual(2)
  })

  for (const [path, json] of entries) {
    it(`imports ${path} without error and backfills new fields`, async () => {
      const worldId = await importWorldFromJson(json)
      expect(typeof worldId).toBe('string')
      expect(await db.worlds.get(worldId)).toBeDefined()

      // Fields added after these files were exported are backfilled on every event.
      const events = await db.events.where('worldId').equals(worldId).toArray()
      expect(events.length).toBeGreaterThan(0)
      for (const ev of events) {
        expect(ev).toHaveProperty('travelDays')
        expect(ev).toHaveProperty('isFlashback')
        expect(ev).toHaveProperty('inWorldTime')
        // Backfilled by later versions — must be present and null on old exports.
        expect(ev.tension).toBeNull()
        expect(ev.structureBeat).toBeNull()
        expect(ev.mentionedCharacterIds).toEqual([])
        expect(ev.threadIds).toEqual([])
      }

      // Chapters gained a wordGoal after these files were exported — backfilled to null.
      const chapters = await db.chapters.where('worldId').equals(worldId).toArray()
      expect(chapters.length).toBeGreaterThan(0)
      for (const ch of chapters) {
        expect(ch.wordGoal).toBeNull()
      }

      // Map layers gained level (floor) fields after these files were exported —
      // backfilled so every layer imports as a standalone map, and parentMapId
      // normalised to null (v43/v44). No fix to the example files needed.
      const mapLayers = await db.mapLayers.where('worldId').equals(worldId).toArray()
      for (const l of mapLayers) {
        expect(l.levelGroupId).toBeNull()
        expect(l.levelIndex).toBe(0)
        expect(l.levelLabel).toBe('')
        expect(l.parentMapId === null || typeof l.parentMapId === 'string').toBe(true)
      }

      // Knowledge and manuscript tables exist and default to empty for pre-feature exports.
      expect(await db.knowledgeFacts.where('worldId').equals(worldId).count()).toBe(0)
      expect(await db.knowledgeReveals.where('worldId').equals(worldId).count()).toBe(0)
      expect(await db.sceneTexts.where('worldId').equals(worldId).count()).toBe(0)
      // Plot threads were added later, so old exports have none.
      expect(await db.plotThreads.where('worldId').equals(worldId).count()).toBe(0)
    })
  }
})
