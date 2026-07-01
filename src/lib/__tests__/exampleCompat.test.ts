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
      }

      // Knowledge tables exist and default to empty for pre-feature exports.
      expect(await db.knowledgeFacts.where('worldId').equals(worldId).count()).toBe(0)
      expect(await db.knowledgeReveals.where('worldId').equals(worldId).count()).toBe(0)
    })
  }
})
