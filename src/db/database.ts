import Dexie, { type EntityTable } from 'dexie'
import { generateId } from '@/lib/id'
import type {
  World,
  AppPreferences,
  MapLayer,
  LocationMarker,
  Character,
  Item,
  CharacterSnapshot,
  CharacterMovement,
  ItemPlacement,
  LocationSnapshot,
  ItemSnapshot,
  Relationship,
  RelationshipSnapshot,
  Timeline,
  Chapter,
  WorldEvent,
  BlobEntry,
  TravelMode,
  TimelineRelationship,
  CrossTimelineArtifact,
  MapRoute,
  MapRegion,
  MapRegionSnapshot,
  MapAnnotation,
  LorePage,
  LoreCategory,
  Faction,
  FactionMembership,
  FactionRelationship,
} from '@/types'

class PlotWeaveDB extends Dexie {
  worlds!: EntityTable<World, 'id'>
  preferences!: EntityTable<AppPreferences, 'id'>
  mapLayers!: EntityTable<MapLayer, 'id'>
  locationMarkers!: EntityTable<LocationMarker, 'id'>
  characters!: EntityTable<Character, 'id'>
  items!: EntityTable<Item, 'id'>
  characterSnapshots!: EntityTable<CharacterSnapshot, 'id'>
  characterMovements!: EntityTable<CharacterMovement, 'id'>
  itemPlacements!: EntityTable<ItemPlacement, 'id'>
  relationships!: EntityTable<Relationship, 'id'>
  relationshipSnapshots!: EntityTable<RelationshipSnapshot, 'id'>
  timelines!: EntityTable<Timeline, 'id'>
  chapters!: EntityTable<Chapter, 'id'>
  events!: EntityTable<WorldEvent, 'id'>
  blobs!: EntityTable<BlobEntry, 'id'>
  locationSnapshots!: EntityTable<LocationSnapshot, 'id'>
  itemSnapshots!: EntityTable<ItemSnapshot, 'id'>
  travelModes!: EntityTable<TravelMode, 'id'>
  timelineRelationships!: EntityTable<TimelineRelationship, 'id'>
  crossTimelineArtifacts!: EntityTable<CrossTimelineArtifact, 'id'>
  mapRoutes!: EntityTable<MapRoute, 'id'>
  mapRegions!: EntityTable<MapRegion, 'id'>
  mapRegionSnapshots!: EntityTable<MapRegionSnapshot, 'id'>
  mapAnnotations!: EntityTable<MapAnnotation, 'id'>
  loreCategories!: EntityTable<LoreCategory, 'id'>
  lorePages!: EntityTable<LorePage, 'id'>
  factions!: EntityTable<Faction, 'id'>
  factionMemberships!: EntityTable<FactionMembership, 'id'>
  factionRelationships!: EntityTable<FactionRelationship, 'id'>

  constructor() {
    super('PlotWeaveDB')

    this.version(1).stores({
      worlds: 'id, name, createdAt',
      preferences: 'id',
      mapLayers: 'id, worldId, parentMapId, createdAt',
      locationMarkers: 'id, worldId, mapLayerId, linkedMapLayerId',
      characters: 'id, worldId, name, createdAt',
      items: 'id, worldId, name',
      characterSnapshots: 'id, worldId, characterId, chapterId, [characterId+chapterId]',
      relationships: 'id, worldId, characterAId, characterBId',
      timelines: 'id, worldId, createdAt',
      chapters: 'id, worldId, timelineId, number',
      events: 'id, worldId, chapterId, timelineId, sortOrder',
      blobs: 'id, worldId, createdAt',
    })

    this.version(2).stores({
      characterMovements: 'id, worldId, characterId, chapterId, [characterId+chapterId]',
    })

    this.version(3).stores({
      itemPlacements: 'id, worldId, itemId, chapterId, locationMarkerId, [itemId+chapterId]',
    })

    this.version(4).stores({
      relationshipSnapshots: 'id, worldId, relationshipId, chapterId, [relationshipId+chapterId]',
    })

    this.version(5).stores({
      relationships: 'id, worldId, characterAId, characterBId, startChapterId',
    }).upgrade((tx) => {
      return tx.table('relationships').toCollection().modify((r) => {
        if (r.startChapterId === undefined) r.startChapterId = null
      })
    })

    this.version(6).stores({}).upgrade((tx) => {
      return tx.table('mapLayers').toCollection().modify((l) => {
        if (l.scalePixelsPerUnit === undefined) l.scalePixelsPerUnit = null
        if (l.scaleUnit === undefined) l.scaleUnit = null
      })
    })

    this.version(7).stores({
      locationSnapshots: 'id, worldId, locationMarkerId, chapterId, [locationMarkerId+chapterId]',
      itemSnapshots: 'id, worldId, itemId, chapterId, [itemId+chapterId]',
    })

    this.version(8).stores({}).upgrade((tx) => {
      return tx.table('chapters').toCollection().modify((ch) => {
        if (ch.notes === undefined) ch.notes = ''
      })
    })

    this.version(9).stores({
      travelModes: 'id, worldId',
    }).upgrade((tx) => {
      tx.table('chapters').toCollection().modify((ch) => {
        if (ch.travelDays === undefined) ch.travelDays = null
      })
      return tx.table('characterSnapshots').toCollection().modify((s) => {
        if (s.travelModeId === undefined) s.travelModeId = null
      })
    })

    // ── v10: Events become the primary time unit ──────────────────────────────
    // All snapshot tables migrate chapterId → eventId.
    // For each chapter with no events, a synthetic event is created so existing
    // snapshots have a valid eventId to point to.
    // Relationship.startChapterId → startEventId.
    // WorldEvent gains travelDays (moved from Chapter).
    this.version(10).stores({
      characterSnapshots: 'id, worldId, characterId, eventId, [characterId+eventId]',
      characterMovements: 'id, worldId, characterId, eventId, [characterId+eventId]',
      itemPlacements: 'id, worldId, itemId, eventId, locationMarkerId, [itemId+eventId]',
      relationshipSnapshots: 'id, worldId, relationshipId, eventId, [relationshipId+eventId]',
      locationSnapshots: 'id, worldId, locationMarkerId, eventId, [locationMarkerId+eventId]',
      itemSnapshots: 'id, worldId, itemId, eventId, [itemId+eventId]',
      relationships: 'id, worldId, characterAId, characterBId, startEventId',
    }).upgrade(async (tx) => {
      // 1. Load chapters and existing events
      const chapters: Array<{
        id: string; worldId: string; timelineId: string; title: string
        travelDays: number | null; createdAt: number; updatedAt: number
      }> = await tx.table('chapters').toArray()

      const existingEvents: Array<{ id: string; chapterId: string; sortOrder: number }> =
        await tx.table('events').toArray()

      // 2. Group events by chapterId, sorted by sortOrder
      const eventsByChapterId = new Map<string, typeof existingEvents>()
      for (const ev of existingEvents) {
        const arr = eventsByChapterId.get(ev.chapterId) ?? []
        arr.push(ev)
        eventsByChapterId.set(ev.chapterId, arr)
      }

      // 3. Build chapterId → representative eventId map
      //    Use first existing event, or create a synthetic placeholder
      const chapToEventId = new Map<string, string>()
      const syntheticEvents: object[] = []
      const firstEventByChapterId = new Map<string, string>() // for travelDays transfer

      for (const ch of chapters) {
        const chEvents = (eventsByChapterId.get(ch.id) ?? [])
          .slice().sort((a, b) => a.sortOrder - b.sortOrder)

        if (chEvents.length > 0) {
          chapToEventId.set(ch.id, chEvents[0].id)
          firstEventByChapterId.set(ch.id, chEvents[0].id)
        } else {
          const syntheticId = generateId()
          syntheticEvents.push({
            id: syntheticId,
            worldId: ch.worldId,
            chapterId: ch.id,
            timelineId: ch.timelineId,
            title: ch.title,
            description: '',
            locationMarkerId: null,
            involvedCharacterIds: [],
            involvedItemIds: [],
            tags: [],
            sortOrder: 0,
            travelDays: ch.travelDays ?? null,
            createdAt: ch.createdAt,
            updatedAt: ch.updatedAt,
          })
          chapToEventId.set(ch.id, syntheticId)
        }
      }

      if (syntheticEvents.length > 0) {
        await tx.table('events').bulkAdd(syntheticEvents)
      }

      // 4. Add travelDays to all existing events
      //    First event in a chapter inherits the chapter's travelDays
      const chapterTravelDays = new Map(chapters.map((c) => [c.id, c.travelDays ?? null]))
      await tx.table('events').toCollection().modify((ev) => {
        if (ev.travelDays === undefined) {
          const isFirst = firstEventByChapterId.get(ev.chapterId) === ev.id
          ev.travelDays = isFirst ? (chapterTravelDays.get(ev.chapterId) ?? null) : null
        }
      })

      // 5. Re-key all snapshot tables: chapterId → eventId
      await tx.table('characterSnapshots').toCollection().modify((s) => {
        s.eventId = chapToEventId.get(s.chapterId) ?? s.chapterId
        delete s.chapterId
      })
      await tx.table('characterMovements').toCollection().modify((s) => {
        s.eventId = chapToEventId.get(s.chapterId) ?? s.chapterId
        delete s.chapterId
      })
      await tx.table('itemPlacements').toCollection().modify((s) => {
        s.eventId = chapToEventId.get(s.chapterId) ?? s.chapterId
        delete s.chapterId
      })
      await tx.table('locationSnapshots').toCollection().modify((s) => {
        s.eventId = chapToEventId.get(s.chapterId) ?? s.chapterId
        delete s.chapterId
      })
      await tx.table('itemSnapshots').toCollection().modify((s) => {
        s.eventId = chapToEventId.get(s.chapterId) ?? s.chapterId
        delete s.chapterId
      })
      await tx.table('relationshipSnapshots').toCollection().modify((s) => {
        s.eventId = chapToEventId.get(s.chapterId) ?? s.chapterId
        delete s.chapterId
      })

      // 6. Migrate Relationship.startChapterId → startEventId
      await tx.table('relationships').toCollection().modify((r) => {
        r.startEventId = r.startChapterId != null
          ? (chapToEventId.get(r.startChapterId) ?? null)
          : null
        delete r.startChapterId
      })

      // 7. Strip travelDays from chapters (now lives on events)
      await tx.table('chapters').toCollection().modify((ch) => {
        delete ch.travelDays
      })
    })

    // v11: add travelModeId and notes to characterMovements (backfill nulls)
    this.version(11).stores({}).upgrade(async (tx) => {
      await tx.table('characterMovements').toCollection().modify((m: Record<string, unknown>) => {
        if (!('travelModeId' in m)) m.travelModeId = null
        if (!('notes' in m)) m.notes = ''
      })
    })

    // v12: add color to characters (backfill null)
    this.version(12).stores({}).upgrade(async (tx) => {
      await tx.table('characters').toCollection().modify((c: Record<string, unknown>) => {
        if (!('color' in c)) c.color = null
      })
    })

    // v13: add sortKey to all snapshot tables.
    // sortKey = chapter.number × 10_000 + event.sortOrder — enables efficient
    // "last-known state at or before event N" queries (delta/last-known model).
    this.version(13).stores({
      characterSnapshots: 'id, worldId, characterId, eventId, [characterId+eventId], [worldId+characterId+sortKey]',
      locationSnapshots: 'id, worldId, locationMarkerId, eventId, [locationMarkerId+eventId], [worldId+locationMarkerId+sortKey]',
      itemSnapshots: 'id, worldId, itemId, eventId, [itemId+eventId], [worldId+itemId+sortKey]',
      relationshipSnapshots: 'id, worldId, relationshipId, eventId, [relationshipId+eventId], [worldId+relationshipId+sortKey]',
    }).upgrade(async (tx) => {
      // Build lookup maps from events and chapters
      const events: Array<{ id: string; chapterId: string; sortOrder: number }> =
        await tx.table('events').toArray()
      const chapters: Array<{ id: string; number: number }> =
        await tx.table('chapters').toArray()

      const eventById = new Map(events.map((e) => [e.id, e]))
      const chapterNumberById = new Map(chapters.map((c) => [c.id, c.number]))

      const getSortKey = (eventId: string): number => {
        const ev = eventById.get(eventId)
        if (!ev) return 0
        const chapNum = chapterNumberById.get(ev.chapterId) ?? 0
        return chapNum * 10_000 + ev.sortOrder
      }

      const snapshotTables = [
        'characterSnapshots', 'locationSnapshots', 'itemSnapshots', 'relationshipSnapshots',
      ]
      for (const tableName of snapshotTables) {
        await tx.table(tableName).toCollection().modify((s: Record<string, unknown>) => {
          if (s.sortKey === undefined) {
            s.sortKey = getSortKey(s.eventId as string)
          }
        })
      }
    })

    // v14: timeline relationships and cross-timeline artifacts (purely additive)
    this.version(14).stores({
      timelineRelationships: 'id, worldId, sourceTimelineId, targetTimelineId',
      crossTimelineArtifacts: 'id, worldId, itemId, originTimelineId, encounterTimelineId',
    })

    // v15: persistent map routes and region polygons (purely additive)
    this.version(15).stores({
      mapRoutes: 'id, worldId, mapLayerId',
      mapRegions: 'id, worldId, mapLayerId',
      mapRegionSnapshots: 'id, worldId, regionId, eventId, [regionId+eventId]',
    })

    // v16: free-text map annotations (purely additive)
    this.version(16).stores({
      mapAnnotations: 'id, worldId, mapLayerId',
    })

    // v17: add linkedMapLayerId to map regions (backfill null)
    this.version(17).stores({}).upgrade(async (tx) => {
      await tx.table('mapRegions').toCollection().modify((r: Record<string, unknown>) => {
        if (!('linkedMapLayerId' in r)) r.linkedMapLayerId = null
      })
    })

    // v18: add per-world theme (backfill null = inherit global theme)
    this.version(18).stores({}).upgrade(async (tx) => {
      await tx.table('worlds').toCollection().modify((w: Record<string, unknown>) => {
        if (!('theme' in w)) w.theme = null
      })
    })

    // v19: lore pages and categories (purely additive)
    this.version(19).stores({
      loreCategories: 'id, worldId, sortOrder',
      lorePages: 'id, worldId, categoryId, updatedAt',
    })

    // v20: lore page entity links and timeline visibility (backfill)
    this.version(20).stores({}).upgrade(async (tx) => {
      await tx.table('lorePages').toCollection().modify((p: Record<string, unknown>) => {
        if (!('linkedEntityIds' in p)) p.linkedEntityIds = []
        if (!('visibleFromEventId' in p)) p.visibleFromEventId = null
      })
    })

    // v21: factions and faction memberships (purely additive)
    this.version(21).stores({
      factions: 'id, worldId',
      factionMemberships: 'id, worldId, factionId, characterId',
    })

    // v22: add factionId to map regions (backfill null)
    this.version(22).stores({}).upgrade(async (tx) => {
      await tx.table('mapRegions').toCollection().modify((r: Record<string, unknown>) => {
        if (!('factionId' in r)) r.factionId = null
      })
    })

    // v23: index factionId on mapRegions so we can query by owning faction
    this.version(23).stores({
      mapRegions: 'id, worldId, mapLayerId, factionId',
    })

    // v24: add factionId to locationMarkers (backfill null, then index)
    this.version(24).stores({
      locationMarkers: 'id, worldId, mapLayerId, linkedMapLayerId, factionId',
    }).upgrade(async (tx) => {
      await tx.table('locationMarkers').toCollection().modify((m: Record<string, unknown>) => {
        if (!('factionId' in m)) m.factionId = null
      })
    })

    // v25: inter-faction relationships (stance: allied | neutral | hostile)
    this.version(25).stores({
      factionRelationships: 'id, worldId, factionAId, factionBId',
    })

    // v26: event status ('idea' | 'outline' | 'draft' | 'revised' | 'final'); backfill 'draft'
    this.version(26).stores({}).upgrade(async (tx) => {
      await tx.table('events').toCollection().modify((ev: Record<string, unknown>) => {
        if (!('status' in ev)) ev.status = 'draft'
      })
    })
  }
}

export const db = new PlotWeaveDB()

db.on('blocked', () => {
  db.close()
  window.location.reload()
})

db.on('versionchange', () => {
  db.close()
  window.location.reload()
})
