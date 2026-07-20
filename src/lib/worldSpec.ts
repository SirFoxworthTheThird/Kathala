import { generateId } from '@/lib/id'
import { EXPORT_VERSION, importWorldFromJson, type WorldExportFile } from '@/lib/exportImport'
import type {
  World, Character, Item, Faction, FactionMembership, Relationship, Timeline,
  Chapter, WorldEvent, CharacterSnapshot, LoreCategory, LorePage,
  KnowledgeFact, KnowledgeReveal, RelationshipStrength, RelationshipSentiment,
} from '@/types'

/**
 * Compact "story spec" — a much smaller JSON shape for AI-assisted world import.
 *
 * The full PlotWeave export is verbose (UUIDs everywhere, a snapshot per
 * character × event, a dozen null fields per record), which makes a large story
 * overflow an LLM's output limit and truncate. The spec fixes that: entities are
 * referenced by **name** (no UUIDs), and character state is given as **deltas**
 * (only when something changes) rather than one snapshot per event. The app
 * expands it back into the full model on import, so nothing is lost.
 *
 * `expandWorldSpec` is pure: it generates the ids, resolves names → ids, and
 * rebuilds the snapshot records, producing a normal WorldExportFile that flows
 * through the existing import path.
 */

export interface SpecCharacter {
  name: string
  aliases?: string[]
  description?: string
  tags?: string[]
  /** Defaults to true; set false if they die before the story begins. */
  alive?: boolean
  color?: string | null
}

export interface SpecItem {
  name: string
  description?: string
  /** weapon | armor | potion | scroll | ring | key | treasure | book | artifact | other */
  icon?: string
  tags?: string[]
}

export interface SpecFactionMember {
  name: string
  role?: string
}

export interface SpecFaction {
  name: string
  description?: string
  color?: string
  tags?: string[]
  members?: Array<string | SpecFactionMember>
}

export interface SpecRelationship {
  a: string
  b: string
  label?: string
  strength?: RelationshipStrength
  sentiment?: RelationshipSentiment
  description?: string
}

/** A change to a character's state at an event. Only emit when something changes. */
export interface SpecChange {
  who: string
  /** Shorthand for alive:false from this event on. */
  dies?: boolean
  /** Explicit alive flag (e.g. a resurrection). */
  alive?: boolean
  /** Item names added to inventory. */
  gains?: string[]
  /** Item names removed from inventory. */
  loses?: string[]
  /** What the character is doing/experiencing (becomes statusNotes). */
  note?: string
  /** Where they are — folded into statusNotes (AI import creates no map markers). */
  location?: string
}

export interface SpecEvent {
  /** Optional short slug (e.g. "e1") so knowledge reveals can point at this event. */
  id?: string
  title: string
  description?: string
  /** Cast present in the scene, by character name. */
  characters?: string[]
  /** POV character name. */
  pov?: string
  /** Characters referenced but not present, by name. */
  mentioned?: string[]
  /** Involved items, by name. */
  items?: string[]
  tags?: string[]
  /** Dramatic intensity 1–5. */
  tension?: number
  /** hook | inciting-incident | plot-point-1 | midpoint | plot-point-2 | climax | resolution */
  beat?: string
  flashback?: boolean
  changes?: SpecChange[]
}

export interface SpecChapter {
  title?: string
  synopsis?: string
  events: SpecEvent[]
}

export interface SpecLore {
  category?: string
  title: string
  body?: string
  tags?: string[]
}

export interface SpecReveal {
  who: string
  /** Event slug or title where this character learns the fact. */
  at: string
}

export interface SpecKnowledge {
  title: string
  description?: string
  tags?: string[]
  /** Event slug/title where the fact becomes true in-world. */
  origin?: string
  /** Event slug/title where the reader learns it. */
  readerLearnsAt?: string
  revealedTo?: Array<SpecReveal>
}

export interface WorldSpec {
  format?: string
  version?: number
  world: { name: string; description?: string }
  characters?: SpecCharacter[]
  items?: SpecItem[]
  factions?: SpecFaction[]
  relationships?: SpecRelationship[]
  chapters: SpecChapter[]
  lore?: SpecLore[]
  knowledge?: SpecKnowledge[]
}

const STRENGTHS: RelationshipStrength[] = ['weak', 'moderate', 'strong', 'bond']
const SENTIMENTS: RelationshipSentiment[] = ['positive', 'neutral', 'negative', 'complex']

/** Parse and lightly validate a spec from pasted/loaded JSON. */
export function parseWorldSpec(text: string): { spec?: WorldSpec; error?: string } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { error: 'That isn’t valid JSON. Paste the JSON the AI returned.' }
  }
  if (typeof data !== 'object' || data === null) return { error: 'Expected a JSON object.' }
  const d = data as Record<string, unknown>
  const world = d.world as Record<string, unknown> | undefined
  if (!world || typeof world.name !== 'string' || !world.name.trim()) {
    return { error: 'Missing "world.name".' }
  }
  if (!Array.isArray(d.chapters)) return { error: 'Missing a "chapters" array.' }
  return { spec: data as WorldSpec }
}

/** Preview totals for a spec. */
export function worldSpecStats(spec: WorldSpec): {
  characters: number; chapters: number; events: number; factions: number
} {
  const chapters = Array.isArray(spec.chapters) ? spec.chapters : []
  let events = 0
  for (const c of chapters) events += Array.isArray(c.events) ? c.events.length : 0
  return {
    characters: spec.characters?.length ?? 0,
    chapters: chapters.length,
    events,
    factions: spec.factions?.length ?? 0,
  }
}

/** Case-insensitive, trimmed key for name resolution. */
const key = (s: string) => s.trim().toLowerCase()

/**
 * Expand a compact spec into a full WorldExportFile: mint ids, resolve name and
 * slug references, and rebuild per-character snapshots from the change deltas
 * (a snapshot at each character's first appearance and wherever their state
 * changes — the reader resolves everything in between via the last-known model).
 */
export function expandWorldSpec(spec: WorldSpec, opts: { now?: number } = {}): WorldExportFile {
  const now = opts.now ?? Date.now()
  const worldId = generateId()

  const world: World = {
    id: worldId,
    name: spec.world.name.trim(),
    description: spec.world.description?.trim() ?? '',
    coverImageId: null,
    theme: null,
    continuityStaleThreshold: 5,
    createdAt: now,
    updatedAt: now,
  }

  const timeline: Timeline = {
    id: generateId(),
    worldId,
    name: 'Main Story',
    description: '',
    color: '#6366f1',
    createdAt: now,
  }

  // ── Characters ──────────────────────────────────────────────────────────────
  const charIdByName = new Map<string, string>()
  const characters: Character[] = []
  const initialAlive = new Map<string, boolean>()
  for (const sc of spec.characters ?? []) {
    if (!sc?.name?.trim()) continue
    const id = generateId()
    charIdByName.set(key(sc.name), id)
    for (const a of sc.aliases ?? []) if (a?.trim()) charIdByName.set(key(a), id)
    const alive = sc.alive ?? true
    initialAlive.set(id, alive)
    characters.push({
      id, worldId, name: sc.name.trim(),
      aliases: (sc.aliases ?? []).filter((a) => a?.trim()),
      description: sc.description?.trim() ?? '',
      portraitImageId: null,
      tags: sc.tags ?? [],
      isAlive: alive,
      color: sc.color ?? null,
      createdAt: now, updatedAt: now,
    })
  }
  const resolveChar = (name: string | undefined): string | null =>
    name ? charIdByName.get(key(name)) ?? null : null

  // ── Items ───────────────────────────────────────────────────────────────────
  const itemIdByName = new Map<string, string>()
  const items: Item[] = []
  for (const si of spec.items ?? []) {
    if (!si?.name?.trim()) continue
    const id = generateId()
    itemIdByName.set(key(si.name), id)
    items.push({
      id, worldId, name: si.name.trim(),
      description: si.description?.trim() ?? '',
      iconType: si.icon?.trim() || 'other',
      imageId: null,
      tags: si.tags ?? [],
    })
  }
  const resolveItem = (name: string): string | null => itemIdByName.get(key(name)) ?? null

  // ── Chapters & events (also builds event reference maps) ────────────────────
  const chapters: Chapter[] = []
  const events: WorldEvent[] = []
  const eventIdBySlug = new Map<string, string>()
  const eventIdByTitle = new Map<string, string>()
  /** Ordered event ids, so snapshots can be built in narrative order. */
  const orderedEventIds: string[] = []
  /** Per event id: the parsed spec change list. */
  const changesByEvent = new Map<string, SpecChange[]>()
  /** Per event id: the cast (resolved char ids) for first-appearance detection. */
  const castByEvent = new Map<string, string[]>()

  let chapterNumber = 1
  for (const sch of spec.chapters ?? []) {
    if (!sch) continue
    const chapterId = generateId()
    chapters.push({
      id: chapterId, worldId, timelineId: timeline.id,
      number: chapterNumber++,
      title: sch.title?.trim() ?? '',
      synopsis: sch.synopsis?.trim() ?? '',
      notes: '', wordGoal: null,
      createdAt: now, updatedAt: now,
    })

    let sortOrder = 0
    for (const se of sch.events ?? []) {
      if (!se?.title?.trim()) continue
      const eventId = generateId()
      if (se.id?.trim()) eventIdBySlug.set(key(se.id), eventId)
      if (!eventIdByTitle.has(key(se.title))) eventIdByTitle.set(key(se.title), eventId)
      orderedEventIds.push(eventId)

      const cast = (se.characters ?? []).map(resolveChar).filter((x): x is string => !!x)
      const povId = resolveChar(se.pov)
      if (povId && !cast.includes(povId)) cast.push(povId)
      castByEvent.set(eventId, cast)
      changesByEvent.set(eventId, se.changes ?? [])

      events.push({
        id: eventId, worldId, chapterId, timelineId: timeline.id,
        title: se.title.trim(),
        description: se.description?.trim() ?? '',
        locationMarkerId: null,
        involvedCharacterIds: cast,
        mentionedCharacterIds: (se.mentioned ?? []).map(resolveChar).filter((x): x is string => !!x),
        threadIds: [],
        motifIds: [],
        involvedItemIds: (se.items ?? []).map(resolveItem).filter((x): x is string => !!x),
        tags: se.tags ?? [],
        sortOrder: sortOrder++,
        travelDays: null,
        inWorldTime: null,
        tension: typeof se.tension === 'number' ? Math.max(1, Math.min(5, Math.round(se.tension))) : null,
        structureBeat: se.beat?.trim() || null,
        status: 'draft',
        povCharacterId: povId,
        isFlashback: !!se.flashback,
        createdAt: now, updatedAt: now,
      })
    }
  }
  const resolveEvent = (ref: string | undefined): string | null =>
    ref ? eventIdBySlug.get(key(ref)) ?? eventIdByTitle.get(key(ref)) ?? null : null

  // ── Character snapshots from deltas ─────────────────────────────────────────
  interface RunState { alive: boolean; inventory: string[]; note: string; location: string }
  const state = new Map<string, RunState>()
  const seen = new Set<string>()
  const snapshots: CharacterSnapshot[] = []

  for (const eventId of orderedEventIds) {
    const changes = changesByEvent.get(eventId) ?? []
    const cast = castByEvent.get(eventId) ?? []
    const touched = new Set<string>()

    // First appearances anchor a snapshot even without an explicit change.
    for (const charId of cast) {
      if (!seen.has(charId)) {
        seen.add(charId)
        touched.add(charId)
        if (!state.has(charId)) {
          state.set(charId, { alive: initialAlive.get(charId) ?? true, inventory: [], note: '', location: '' })
        }
      }
    }

    // Apply each change to running state.
    for (const ch of changes) {
      const charId = resolveChar(ch.who)
      if (!charId) continue
      seen.add(charId)
      touched.add(charId)
      const st = state.get(charId) ?? { alive: initialAlive.get(charId) ?? true, inventory: [], note: '', location: '' }
      if (ch.dies) st.alive = false
      if (typeof ch.alive === 'boolean') st.alive = ch.alive
      if (ch.gains) for (const n of ch.gains) { const id = resolveItem(n); if (id && !st.inventory.includes(id)) st.inventory.push(id) }
      if (ch.loses) for (const n of ch.loses) { const id = resolveItem(n); if (id) st.inventory = st.inventory.filter((x) => x !== id) }
      if (typeof ch.location === 'string') st.location = ch.location.trim()
      if (typeof ch.note === 'string') st.note = ch.note.trim()
      state.set(charId, st)
    }

    // Emit a full-state snapshot for every touched character.
    for (const charId of touched) {
      const st = state.get(charId)!
      const statusNotes = st.location
        ? (st.note ? `At ${st.location}. ${st.note}` : `At ${st.location}.`)
        : st.note
      snapshots.push({
        id: generateId(), worldId, characterId: charId, eventId,
        isAlive: st.alive,
        currentLocationMarkerId: null,
        currentMapLayerId: null,
        inventoryItemIds: [...st.inventory],
        inventoryNotes: '',
        statusNotes,
        travelModeId: null,
        sortKey: undefined,
        createdAt: now, updatedAt: now,
      })
    }
  }

  // ── Factions & memberships ──────────────────────────────────────────────────
  const factions: Faction[] = []
  const factionMemberships: FactionMembership[] = []
  for (const sf of spec.factions ?? []) {
    if (!sf?.name?.trim()) continue
    const factionId = generateId()
    factions.push({
      id: factionId, worldId, name: sf.name.trim(),
      description: sf.description?.trim() ?? '',
      color: sf.color?.trim() || '#6366f1',
      coverImageId: null,
      tags: sf.tags ?? [],
      createdAt: now, updatedAt: now,
    })
    for (const m of sf.members ?? []) {
      const memberName = typeof m === 'string' ? m : m?.name
      const role = typeof m === 'string' ? null : (m?.role?.trim() || null)
      const charId = resolveChar(memberName)
      if (!charId) continue
      factionMemberships.push({
        id: generateId(), worldId, factionId, characterId: charId,
        role, startEventId: null, endEventId: null, notes: '',
        createdAt: now, updatedAt: now,
      })
    }
  }

  // ── Relationships ───────────────────────────────────────────────────────────
  const relationships: Relationship[] = []
  for (const sr of spec.relationships ?? []) {
    const aId = resolveChar(sr?.a)
    const bId = resolveChar(sr?.b)
    if (!aId || !bId || aId === bId) continue
    relationships.push({
      id: generateId(), worldId, characterAId: aId, characterBId: bId,
      label: sr.label?.trim() || 'connected',
      strength: STRENGTHS.includes(sr.strength as RelationshipStrength) ? sr.strength as RelationshipStrength : 'moderate',
      sentiment: SENTIMENTS.includes(sr.sentiment as RelationshipSentiment) ? sr.sentiment as RelationshipSentiment : 'neutral',
      description: sr.description?.trim() ?? '',
      isBidirectional: true,
      startEventId: null,
      createdAt: now, updatedAt: now,
    })
  }

  // ── Lore ────────────────────────────────────────────────────────────────────
  const loreCategories: LoreCategory[] = []
  const lorePages: LorePage[] = []
  const categoryIdByName = new Map<string, string>()
  let categoryOrder = 0
  for (const sl of spec.lore ?? []) {
    if (!sl?.title?.trim()) continue
    let categoryId: string | null = null
    if (sl.category?.trim()) {
      const ck = key(sl.category)
      categoryId = categoryIdByName.get(ck) ?? null
      if (!categoryId) {
        categoryId = generateId()
        categoryIdByName.set(ck, categoryId)
        loreCategories.push({ id: categoryId, worldId, name: sl.category.trim(), color: null, sortOrder: categoryOrder++ })
      }
    }
    lorePages.push({
      id: generateId(), worldId, categoryId,
      title: sl.title.trim(),
      body: sl.body?.trim() ?? '',
      tags: sl.tags ?? [],
      coverImageId: null,
      linkedEntityIds: [],
      visibleFromEventId: null,
      createdAt: now, updatedAt: now,
    })
  }

  // ── Knowledge ───────────────────────────────────────────────────────────────
  const knowledgeFacts: KnowledgeFact[] = []
  const knowledgeReveals: KnowledgeReveal[] = []
  for (const sk of spec.knowledge ?? []) {
    if (!sk?.title?.trim()) continue
    const factId = generateId()
    knowledgeFacts.push({
      id: factId, worldId, title: sk.title.trim(),
      description: sk.description?.trim() ?? '',
      tags: sk.tags ?? [],
      readerLearnsAtEventId: resolveEvent(sk.readerLearnsAt),
      originEventId: resolveEvent(sk.origin),
      createdAt: now, updatedAt: now,
    })
    for (const rv of sk.revealedTo ?? []) {
      const charId = resolveChar(rv?.who)
      const eventId = resolveEvent(rv?.at)
      if (!charId || !eventId) continue
      knowledgeReveals.push({
        id: generateId(), worldId, factId, characterId: charId, eventId, note: '',
        createdAt: now, updatedAt: now,
      })
    }
  }

  return {
    version: EXPORT_VERSION,
    type: 'full',
    exportedAt: now,
    world,
    mapLayers: [],
    locationMarkers: [],
    characters,
    items,
    characterSnapshots: snapshots,
    characterMovements: [],
    itemPlacements: [],
    locationSnapshots: [],
    itemSnapshots: [],
    relationships,
    relationshipSnapshots: [],
    timelines: [timeline],
    chapters,
    events,
    blobs: [],
    travelModes: [],
    timelineRelationships: [],
    crossTimelineArtifacts: [],
    mapRoutes: [],
    mapRegions: [],
    mapRegionSnapshots: [],
    mapAnnotations: [],
    loreCategories,
    lorePages,
    factions,
    factionMemberships,
    factionRelationships: [],
    knowledgeFacts,
    knowledgeReveals,
    sceneTexts: [],
    plotThreads: [],
  }
}

/** Expand a spec and import it as a new world; returns the new world id. */
export async function createWorldFromSpec(spec: WorldSpec): Promise<string> {
  const full = expandWorldSpec(spec)
  return importWorldFromJson(JSON.stringify(full))
}
