import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { applyWorldImport, type WorldExportFile } from '@/lib/exportImport'
import { db } from '@/db/database'

/**
 * Two copies of a world edited apart, then brought back together — the whole
 * point of issue #118, exercised through the real import path rather than the
 * merge helper on its own.
 *
 * These are the acceptance criteria that can be checked without a server: a
 * `.pwk` from another device stands in for what a sync would deliver, since it
 * carries exactly the same thing — the state that device arrived at.
 */

const WORLD = 'w-diverge'

function exportFile(over: Partial<WorldExportFile> = {}): WorldExportFile {
  return {
    version: 2,
    exportedAt: Date.now(),
    world: {
      id: WORLD, name: 'Divergent World', description: '', coverImageId: null,
      theme: null, continuityStaleThreshold: 5, createdAt: 1_000, updatedAt: 1_000,
    },
    mapLayers: [], locationMarkers: [], characters: [], items: [],
    characterSnapshots: [], characterMovements: [], itemPlacements: [],
    locationSnapshots: [], itemSnapshots: [], relationships: [],
    relationshipSnapshots: [], timelines: [], chapters: [], events: [],
    blobs: [], travelModes: [], timelineRelationships: [],
    crossTimelineArtifacts: [], mapRoutes: [], mapRegions: [],
    mapRegionSnapshots: [], mapAnnotations: [], loreCategories: [], lorePages: [],
    factions: [], factionMemberships: [], factionRelationships: [],
    characterGoals: [], knowledgeFacts: [], knowledgeReveals: [],
    motifs: [], plotThreads: [], relationshipPositions: [],
    sceneRevisions: [], sceneTexts: [], writingLogs: [],
    continuitySuppressions: [], suppressedIssueIds: [], tombstones: [],
    ...over,
  } as WorldExportFile
}

const character = (over: Record<string, unknown> = {}) => ({
  id: 'c-ana', worldId: WORLD, name: 'Ana', description: '', aliases: [],
  tags: [], color: null, portraitImageId: null, isAlive: true,
  birthDate: null, createdAt: 1_000, updatedAt: 1_000, ...over,
})

const event = (over: Record<string, unknown> = {}) => ({
  id: 'ev-1', worldId: WORLD, chapterId: 'ch-1', title: 'The Meeting',
  description: '', sortOrder: 1, involvedCharacterIds: [], mentionedCharacterIds: [],
  involvedItemIds: [], tags: [], threadIds: [], povCharacterId: null,
  locationMarkerId: null, status: 'draft', createdAt: 1_000, updatedAt: 1_000, ...over,
})

beforeEach(async () => {
  for (const table of [db.worlds, db.characters, db.events, db.chapters, db.tombstones]) {
    await table.clear()
  }
})

describe('two devices editing the same world apart', () => {
  it('keeps a local cast addition when the other device retitled the scene', async () => {
    // This is the case the previous whole-record merge lost: the incoming
    // record was newer, so it replaced the local one wholesale and the cast
    // edit went with it, with nothing to say it had happened.
    await applyWorldImport(exportFile({
      characters: [character()] as never,
      events: [event()] as never,
    }), 'replace')

    await db.events.update('ev-1', { involvedCharacterIds: ['c-ana'], updatedAt: 2_000 })

    await applyWorldImport(exportFile({
      characters: [character()] as never,
      events: [event({ title: 'The Reckoning', updatedAt: 9_000 })] as never,
    }), 'merge')

    const merged = await db.events.get('ev-1')
    expect(merged?.title).toBe('The Reckoning')
    expect(merged?.involvedCharacterIds).toEqual(['c-ana'])
  })

  it('preserves both sides when each adds a different character to a scene', async () => {
    await applyWorldImport(exportFile({ events: [event()] as never }), 'replace')
    await db.events.update('ev-1', { involvedCharacterIds: ['c-ana'], updatedAt: 2_000 })

    await applyWorldImport(exportFile({
      events: [event({ involvedCharacterIds: ['c-bo'], updatedAt: 3_000 })] as never,
    }), 'merge')

    const merged = await db.events.get('ev-1')
    expect(merged?.involvedCharacterIds?.slice().sort()).toEqual(['c-ana', 'c-bo'])
  })

  it('unions tags added independently on both sides', async () => {
    await applyWorldImport(exportFile({ characters: [character()] as never }), 'replace')
    await db.characters.update('c-ana', { tags: ['thief'], updatedAt: 2_000 })

    await applyWorldImport(exportFile({
      characters: [character({ tags: ['noble'], updatedAt: 3_000 })] as never,
    }), 'merge')

    const merged = await db.characters.get('c-ana')
    expect(merged?.tags?.slice().sort()).toEqual(['noble', 'thief'])
  })

  it('lets the later write settle a scalar both sides changed', async () => {
    await applyWorldImport(exportFile({ characters: [character()] as never }), 'replace')
    await db.characters.update('c-ana', { description: 'A quiet thief.', updatedAt: 5_000 })

    // Older incoming: the local description stands.
    await applyWorldImport(exportFile({
      characters: [character({ description: 'A loud thief.', updatedAt: 3_000 })] as never,
    }), 'merge')
    expect((await db.characters.get('c-ana'))?.description).toBe('A quiet thief.')

    // Newer incoming: it takes over.
    await applyWorldImport(exportFile({
      characters: [character({ description: 'A retired thief.', updatedAt: 9_000 })] as never,
    }), 'merge')
    expect((await db.characters.get('c-ana'))?.description).toBe('A retired thief.')
  })

  it('does not let a stale copy resurrect a character deleted here', async () => {
    // The tombstone is what carries the deletion; without it the absent record
    // reads as "never existed" and the merge helpfully puts it back.
    await applyWorldImport(exportFile({ characters: [character()] as never }), 'replace')
    await db.characters.delete('c-ana')
    await db.tombstones.put({
      id: 't-1', worldId: WORLD, entityType: 'character', entityId: 'c-ana',
      version: 1, deviceId: 'device-here', deletedAt: 5_000,
    })

    await applyWorldImport(exportFile({
      characters: [character({ updatedAt: 2_000 })] as never,
    }), 'merge')

    expect(await db.characters.get('c-ana')).toBeUndefined()
  })

  it('removes a character the other device deleted while we still held it', async () => {
    // The mirror of the test above, and the half that was missing: there, the
    // record was already gone locally, so a merge that never deletes anything
    // still looked correct — the union simply had nothing to put back. Here the
    // record is present locally and absent from the incoming file, which is what
    // a deletion elsewhere actually looks like. Merge writes with bulkPut, so
    // dropping the row from the merged set is not enough to remove it.
    await applyWorldImport(exportFile({ characters: [character()] as never }), 'replace')
    expect(await db.characters.get('c-ana')).toBeDefined()

    await applyWorldImport(exportFile({
      characters: [] as never,
      tombstones: [{
        id: 't-3', worldId: WORLD, entityType: 'character', entityId: 'c-ana',
        version: 1, deviceId: 'device-there', deletedAt: 5_000,
      }] as never,
    }), 'merge')

    expect(await db.characters.get('c-ana')).toBeUndefined()
  })

  it('brings a record back when it was edited after the deletion', async () => {
    // Keeping work is recoverable; discarding it is not. An edit that postdates
    // the tombstone means someone still wanted the record.
    await applyWorldImport(exportFile({ characters: [character()] as never }), 'replace')
    await db.characters.delete('c-ana')
    await db.tombstones.put({
      id: 't-2', worldId: WORLD, entityType: 'character', entityId: 'c-ana',
      version: 1, deviceId: 'device-here', deletedAt: 5_000,
    })

    await applyWorldImport(exportFile({
      characters: [character({ name: 'Ana the Quick', updatedAt: 9_000 })] as never,
    }), 'merge')

    expect((await db.characters.get('c-ana'))?.name).toBe('Ana the Quick')
  })

  it('keeps both reorders when two devices move different cards', async () => {
    // Dense indices made this impossible: each device renumbered the whole
    // column, so merging interleaved two renumberings and the order that came
    // out was nobody's. A fractional position means each move writes one row.
    const three = [
      event({ id: 'ev-a', title: 'A', sortOrder: 1 }),
      event({ id: 'ev-b', title: 'B', sortOrder: 2 }),
      event({ id: 'ev-c', title: 'C', sortOrder: 3 }),
    ]
    await applyWorldImport(exportFile({ events: three as never }), 'replace')

    // Here: C moves to the front, between nothing and A.
    await db.events.update('ev-c', { sortOrder: 0.5, updatedAt: 2_000 })

    // There: B moves to the end, past C.
    await applyWorldImport(exportFile({
      events: [
        event({ id: 'ev-a', title: 'A', sortOrder: 1 }),
        event({ id: 'ev-b', title: 'B', sortOrder: 4, updatedAt: 3_000 }),
        event({ id: 'ev-c', title: 'C', sortOrder: 3 }),
      ] as never,
    }), 'merge')

    const order = (await db.events.toArray())
      .sort((x, y) => x.sortOrder - y.sortOrder || (x.id < y.id ? -1 : 1))
      .map((e) => e.title)
    expect(order).toEqual(['C', 'A', 'B'])
  })

  it('honours "keep mine" through the whole import path', async () => {
    // The end of the loop the conflict dialog opens: the user is shown both
    // versions, says which they trust, and that answer reaches the database.
    await applyWorldImport(exportFile({ characters: [character()] as never }), 'replace')
    await db.characters.update('c-ana', { description: 'A quiet thief.', updatedAt: 2_000 })

    await applyWorldImport(exportFile({
      characters: [character({ description: 'A loud thief.', updatedAt: 9_000 })] as never,
    }), 'merge', 'local')

    // Newer, and still overruled — which is the point.
    expect((await db.characters.get('c-ana'))?.description).toBe('A quiet thief.')
  })

  it('reports conflicting fields in the preview, with both values', async () => {
    const { previewWorldMerge } = await import('@/lib/exportImport')
    await applyWorldImport(exportFile({ characters: [character()] as never }), 'replace')
    await db.characters.update('c-ana', { description: 'A quiet thief.', updatedAt: 2_000 })

    const { preview } = await previewWorldMerge(JSON.stringify(exportFile({
      characters: [character({ description: 'A loud thief.', updatedAt: 9_000 })] as never,
    })))

    expect(preview.conflicts).toHaveLength(1)
    expect(preview.conflicts[0].entity).toBe('Character')
    expect(preview.conflicts[0].label).toBe('Ana')
    expect(preview.conflicts[0].fields[0]).toMatchObject({
      field: 'description', local: 'A quiet thief.', incoming: 'A loud thief.',
    })
  })

  it('is idempotent — merging the same file twice changes nothing the second time', async () => {
    // A retry after a dropped connection must not double anything up.
    await applyWorldImport(exportFile({ events: [event()] as never }), 'replace')
    await db.events.update('ev-1', { involvedCharacterIds: ['c-ana'], updatedAt: 2_000 })

    const incoming = exportFile({
      events: [event({ involvedCharacterIds: ['c-bo'], updatedAt: 3_000 })] as never,
    })
    await applyWorldImport(incoming, 'merge')
    const once = await db.events.get('ev-1')

    await applyWorldImport(incoming, 'merge')
    const twice = await db.events.get('ev-1')

    expect(twice).toEqual(once)
  })
})
