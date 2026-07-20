import { generateId } from '@/lib/id'
import type {
  World, Timeline, Character, Item, Faction, FactionMembership, FactionRelationship,
  Relationship, RelationshipSnapshot, CharacterSnapshot, MapLayer, LocationMarker,
  MapRoute, MapRegion, MapAnnotation, LoreCategory, LorePage, Chapter, WorldEvent,
  TravelMode,
} from '@/types'

/**
 * "Start a sequel": build a brand-new world (book 2) from a previous one, forking
 * the pieces the writer chooses. Characters, items, factions and maps carry over
 * with fresh ids; relationships continue from their *final* state in book 1; and
 * the previous book's plot is turned into "Previously…" lore so the backstory is
 * reference material. The sequel starts as a fresh narrative — book 1's chapters,
 * events and scene prose are not copied.
 *
 * `planSequel` is pure: it mints the new ids, remaps every reference, and records
 * which blobs (portraits, map images) need copying. A thin DB layer then bulk-puts
 * the records and copies the referenced blobs.
 */

/** The subset of a collected world the planner reads. */
export interface SequelSource {
  world: World
  characters: Character[]
  items: Item[]
  factions: Faction[]
  factionMemberships: FactionMembership[]
  factionRelationships: FactionRelationship[]
  relationships: Relationship[]
  relationshipSnapshots: RelationshipSnapshot[]
  characterSnapshots: CharacterSnapshot[]
  mapLayers: MapLayer[]
  locationMarkers: LocationMarker[]
  mapRoutes: MapRoute[]
  mapRegions: MapRegion[]
  mapAnnotations: MapAnnotation[]
  loreCategories: LoreCategory[]
  lorePages: LorePage[]
  travelModes: TravelMode[]
  chapters: Chapter[]
  events: WorldEvent[]
}

export interface SequelSelection {
  characterIds: string[]
  itemIds: string[]
  factionIds: string[]
  mapLayerIds: string[]
}

export interface SequelOptions {
  name: string
  description?: string
  /** Seed an opening chapter with each carried character's ending state. */
  seedOpeningChapter?: boolean
  /** Turn book 1's chapters into a "Previously…" lore category. */
  convertStoryToLore?: boolean
  /** Carry book 1's world-building lore pages forward. Default true. */
  carryWorldbuildingLore?: boolean
  now?: number
}

export interface SequelPlan {
  world: World
  timelines: Timeline[]
  characters: Character[]
  items: Item[]
  factions: Faction[]
  factionMemberships: FactionMembership[]
  factionRelationships: FactionRelationship[]
  relationships: Relationship[]
  mapLayers: MapLayer[]
  locationMarkers: LocationMarker[]
  mapRoutes: MapRoute[]
  mapRegions: MapRegion[]
  mapAnnotations: MapAnnotation[]
  loreCategories: LoreCategory[]
  lorePages: LorePage[]
  travelModes: TravelMode[]
  chapters: Chapter[]
  events: WorldEvent[]
  characterSnapshots: CharacterSnapshot[]
  /** Blobs to copy from the source world: source blob id → new blob id. */
  blobCopies: Array<{ from: string; to: string }>
}

export function planSequel(source: SequelSource, selection: SequelSelection, options: SequelOptions): SequelPlan {
  const now = options.now ?? Date.now()
  const worldId = generateId()

  const carryChar = new Set(selection.characterIds)
  const carryItem = new Set(selection.itemIds)
  const carryFaction = new Set(selection.factionIds)
  const carryLayer = new Set(selection.mapLayerIds)

  // ── id + blob remapping ─────────────────────────────────────────────────────
  const charMap = new Map<string, string>()
  const itemMap = new Map<string, string>()
  const factionMap = new Map<string, string>()
  const layerMap = new Map<string, string>()
  const markerMap = new Map<string, string>()
  const travelModeMap = new Map<string, string>()
  const categoryMap = new Map<string, string>()

  const blobRemap = new Map<string, string>()
  const blobCopies: Array<{ from: string; to: string }> = []
  const remapBlob = (oldId: string | null | undefined): string | null => {
    if (!oldId) return null
    let next = blobRemap.get(oldId)
    if (!next) {
      next = generateId()
      blobRemap.set(oldId, next)
      blobCopies.push({ from: oldId, to: next })
    }
    return next
  }

  // ── Narrative order, for resolving "final" state ────────────────────────────
  const chapNum = new Map(source.chapters.map((c) => [c.id, c.number]))
  const eventById = new Map(source.events.map((e) => [e.id, e]))
  const eventOrder = (eventId: string): number => {
    const ev = eventById.get(eventId)
    if (!ev) return -1
    return (chapNum.get(ev.chapterId) ?? 0) * 10_000 + ev.sortOrder
  }

  // ── World + timeline ────────────────────────────────────────────────────────
  const world: World = {
    id: worldId,
    name: options.name.trim() || `${source.world.name} — Book 2`,
    description: options.description?.trim() ?? source.world.description,
    coverImageId: remapBlob(source.world.coverImageId),
    theme: source.world.theme,
    continuityStaleThreshold: source.world.continuityStaleThreshold,
    createdAt: now,
    updatedAt: now,
  }
  const timeline: Timeline = {
    id: generateId(), worldId, name: 'Main Story', description: '', color: '#6366f1', createdAt: now,
  }

  // ── Travel modes (world config — carried wholesale) ─────────────────────────
  const travelModes: TravelMode[] = source.travelModes.map((tm) => {
    const id = generateId()
    travelModeMap.set(tm.id, id)
    return { ...tm, id, worldId, createdAt: now, updatedAt: now }
  })

  // ── Characters (with their ending alive status) ─────────────────────────────
  const endingSnapshot = new Map<string, CharacterSnapshot>()
  {
    const byChar = new Map<string, CharacterSnapshot[]>()
    for (const s of source.characterSnapshots) {
      const arr = byChar.get(s.characterId) ?? []
      arr.push(s)
      byChar.set(s.characterId, arr)
    }
    for (const [cid, arr] of byChar) {
      arr.sort((a, b) => eventOrder(a.eventId) - eventOrder(b.eventId))
      endingSnapshot.set(cid, arr[arr.length - 1])
    }
  }

  const characters: Character[] = []
  for (const c of source.characters) {
    if (!carryChar.has(c.id)) continue
    const id = generateId()
    charMap.set(c.id, id)
    characters.push({
      ...c, id, worldId,
      isAlive: endingSnapshot.get(c.id)?.isAlive ?? c.isAlive,
      portraitImageId: remapBlob(c.portraitImageId),
      createdAt: now, updatedAt: now,
    })
  }

  // ── Items ───────────────────────────────────────────────────────────────────
  const items: Item[] = []
  for (const it of source.items) {
    if (!carryItem.has(it.id)) continue
    const id = generateId()
    itemMap.set(it.id, id)
    items.push({ ...it, id, worldId, imageId: remapBlob(it.imageId) })
  }

  // ── Factions, memberships, faction relationships ────────────────────────────
  const factions: Faction[] = []
  for (const f of source.factions) {
    if (!carryFaction.has(f.id)) continue
    const id = generateId()
    factionMap.set(f.id, id)
    factions.push({ ...f, id, worldId, coverImageId: remapBlob(f.coverImageId), createdAt: now, updatedAt: now })
  }
  const factionMemberships: FactionMembership[] = []
  for (const m of source.factionMemberships) {
    const fId = factionMap.get(m.factionId)
    const cId = charMap.get(m.characterId)
    if (!fId || !cId) continue
    factionMemberships.push({
      ...m, id: generateId(), worldId, factionId: fId, characterId: cId,
      startEventId: null, endEventId: null, createdAt: now, updatedAt: now,
    })
  }
  const factionRelationships: FactionRelationship[] = []
  for (const fr of source.factionRelationships) {
    const a = factionMap.get(fr.factionAId)
    const b = factionMap.get(fr.factionBId)
    if (!a || !b) continue
    factionRelationships.push({ ...fr, id: generateId(), worldId, factionAId: a, factionBId: b, createdAt: now, updatedAt: now })
  }

  // ── Maps: layers → markers → routes/regions/annotations ─────────────────────
  const mapLayers: MapLayer[] = []
  for (const l of source.mapLayers) {
    if (!carryLayer.has(l.id)) continue
    const id = generateId()
    layerMap.set(l.id, id)
    mapLayers.push({ ...l, id, worldId, imageId: remapBlob(l.imageId) as string, createdAt: now, updatedAt: now })
  }
  // Second pass: resolve parent links now every carried layer has an id.
  for (const l of mapLayers) {
    const src = source.mapLayers.find((s) => layerMap.get(s.id) === l.id)!
    l.parentMapId = src.parentMapId && layerMap.has(src.parentMapId) ? layerMap.get(src.parentMapId)! : null
  }

  const locationMarkers: LocationMarker[] = []
  for (const m of source.locationMarkers) {
    if (!carryLayer.has(m.mapLayerId)) continue
    const id = generateId()
    markerMap.set(m.id, id)
    locationMarkers.push({
      ...m, id, worldId,
      mapLayerId: layerMap.get(m.mapLayerId)!,
      linkedMapLayerId: m.linkedMapLayerId && layerMap.has(m.linkedMapLayerId) ? layerMap.get(m.linkedMapLayerId)! : null,
      factionId: m.factionId && factionMap.has(m.factionId) ? factionMap.get(m.factionId)! : null,
      createdAt: now, updatedAt: now,
    })
  }

  const mapRoutes: MapRoute[] = []
  for (const r of source.mapRoutes) {
    if (!carryLayer.has(r.mapLayerId)) continue
    const waypoints = r.waypoints
      .map((wp) => (typeof wp === 'string' ? (markerMap.get(wp) ?? null) : wp))
      .filter((wp): wp is string | { x: number; y: number } => wp !== null)
    mapRoutes.push({ ...r, id: generateId(), worldId, mapLayerId: layerMap.get(r.mapLayerId)!, waypoints, createdAt: now, updatedAt: now })
  }

  const mapRegions: MapRegion[] = []
  for (const rg of source.mapRegions) {
    if (!carryLayer.has(rg.mapLayerId)) continue
    mapRegions.push({
      ...rg, id: generateId(), worldId, mapLayerId: layerMap.get(rg.mapLayerId)!,
      linkedMapLayerId: rg.linkedMapLayerId && layerMap.has(rg.linkedMapLayerId) ? layerMap.get(rg.linkedMapLayerId)! : null,
      factionId: rg.factionId && factionMap.has(rg.factionId) ? factionMap.get(rg.factionId)! : null,
      createdAt: now, updatedAt: now,
    })
  }

  const mapAnnotations: MapAnnotation[] = []
  for (const an of source.mapAnnotations) {
    if (!carryLayer.has(an.mapLayerId)) continue
    mapAnnotations.push({ ...an, id: generateId(), worldId, mapLayerId: layerMap.get(an.mapLayerId)!, createdAt: now, updatedAt: now })
  }

  // ── Relationships (continue from their final state) ─────────────────────────
  const finalRelSnap = new Map<string, RelationshipSnapshot>()
  {
    const byRel = new Map<string, RelationshipSnapshot[]>()
    for (const s of source.relationshipSnapshots) {
      const arr = byRel.get(s.relationshipId) ?? []
      arr.push(s)
      byRel.set(s.relationshipId, arr)
    }
    for (const [rid, arr] of byRel) {
      arr.sort((a, b) => eventOrder(a.eventId) - eventOrder(b.eventId))
      finalRelSnap.set(rid, arr[arr.length - 1])
    }
  }
  const relationships: Relationship[] = []
  for (const r of source.relationships) {
    const a = charMap.get(r.characterAId)
    const b = charMap.get(r.characterBId)
    if (!a || !b) continue
    const fin = finalRelSnap.get(r.id)
    relationships.push({
      ...r, id: generateId(), worldId, characterAId: a, characterBId: b,
      label: fin?.label ?? r.label,
      strength: fin?.strength ?? r.strength,
      sentiment: fin?.sentiment ?? r.sentiment,
      description: fin?.description || r.description,
      startEventId: null,
      createdAt: now, updatedAt: now,
    })
  }

  // ── Lore: world-building carried forward + a "Previously…" recap ────────────
  const loreCategories: LoreCategory[] = []
  const lorePages: LorePage[] = []
  const anyId = (oldId: string): string | null =>
    charMap.get(oldId) ?? itemMap.get(oldId) ?? markerMap.get(oldId) ?? factionMap.get(oldId) ?? null

  if (options.carryWorldbuildingLore !== false) {
    for (const cat of source.loreCategories) {
      const id = generateId()
      categoryMap.set(cat.id, id)
      loreCategories.push({ ...cat, id, worldId })
    }
    for (const p of source.lorePages) {
      lorePages.push({
        ...p, id: generateId(), worldId,
        categoryId: p.categoryId && categoryMap.has(p.categoryId) ? categoryMap.get(p.categoryId)! : null,
        linkedEntityIds: p.linkedEntityIds.map(anyId).filter((x): x is string => !!x),
        coverImageId: remapBlob(p.coverImageId),
        visibleFromEventId: null,
        createdAt: now, updatedAt: now,
      })
    }
  }

  if (options.convertStoryToLore) {
    const recapCat: LoreCategory = {
      id: generateId(), worldId,
      name: `Previously — ${source.world.name}`,
      color: '#f59e0b',
      sortOrder: loreCategories.length,
    }
    loreCategories.push(recapCat)
    const eventsByChapter = new Map<string, WorldEvent[]>()
    for (const e of source.events) {
      const arr = eventsByChapter.get(e.chapterId) ?? []
      arr.push(e)
      eventsByChapter.set(e.chapterId, arr)
    }
    const orderedChapters = [...source.chapters].sort((a, b) => a.number - b.number)
    let order = 0
    for (const ch of orderedChapters) {
      const evs = (eventsByChapter.get(ch.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
      const beats = evs.map((e) => `- **${e.title || 'Untitled'}**${e.description ? ` — ${e.description}` : ''}`).join('\n')
      const body = [ch.synopsis?.trim(), beats].filter(Boolean).join('\n\n') || '_No summary recorded._'
      lorePages.push({
        id: generateId(), worldId, categoryId: recapCat.id,
        title: `Ch. ${ch.number} — ${ch.title || 'Untitled'}`,
        body, tags: [], coverImageId: null, linkedEntityIds: [],
        visibleFromEventId: null, createdAt: now, updatedAt: now + order,
      })
      order++
    }
  }

  // ── Optional opening chapter, seeded with carried ending states ─────────────
  const chapters: Chapter[] = []
  const events: WorldEvent[] = []
  const characterSnapshots: CharacterSnapshot[] = []
  if (options.seedOpeningChapter) {
    const chapterId = generateId()
    chapters.push({
      id: chapterId, worldId, timelineId: timeline.id, number: 1,
      title: 'Opening', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
    })
    const eventId = generateId()
    events.push({
      id: eventId, worldId, chapterId, timelineId: timeline.id,
      title: 'The story continues', description: '',
      locationMarkerId: null, involvedCharacterIds: characters.map((c) => c.id),
      mentionedCharacterIds: [], threadIds: [], motifIds: [], involvedItemIds: [], tags: [],
      sortOrder: 0, travelDays: null, inWorldTime: null, tension: null, structureBeat: null,
      status: 'draft', povCharacterId: null, isFlashback: false, createdAt: now, updatedAt: now,
    })
    for (const c of characters) {
      const srcId = [...charMap.entries()].find(([, v]) => v === c.id)![0]
      const end = endingSnapshot.get(srcId)
      const markerId = end?.currentLocationMarkerId && markerMap.has(end.currentLocationMarkerId)
        ? markerMap.get(end.currentLocationMarkerId)! : null
      const layerId = markerId && end?.currentMapLayerId && layerMap.has(end.currentMapLayerId)
        ? layerMap.get(end.currentMapLayerId)! : null
      const inventory = (end?.inventoryItemIds ?? []).map((i) => itemMap.get(i)).filter((x): x is string => !!x)
      const travelModeId = end?.travelModeId && travelModeMap.has(end.travelModeId) ? travelModeMap.get(end.travelModeId)! : null
      characterSnapshots.push({
        id: generateId(), worldId, characterId: c.id, eventId,
        isAlive: c.isAlive,
        currentLocationMarkerId: markerId,
        currentMapLayerId: layerId,
        inventoryItemIds: inventory,
        inventoryNotes: end?.inventoryNotes ?? '',
        statusNotes: end?.statusNotes ?? '',
        travelModeId,
        sortKey: 1 * 10_000 + 0,
        createdAt: now, updatedAt: now,
      })
    }
  }

  return {
    world, timelines: [timeline], characters, items,
    factions, factionMemberships, factionRelationships, relationships,
    mapLayers, locationMarkers, mapRoutes, mapRegions, mapAnnotations,
    loreCategories, lorePages, travelModes, chapters, events, characterSnapshots,
    blobCopies,
  }
}

/** Preview counts for the sequel wizard. */
export function sequelStats(selection: SequelSelection): {
  characters: number; items: number; factions: number; maps: number
} {
  return {
    characters: selection.characterIds.length,
    items: selection.itemIds.length,
    factions: selection.factionIds.length,
    maps: selection.mapLayerIds.length,
  }
}
