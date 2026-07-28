import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/database'
import { importWorldFromJson } from '@/lib/exportImport'
import { GOAL_TYPE_CONFIG, summariseGoals } from '@/lib/characterGoals'

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
        expect(ev).toHaveProperty('tension')
        expect(ev.tension === null || (Number.isInteger(ev.tension) && ev.tension >= 1 && ev.tension <= 5)).toBe(true)
        expect(ev).toHaveProperty('structureBeat')
        expect(ev.structureBeat === null || typeof ev.structureBeat === 'string').toBe(true)
        expect(Array.isArray(ev.mentionedCharacterIds)).toBe(true)
        expect(Array.isArray(ev.threadIds)).toBe(true)
      }

      // Chapters gained a wordGoal after these files were exported — backfilled to null.
      const chapters = await db.chapters.where('worldId').equals(worldId).toArray()
      expect(chapters.length).toBeGreaterThan(0)
      for (const ch of chapters) {
        expect(ch.wordGoal).toBeNull()
      }

      // Map layers gained level (floor) fields after these files were exported —
      // Legacy standalone maps retain their backfilled defaults; enriched
      // examples may also contain real floor groups with unique indices.
      const mapLayers = await db.mapLayers.where('worldId').equals(worldId).toArray()
      const levelGroups = new Map<string, typeof mapLayers>()
      for (const l of mapLayers) {
        if (l.levelGroupId === null) {
          expect(l.levelIndex).toBe(0)
          expect(l.levelLabel).toBe('')
        } else {
          expect(Number.isInteger(l.levelIndex)).toBe(true)
          expect(l.levelLabel.trim().length).toBeGreaterThan(0)
          const group = levelGroups.get(l.levelGroupId) ?? []
          group.push(l)
          levelGroups.set(l.levelGroupId, group)
        }
        expect(l.parentMapId === null || typeof l.parentMapId === 'string').toBe(true)
      }
      for (const group of levelGroups.values()) {
        expect(new Set(group.map((layer) => layer.levelIndex)).size).toBe(group.length)
      }

      // Older examples may leave lore, factions, and knowledge empty, while
      // enriched examples can populate them. Their cross-references must
      // resolve within the imported world.
      const loreCategories = await db.loreCategories.where('worldId').equals(worldId).toArray()
      const loreCategoryIds = new Set(loreCategories.map((category) => category.id))
      const lorePages = await db.lorePages.where('worldId').equals(worldId).toArray()
      for (const page of lorePages) {
        if (page.categoryId !== null) expect(loreCategoryIds.has(page.categoryId)).toBe(true)
      }

      const factions = await db.factions.where('worldId').equals(worldId).toArray()
      const factionIds = new Set(factions.map((faction) => faction.id))
      const memberships = await db.factionMemberships.where('worldId').equals(worldId).toArray()
      for (const membership of memberships) expect(factionIds.has(membership.factionId)).toBe(true)

      const knowledgeFacts = await db.knowledgeFacts.where('worldId').equals(worldId).toArray()
      const knowledgeFactIds = new Set(knowledgeFacts.map((fact) => fact.id))
      const knowledgeReveals = await db.knowledgeReveals.where('worldId').equals(worldId).toArray()
      for (const reveal of knowledgeReveals) expect(knowledgeFactIds.has(reveal.factId)).toBe(true)
      expect(await db.sceneTexts.where('worldId').equals(worldId).count()).toBe(0)
      // Older examples may have no plot threads, while enriched examples can
      // include them. Every event assignment must resolve within its world.
      const plotThreads = await db.plotThreads.where('worldId').equals(worldId).toArray()
      const plotThreadIds = new Set(plotThreads.map((thread) => thread.id))
      for (const ev of events) {
        for (const threadId of ev.threadIds) expect(plotThreadIds.has(threadId)).toBe(true)
      }

      // Goal formatting is used eagerly by the Arc view, so malformed goal
      // types or missing text must never make it into a bundled example.
      const characterIds = new Set((await db.characters.where('worldId').equals(worldId).toArray()).map((char) => char.id))
      const eventIds = new Set(events.map((event) => event.id))
      const characterGoals = await db.characterGoals.where('worldId').equals(worldId).toArray()
      for (const goal of characterGoals) {
        expect(GOAL_TYPE_CONFIG[goal.type]).toBeDefined()
        expect(goal.text.trim().length).toBeGreaterThan(0)
        expect(characterIds.has(goal.characterId)).toBe(true)
        if (goal.startEventId !== null) expect(eventIds.has(goal.startEventId)).toBe(true)
        if (goal.endEventId !== null) expect(eventIds.has(goal.endEventId)).toBe(true)
      }
      expect(() => summariseGoals(characterGoals)).not.toThrow()
    })
  }
})
