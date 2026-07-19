import { db } from '@/db/database'
import { generateId } from '@/lib/id'
import { computeSortKey } from '@/lib/sortKey'
import type {
  Character, Item, Faction, FactionMembership, Relationship, RelationshipSnapshot,
  RelationshipStrength, RelationshipSentiment, LoreCategory, LorePage,
  KnowledgeFact, KnowledgeReveal, MapLayer, LocationMarker, LocationIconType, BlobEntry,
} from '@/types'
import type {
  SpecCharacter, SpecItem, SpecFaction, SpecLore, SpecKnowledge, SpecReveal,
} from '@/lib/worldSpec'

const STRENGTHS: RelationshipStrength[] = ['weak', 'moderate', 'strong', 'bond']
const SENTIMENTS: RelationshipSentiment[] = ['positive', 'neutral', 'negative', 'complex']

/** Palette used to colour factions that don't specify their own colour. */
const FACTION_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#64748b', '#a16207',
]

/**
 * Section-scoped AI import: merge one kind of entity (characters, items, …) into
 * an existing world, rather than creating a whole new world the way
 * {@link createWorldFromSpec} does.
 *
 * Each section has a `parse*` (pure, forgiving JSON → typed spec) and an
 * `add*ToWorld`. Entities are referenced by name — no ids. New names are created;
 * a name that already exists in the world is **updated in place**: the fields the
 * AI supplies (non-empty) overwrite the current values, while fields it omits are
 * left untouched, so nothing is silently blanked out. A match whose supplied
 * values change nothing is left alone (counted as skipped). Within a single
 * batch, a repeated name is applied only once.
 */

const key = (s: string) => s.trim().toLowerCase()

export interface SectionMergeResult {
  /** New entities created. */
  added: number
  /** Existing entities whose fields (or associations) changed. */
  updated: number
  /** Entries that produced no change: unchanged matches, invalid entries,
   *  unresolved references, or in-batch duplicates. */
  skipped: number
  /** Names that were added, in order. */
  addedNames: string[]
  /** Names that were updated, in order. */
  updatedNames: string[]
}

/**
 * Keep only the entries of `patch` that actually differ from `existing` (arrays
 * compared by value), so we never issue a no-op write or bump updatedAt for
 * nothing.
 */
function changedFields<T extends object>(existing: T, patch: Partial<T>): Partial<T> {
  const out: Partial<T> = {}
  for (const k of Object.keys(patch) as (keyof T)[]) {
    const nv = patch[k]
    const ov = existing[k]
    const differs = Array.isArray(nv) || Array.isArray(ov)
      ? JSON.stringify(nv) !== JSON.stringify(ov ?? null)
      : nv !== ov
    if (differs) out[k] = nv
  }
  return out
}

/**
 * Pull an array out of pasted JSON that may be a bare array, `{ characters: [] }`,
 * or `{ format, characters: [] }`. Returns the raw array or an error message.
 */
function extractArray(text: string, field: string): { list?: unknown[]; error?: string } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { error: 'That isn’t valid JSON. Paste the JSON the AI returned.' }
  }
  if (Array.isArray(data)) return { list: data }
  if (data && typeof data === 'object') {
    const arr = (data as Record<string, unknown>)[field]
    if (Array.isArray(arr)) return { list: arr }
  }
  return { error: `Expected a JSON array of ${field}, or an object with a "${field}" array.` }
}

// ── Characters ────────────────────────────────────────────────────────────────

/** Parse and lightly validate a characters-only spec. */
export function parseCharactersSpec(text: string): { characters?: SpecCharacter[]; error?: string } {
  const { list, error } = extractArray(text, 'characters')
  if (error) return { error }
  const characters: SpecCharacter[] = []
  for (const raw of list!) {
    if (!raw || typeof raw !== 'object') continue
    const c = raw as Record<string, unknown>
    if (typeof c.name !== 'string' || !c.name.trim()) continue
    characters.push({
      name: c.name,
      aliases: Array.isArray(c.aliases) ? c.aliases.filter((a): a is string => typeof a === 'string') : undefined,
      description: typeof c.description === 'string' ? c.description : undefined,
      tags: Array.isArray(c.tags) ? c.tags.filter((t): t is string => typeof t === 'string') : undefined,
      alive: typeof c.alive === 'boolean' ? c.alive : undefined,
      color: typeof c.color === 'string' ? c.color : undefined,
    })
  }
  if (characters.length === 0) return { error: 'No characters with a "name" were found in that JSON.' }
  return { characters }
}

/** Fields the spec explicitly supplies (non-empty), for overwriting a match. */
function characterPatch(sc: SpecCharacter): Partial<Character> {
  const patch: Partial<Character> = {}
  const desc = sc.description?.trim()
  if (desc) patch.description = desc
  const aliases = (sc.aliases ?? []).map((a) => a.trim()).filter(Boolean)
  if (aliases.length) patch.aliases = aliases
  const tags = (sc.tags ?? []).filter(Boolean)
  if (tags.length) patch.tags = tags
  if (typeof sc.alive === 'boolean') patch.isAlive = sc.alive
  if (sc.color) patch.color = sc.color
  return patch
}

/**
 * Add or update characters in a world. A new name is created; an existing name
 * is updated in place (supplied fields overwrite current values). Repeats within
 * the batch are applied once.
 */
export async function addCharactersToWorld(
  worldId: string,
  characters: SpecCharacter[],
): Promise<SectionMergeResult> {
  const existing = await db.characters.where('worldId').equals(worldId).toArray()
  const byName = new Map(existing.map((c) => [key(c.name), c]))
  const seen = new Set<string>()
  const now = Date.now()
  const toAdd: Character[] = []
  const updates: { id: string; patch: Partial<Character> }[] = []
  const addedNames: string[] = []
  const updatedNames: string[] = []
  let skipped = 0

  for (const sc of characters) {
    const name = sc.name?.trim()
    if (!name) { skipped++; continue }
    const k = key(name)
    if (seen.has(k)) { skipped++; continue }
    seen.add(k)

    const match = byName.get(k)
    if (match) {
      const patch = changedFields(match, characterPatch(sc))
      if (Object.keys(patch).length) { updates.push({ id: match.id, patch }); updatedNames.push(name) }
      else skipped++
      continue
    }
    addedNames.push(name)
    toAdd.push({
      id: generateId(), worldId, name,
      aliases: (sc.aliases ?? []).map((a) => a.trim()).filter(Boolean),
      description: sc.description?.trim() ?? '',
      portraitImageId: null,
      tags: (sc.tags ?? []).filter(Boolean),
      isAlive: sc.alive ?? true,
      color: sc.color ?? null,
      createdAt: now, updatedAt: now,
    })
  }

  if (toAdd.length > 0) await db.characters.bulkAdd(toAdd)
  for (const u of updates) await db.characters.update(u.id, { ...u.patch, updatedAt: now })
  return { added: toAdd.length, updated: updatedNames.length, skipped, addedNames, updatedNames }
}

// ── Items ─────────────────────────────────────────────────────────────────────

/** Parse and lightly validate an items-only spec. */
export function parseItemsSpec(text: string): { items?: SpecItem[]; error?: string } {
  const { list, error } = extractArray(text, 'items')
  if (error) return { error }
  const items: SpecItem[] = []
  for (const raw of list!) {
    if (!raw || typeof raw !== 'object') continue
    const i = raw as Record<string, unknown>
    if (typeof i.name !== 'string' || !i.name.trim()) continue
    items.push({
      name: i.name,
      description: typeof i.description === 'string' ? i.description : undefined,
      icon: typeof i.icon === 'string' ? i.icon : undefined,
      tags: Array.isArray(i.tags) ? i.tags.filter((t): t is string => typeof t === 'string') : undefined,
    })
  }
  if (items.length === 0) return { error: 'No items with a "name" were found in that JSON.' }
  return { items }
}

function itemPatch(si: SpecItem): Partial<Item> {
  const patch: Partial<Item> = {}
  const desc = si.description?.trim()
  if (desc) patch.description = desc
  const icon = si.icon?.trim()
  if (icon) patch.iconType = icon
  const tags = (si.tags ?? []).filter(Boolean)
  if (tags.length) patch.tags = tags
  return patch
}

/** Add or update items in a world (see {@link addCharactersToWorld}). */
export async function addItemsToWorld(
  worldId: string,
  items: SpecItem[],
): Promise<SectionMergeResult> {
  const existing = await db.items.where('worldId').equals(worldId).toArray()
  const byName = new Map(existing.map((i) => [key(i.name), i]))
  const seen = new Set<string>()
  const toAdd: Item[] = []
  const updates: { id: string; patch: Partial<Item> }[] = []
  const addedNames: string[] = []
  const updatedNames: string[] = []
  let skipped = 0

  for (const si of items) {
    const name = si.name?.trim()
    if (!name) { skipped++; continue }
    const k = key(name)
    if (seen.has(k)) { skipped++; continue }
    seen.add(k)

    const match = byName.get(k)
    if (match) {
      const patch = changedFields(match, itemPatch(si))
      if (Object.keys(patch).length) { updates.push({ id: match.id, patch }); updatedNames.push(name) }
      else skipped++
      continue
    }
    addedNames.push(name)
    toAdd.push({
      id: generateId(), worldId, name,
      description: si.description?.trim() ?? '',
      iconType: si.icon?.trim() || 'other',
      imageId: null,
      tags: (si.tags ?? []).filter(Boolean),
    })
  }

  if (toAdd.length > 0) await db.items.bulkAdd(toAdd)
  for (const u of updates) await db.items.update(u.id, u.patch)
  return { added: toAdd.length, updated: updatedNames.length, skipped, addedNames, updatedNames }
}

// ── Factions ──────────────────────────────────────────────────────────────────

/** Parse and lightly validate a factions-only spec. */
export function parseFactionsSpec(text: string): { factions?: SpecFaction[]; error?: string } {
  const { list, error } = extractArray(text, 'factions')
  if (error) return { error }
  const factions: SpecFaction[] = []
  for (const raw of list!) {
    if (!raw || typeof raw !== 'object') continue
    const f = raw as Record<string, unknown>
    if (typeof f.name !== 'string' || !f.name.trim()) continue
    const members: SpecFaction['members'] = []
    if (Array.isArray(f.members)) {
      for (const m of f.members) {
        if (typeof m === 'string') { if (m.trim()) members!.push(m) }
        else if (m && typeof m === 'object') {
          const mm = m as Record<string, unknown>
          if (typeof mm.name === 'string' && mm.name.trim()) {
            members!.push({ name: mm.name, role: typeof mm.role === 'string' ? mm.role : undefined })
          }
        }
      }
    }
    factions.push({
      name: f.name,
      description: typeof f.description === 'string' ? f.description : undefined,
      color: typeof f.color === 'string' ? f.color : undefined,
      tags: Array.isArray(f.tags) ? f.tags.filter((t): t is string => typeof t === 'string') : undefined,
      members,
    })
  }
  if (factions.length === 0) return { error: 'No factions with a "name" were found in that JSON.' }
  return { factions }
}

function factionPatch(sf: SpecFaction): Partial<Faction> {
  const patch: Partial<Faction> = {}
  const desc = sf.description?.trim()
  if (desc) patch.description = desc
  const color = sf.color?.trim()
  if (color) patch.color = color
  const tags = (sf.tags ?? []).filter(Boolean)
  if (tags.length) patch.tags = tags
  return patch
}

/**
 * Add or update factions in a world. Existing factions are updated in place;
 * their members are **unioned** (missing memberships added, none removed).
 * Members reference existing characters by name/alias; unknown names are ignored.
 */
export async function addFactionsToWorld(
  worldId: string,
  factions: SpecFaction[],
): Promise<SectionMergeResult> {
  const existingFactions = await db.factions.where('worldId').equals(worldId).toArray()
  const byName = new Map(existingFactions.map((f) => [key(f.name), f]))

  const chars = await db.characters.where('worldId').equals(worldId).toArray()
  const charIdByName = new Map<string, string>()
  for (const c of chars) {
    charIdByName.set(key(c.name), c.id)
    for (const a of c.aliases ?? []) if (a?.trim()) charIdByName.set(key(a), c.id)
  }

  // Existing memberships per faction, so updates only add what's missing.
  const allMemberships = await db.factionMemberships.where('worldId').equals(worldId).toArray()
  const memberIdsByFaction = new Map<string, Set<string>>()
  for (const m of allMemberships) {
    if (!memberIdsByFaction.has(m.factionId)) memberIdsByFaction.set(m.factionId, new Set())
    memberIdsByFaction.get(m.factionId)!.add(m.characterId)
  }

  const now = Date.now()
  const factionsToAdd: Faction[] = []
  const membershipsToAdd: FactionMembership[] = []
  const updates: { id: string; patch: Partial<Faction> }[] = []
  const seen = new Set<string>()
  const addedNames: string[] = []
  const updatedNames: string[] = []
  let skipped = 0
  let colorIx = existingFactions.length

  /** Resolve the spec's members to (characterId, role), de-duped. */
  function resolveMembers(sf: SpecFaction): { charId: string; role: string | null }[] {
    const out: { charId: string; role: string | null }[] = []
    const used = new Set<string>()
    for (const m of sf.members ?? []) {
      const memberName = typeof m === 'string' ? m : m?.name
      const role = typeof m === 'string' ? null : (m?.role?.trim() || null)
      const charId = memberName ? charIdByName.get(key(memberName)) : undefined
      if (!charId || used.has(charId)) continue
      used.add(charId)
      out.push({ charId, role })
    }
    return out
  }

  for (const sf of factions) {
    const name = sf.name?.trim()
    if (!name) { skipped++; continue }
    const k = key(name)
    if (seen.has(k)) { skipped++; continue }
    seen.add(k)

    const match = byName.get(k)
    if (match) {
      const patch = changedFields(match, factionPatch(sf))
      const existingMembers = memberIdsByFaction.get(match.id) ?? new Set<string>()
      let addedMember = false
      for (const { charId, role } of resolveMembers(sf)) {
        if (existingMembers.has(charId)) continue
        existingMembers.add(charId)
        addedMember = true
        membershipsToAdd.push({
          id: generateId(), worldId, factionId: match.id, characterId: charId,
          role, startEventId: null, endEventId: null, notes: '', createdAt: now, updatedAt: now,
        })
      }
      const changed = Object.keys(patch).length > 0 || addedMember
      if (Object.keys(patch).length) updates.push({ id: match.id, patch })
      if (changed) updatedNames.push(name)
      else skipped++
      continue
    }

    addedNames.push(name)
    const factionId = generateId()
    factionsToAdd.push({
      id: factionId, worldId, name,
      description: sf.description?.trim() ?? '',
      color: sf.color?.trim() || FACTION_COLORS[colorIx++ % FACTION_COLORS.length],
      coverImageId: null,
      tags: (sf.tags ?? []).filter(Boolean),
      createdAt: now, updatedAt: now,
    })
    for (const { charId, role } of resolveMembers(sf)) {
      membershipsToAdd.push({
        id: generateId(), worldId, factionId, characterId: charId,
        role, startEventId: null, endEventId: null, notes: '', createdAt: now, updatedAt: now,
      })
    }
  }

  if (factionsToAdd.length > 0) await db.factions.bulkAdd(factionsToAdd)
  if (membershipsToAdd.length > 0) await db.factionMemberships.bulkAdd(membershipsToAdd)
  for (const u of updates) await db.factions.update(u.id, { ...u.patch, updatedAt: now })
  return { added: factionsToAdd.length, updated: updatedNames.length, skipped, addedNames, updatedNames }
}

// ── Relationships ─────────────────────────────────────────────────────────────

/**
 * How a relationship stands at one event. Relationships are snapshot-aware — they
 * evolve over the story (allies → rivals → reconciled) — so a change records the
 * state from a given event onward. Fields omitted here inherit the base
 * relationship's values.
 */
export interface SpecRelationshipChange {
  /** Event title (must already exist) where this state takes effect. */
  at: string
  label?: string
  strength?: RelationshipStrength
  sentiment?: RelationshipSentiment
  description?: string
  /** true = the relationship has ended (or not yet formed) at this event. */
  ended?: boolean
}

export interface SpecRelationship {
  a: string
  b: string
  label?: string
  strength?: RelationshipStrength
  sentiment?: RelationshipSentiment
  description?: string
  /** Per-event snapshots capturing how the relationship changes over time. */
  changes?: SpecRelationshipChange[]
}

/** Parse and lightly validate a relationships-only spec. */
export function parseRelationshipsSpec(text: string): { relationships?: SpecRelationship[]; error?: string } {
  const { list, error } = extractArray(text, 'relationships')
  if (error) return { error }
  const relationships: SpecRelationship[] = []
  for (const raw of list!) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    if (typeof r.a !== 'string' || !r.a.trim() || typeof r.b !== 'string' || !r.b.trim()) continue
    const changes: SpecRelationshipChange[] = []
    if (Array.isArray(r.changes)) {
      for (const rc of r.changes) {
        if (!rc || typeof rc !== 'object') continue
        const c = rc as Record<string, unknown>
        if (typeof c.at !== 'string' || !c.at.trim()) continue
        changes.push({
          at: c.at,
          label: typeof c.label === 'string' ? c.label : undefined,
          strength: STRENGTHS.includes(c.strength as RelationshipStrength) ? c.strength as RelationshipStrength : undefined,
          sentiment: SENTIMENTS.includes(c.sentiment as RelationshipSentiment) ? c.sentiment as RelationshipSentiment : undefined,
          description: typeof c.description === 'string' ? c.description : undefined,
          ended: typeof c.ended === 'boolean' ? c.ended : undefined,
        })
      }
    }
    relationships.push({
      a: r.a,
      b: r.b,
      label: typeof r.label === 'string' ? r.label : undefined,
      strength: STRENGTHS.includes(r.strength as RelationshipStrength) ? r.strength as RelationshipStrength : undefined,
      sentiment: SENTIMENTS.includes(r.sentiment as RelationshipSentiment) ? r.sentiment as RelationshipSentiment : undefined,
      description: typeof r.description === 'string' ? r.description : undefined,
      changes,
    })
  }
  if (relationships.length === 0) return { error: 'No relationships with both an "a" and "b" character were found in that JSON.' }
  return { relationships }
}

/** Unordered key for a character pair, so A–B and B–A count as the same edge. */
const pairKey = (x: string, y: string) => [x, y].sort().join('::')

function relationshipPatch(sr: SpecRelationship): Partial<Relationship> {
  const patch: Partial<Relationship> = {}
  const label = sr.label?.trim()
  if (label) patch.label = label
  if (sr.strength) patch.strength = sr.strength
  if (sr.sentiment) patch.sentiment = sr.sentiment
  const desc = sr.description?.trim()
  if (desc) patch.description = desc
  return patch
}

/** The default (base-relationship) fields a snapshot inherits when unspecified. */
interface RelBase { label: string; strength: RelationshipStrength; sentiment: RelationshipSentiment; description: string }

/**
 * Write the per-event snapshots for one relationship. Each change's `at` resolves
 * to an existing event by title; unresolved changes are dropped. Returns whether
 * any snapshot was written. Reuses (relationshipId, eventId) so re-running is
 * idempotent.
 */
async function applyRelationshipChanges(
  worldId: string,
  relationshipId: string,
  base: RelBase,
  changes: SpecRelationshipChange[] | undefined,
  eventIdByTitle: Map<string, string>,
): Promise<boolean> {
  let wrote = false
  const now = Date.now()
  for (const ch of changes ?? []) {
    const eventId = ch.at ? eventIdByTitle.get(key(ch.at)) : undefined
    if (!eventId) continue
    const data = {
      worldId, relationshipId, eventId,
      label: ch.label?.trim() || base.label,
      strength: ch.strength ?? base.strength,
      sentiment: ch.sentiment ?? base.sentiment,
      description: ch.description?.trim() ?? base.description,
      isActive: !ch.ended,
    }
    const sortKey = await computeSortKey(eventId)
    const existing = await db.relationshipSnapshots
      .where('[relationshipId+eventId]').equals([relationshipId, eventId]).first()
    if (existing) {
      await db.relationshipSnapshots.put({ ...existing, ...data, sortKey, updatedAt: now })
    } else {
      const snap: RelationshipSnapshot = { id: generateId(), ...data, sortKey, createdAt: now, updatedAt: now }
      await db.relationshipSnapshots.add(snap)
    }
    wrote = true
  }
  return wrote
}

/**
 * Add or update relationships in a world. Endpoints match existing characters by
 * name/alias; an entry is skipped when either endpoint is unknown or both are the
 * same character. An existing pair (either order) is updated in place; a new pair
 * is created. Relationships are snapshot-aware: a change's per-event state is
 * written as a RelationshipSnapshot (its `at` references an existing event by
 * title), so the graph reflects how the bond evolves as the time cursor moves.
 */
export async function addRelationshipsToWorld(
  worldId: string,
  relationships: SpecRelationship[],
): Promise<SectionMergeResult> {
  const chars = await db.characters.where('worldId').equals(worldId).toArray()
  const charIdByName = new Map<string, string>()
  for (const c of chars) {
    charIdByName.set(key(c.name), c.id)
    for (const a of c.aliases ?? []) if (a?.trim()) charIdByName.set(key(a), c.id)
  }

  // Event title → id (first occurrence wins), for resolving change `at` refs.
  const events = await db.events.where('worldId').equals(worldId).toArray()
  const eventIdByTitle = new Map<string, string>()
  for (const e of events) if (!eventIdByTitle.has(key(e.title))) eventIdByTitle.set(key(e.title), e.id)

  const existing = await db.relationships.where('worldId').equals(worldId).toArray()
  const byPair = new Map(existing.map((r) => [pairKey(r.characterAId, r.characterBId), r]))

  const now = Date.now()
  const toAdd: Relationship[] = []
  const pendingChanges: { relationshipId: string; base: RelBase; changes?: SpecRelationshipChange[] }[] = []
  const seen = new Set<string>()
  const addedNames: string[] = []
  const updatedNames: string[] = []
  let skipped = 0

  for (const sr of relationships) {
    const aId = sr.a ? charIdByName.get(key(sr.a)) : undefined
    const bId = sr.b ? charIdByName.get(key(sr.b)) : undefined
    if (!aId || !bId || aId === bId) { skipped++; continue }
    const pk = pairKey(aId, bId)
    if (seen.has(pk)) { skipped++; continue }
    seen.add(pk)
    const label = `${sr.a.trim()} ↔ ${sr.b.trim()}`

    const match = byPair.get(pk)
    if (match) {
      const patch = changedFields(match, relationshipPatch(sr))
      const base: RelBase = {
        label: (patch.label ?? match.label),
        strength: (patch.strength ?? match.strength),
        sentiment: (patch.sentiment ?? match.sentiment),
        description: (patch.description ?? match.description),
      }
      const wroteSnap = await applyRelationshipChanges(worldId, match.id, base, sr.changes, eventIdByTitle)
      if (Object.keys(patch).length) await db.relationships.update(match.id, { ...patch, updatedAt: now })
      if (Object.keys(patch).length > 0 || wroteSnap) updatedNames.push(label)
      else skipped++
      continue
    }

    addedNames.push(label)
    const rel: Relationship = {
      id: generateId(), worldId, characterAId: aId, characterBId: bId,
      label: sr.label?.trim() || 'connected',
      strength: sr.strength ?? 'moderate',
      sentiment: sr.sentiment ?? 'neutral',
      description: sr.description?.trim() ?? '',
      isBidirectional: true,
      startEventId: null,
      createdAt: now, updatedAt: now,
    }
    toAdd.push(rel)
    if (sr.changes && sr.changes.length > 0) {
      pendingChanges.push({
        relationshipId: rel.id,
        base: { label: rel.label, strength: rel.strength, sentiment: rel.sentiment, description: rel.description },
        changes: sr.changes,
      })
    }
  }

  if (toAdd.length > 0) await db.relationships.bulkAdd(toAdd)
  for (const p of pendingChanges) await applyRelationshipChanges(worldId, p.relationshipId, p.base, p.changes, eventIdByTitle)
  return { added: toAdd.length, updated: updatedNames.length, skipped, addedNames, updatedNames }
}

// ── Lore ──────────────────────────────────────────────────────────────────────

/** Parse and lightly validate a lore-only spec (categorised wiki pages). */
export function parseLoreSpec(text: string): { lore?: SpecLore[]; error?: string } {
  const { list, error } = extractArray(text, 'lore')
  if (error) return { error }
  const lore: SpecLore[] = []
  for (const raw of list!) {
    if (!raw || typeof raw !== 'object') continue
    const l = raw as Record<string, unknown>
    if (typeof l.title !== 'string' || !l.title.trim()) continue
    lore.push({
      title: l.title,
      category: typeof l.category === 'string' ? l.category : undefined,
      body: typeof l.body === 'string' ? l.body : undefined,
      tags: Array.isArray(l.tags) ? l.tags.filter((t): t is string => typeof t === 'string') : undefined,
    })
  }
  if (lore.length === 0) return { error: 'No lore pages with a "title" were found in that JSON.' }
  return { lore }
}

/**
 * Add or update lore pages in a world (matched by title). Categories are matched
 * to existing ones by name and created on demand.
 */
export async function addLoreToWorld(
  worldId: string,
  lore: SpecLore[],
): Promise<SectionMergeResult> {
  const existingPages = await db.lorePages.where('worldId').equals(worldId).toArray()
  const byTitle = new Map(existingPages.map((p) => [key(p.title), p]))

  const existingCats = await db.loreCategories.where('worldId').equals(worldId).toArray()
  const categoryIdByName = new Map<string, string>()
  for (const c of existingCats) categoryIdByName.set(key(c.name), c.id)
  let categoryOrder = existingCats.length

  const now = Date.now()
  const categoriesToAdd: LoreCategory[] = []
  const pagesToAdd: LorePage[] = []
  const updates: { id: string; patch: Partial<LorePage> }[] = []
  const seen = new Set<string>()
  const addedNames: string[] = []
  const updatedNames: string[] = []
  let skipped = 0

  /** Resolve a category name to an id, creating the category if new. */
  function categoryFor(name: string | undefined): string | null {
    if (!name?.trim()) return null
    const ck = key(name)
    let id = categoryIdByName.get(ck) ?? null
    if (!id) {
      id = generateId()
      categoryIdByName.set(ck, id)
      categoriesToAdd.push({ id, worldId, name: name.trim(), color: null, sortOrder: categoryOrder++ })
    }
    return id
  }

  for (const sl of lore) {
    const title = sl.title?.trim()
    if (!title) { skipped++; continue }
    const k = key(title)
    if (seen.has(k)) { skipped++; continue }
    seen.add(k)

    const match = byTitle.get(k)
    if (match) {
      const patch: Partial<LorePage> = {}
      const body = sl.body?.trim()
      if (body) patch.body = body
      const tags = (sl.tags ?? []).filter(Boolean)
      if (tags.length) patch.tags = tags
      if (sl.category?.trim()) patch.categoryId = categoryFor(sl.category)
      const pruned = changedFields(match, patch)
      if (Object.keys(pruned).length) { updates.push({ id: match.id, patch: pruned }); updatedNames.push(title) }
      else skipped++
      continue
    }

    addedNames.push(title)
    pagesToAdd.push({
      id: generateId(), worldId, categoryId: categoryFor(sl.category),
      title,
      body: sl.body?.trim() ?? '',
      tags: (sl.tags ?? []).filter(Boolean),
      coverImageId: null,
      linkedEntityIds: [],
      visibleFromEventId: null,
      createdAt: now, updatedAt: now,
    })
  }

  if (categoriesToAdd.length > 0) await db.loreCategories.bulkAdd(categoriesToAdd)
  if (pagesToAdd.length > 0) await db.lorePages.bulkAdd(pagesToAdd)
  for (const u of updates) await db.lorePages.update(u.id, { ...u.patch, updatedAt: now })
  return { added: pagesToAdd.length, updated: updatedNames.length, skipped, addedNames, updatedNames }
}

// ── Knowledge ─────────────────────────────────────────────────────────────────

/** Parse and lightly validate a knowledge-only spec (facts + reveals). */
export function parseKnowledgeSpec(text: string): { knowledge?: SpecKnowledge[]; error?: string } {
  const { list, error } = extractArray(text, 'knowledge')
  if (error) return { error }
  const knowledge: SpecKnowledge[] = []
  for (const raw of list!) {
    if (!raw || typeof raw !== 'object') continue
    const k = raw as Record<string, unknown>
    if (typeof k.title !== 'string' || !k.title.trim()) continue
    const revealedTo: SpecReveal[] = []
    if (Array.isArray(k.revealedTo)) {
      for (const rv of k.revealedTo) {
        if (rv && typeof rv === 'object') {
          const r = rv as Record<string, unknown>
          if (typeof r.who === 'string' && r.who.trim() && typeof r.at === 'string' && r.at.trim()) {
            revealedTo.push({ who: r.who, at: r.at })
          }
        }
      }
    }
    knowledge.push({
      title: k.title,
      description: typeof k.description === 'string' ? k.description : undefined,
      tags: Array.isArray(k.tags) ? k.tags.filter((t): t is string => typeof t === 'string') : undefined,
      origin: typeof k.origin === 'string' ? k.origin : undefined,
      readerLearnsAt: typeof k.readerLearnsAt === 'string' ? k.readerLearnsAt : undefined,
      revealedTo,
    })
  }
  if (knowledge.length === 0) return { error: 'No knowledge facts with a "title" were found in that JSON.' }
  return { knowledge }
}

/**
 * Add or update knowledge facts in a world (matched by title). `origin` /
 * `readerLearnsAt` and each reveal's `at` reference existing events BY TITLE;
 * `who` references existing characters by name/alias. Unresolved references are
 * dropped. On an existing fact, reveals are **unioned** (missing ones added).
 */
export async function addKnowledgeToWorld(
  worldId: string,
  knowledge: SpecKnowledge[],
): Promise<SectionMergeResult> {
  const existingFacts = await db.knowledgeFacts.where('worldId').equals(worldId).toArray()
  const byTitle = new Map(existingFacts.map((f) => [key(f.title), f]))

  const events = await db.events.where('worldId').equals(worldId).toArray()
  const eventIdByTitle = new Map<string, string>()
  for (const e of events) if (!eventIdByTitle.has(key(e.title))) eventIdByTitle.set(key(e.title), e.id)
  const resolveEvent = (ref: string | undefined): string | null =>
    ref ? eventIdByTitle.get(key(ref)) ?? null : null

  const chars = await db.characters.where('worldId').equals(worldId).toArray()
  const charIdByName = new Map<string, string>()
  for (const c of chars) {
    charIdByName.set(key(c.name), c.id)
    for (const a of c.aliases ?? []) if (a?.trim()) charIdByName.set(key(a), c.id)
  }

  const allReveals = await db.knowledgeReveals.where('worldId').equals(worldId).toArray()
  const revealKeysByFact = new Map<string, Set<string>>()
  for (const r of allReveals) {
    if (!revealKeysByFact.has(r.factId)) revealKeysByFact.set(r.factId, new Set())
    revealKeysByFact.get(r.factId)!.add(`${r.characterId}::${r.eventId}`)
  }

  const now = Date.now()
  const factsToAdd: KnowledgeFact[] = []
  const revealsToAdd: KnowledgeReveal[] = []
  const updates: { id: string; patch: Partial<KnowledgeFact> }[] = []
  const seen = new Set<string>()
  const addedNames: string[] = []
  const updatedNames: string[] = []
  let skipped = 0

  /** Resolve the spec's reveals to (characterId, eventId), both required. */
  function resolveReveals(sk: SpecKnowledge): { characterId: string; eventId: string }[] {
    const out: { characterId: string; eventId: string }[] = []
    for (const rv of sk.revealedTo ?? []) {
      const characterId = rv?.who ? charIdByName.get(key(rv.who)) : undefined
      const eventId = resolveEvent(rv?.at)
      if (characterId && eventId) out.push({ characterId, eventId })
    }
    return out
  }

  for (const sk of knowledge) {
    const title = sk.title?.trim()
    if (!title) { skipped++; continue }
    const k = key(title)
    if (seen.has(k)) { skipped++; continue }
    seen.add(k)

    const match = byTitle.get(k)
    if (match) {
      const patch: Partial<KnowledgeFact> = {}
      const desc = sk.description?.trim()
      if (desc) patch.description = desc
      const tags = (sk.tags ?? []).filter(Boolean)
      if (tags.length) patch.tags = tags
      const origin = resolveEvent(sk.origin)
      if (origin) patch.originEventId = origin
      const reader = resolveEvent(sk.readerLearnsAt)
      if (reader) patch.readerLearnsAtEventId = reader
      const pruned = changedFields(match, patch)

      const existingKeys = revealKeysByFact.get(match.id) ?? new Set<string>()
      let addedReveal = false
      for (const { characterId, eventId } of resolveReveals(sk)) {
        const rk = `${characterId}::${eventId}`
        if (existingKeys.has(rk)) continue
        existingKeys.add(rk)
        addedReveal = true
        revealsToAdd.push({ id: generateId(), worldId, factId: match.id, characterId, eventId, note: '', createdAt: now, updatedAt: now })
      }
      const changed = Object.keys(pruned).length > 0 || addedReveal
      if (Object.keys(pruned).length) updates.push({ id: match.id, patch: pruned })
      if (changed) updatedNames.push(title)
      else skipped++
      continue
    }

    addedNames.push(title)
    const factId = generateId()
    factsToAdd.push({
      id: factId, worldId, title,
      description: sk.description?.trim() ?? '',
      tags: (sk.tags ?? []).filter(Boolean),
      readerLearnsAtEventId: resolveEvent(sk.readerLearnsAt),
      originEventId: resolveEvent(sk.origin),
      createdAt: now, updatedAt: now,
    })
    for (const { characterId, eventId } of resolveReveals(sk)) {
      revealsToAdd.push({ id: generateId(), worldId, factId, characterId, eventId, note: '', createdAt: now, updatedAt: now })
    }
  }

  if (factsToAdd.length > 0) await db.knowledgeFacts.bulkAdd(factsToAdd)
  if (revealsToAdd.length > 0) await db.knowledgeReveals.bulkAdd(revealsToAdd)
  for (const u of updates) await db.knowledgeFacts.update(u.id, { ...u.patch, updatedAt: now })
  return { added: factsToAdd.length, updated: updatedNames.length, skipped, addedNames, updatedNames }
}

// ── Locations ─────────────────────────────────────────────────────────────────

/** A node in a location tree. Children nest into a sub-map of their parent. */
/** One floor/level of a place, holding the locations on that floor. */
export interface SpecLevel {
  name: string
  children?: SpecLocation[]
}

export interface SpecLocation {
  name: string
  description?: string
  /** city | town | dungeon | landmark | building | region | custom */
  type?: string
  children?: SpecLocation[]
  /** Floors of this place (a castle's dungeons, ground floor, upper floors…). */
  levels?: SpecLevel[]
}

const LOCATION_ICON_TYPES: LocationIconType[] = ['city', 'town', 'dungeon', 'landmark', 'building', 'region', 'custom']

/** Dimensions of the auto-created placeholder map(s), in pixels. */
const PLACEHOLDER_W = 1600
const PLACEHOLDER_H = 1000
/** Reused name for the auto-created root map, so re-runs extend it. */
export const LOCATIONS_MAP_NAME = 'Locations'

function parseLocationNodes(list: unknown[]): SpecLocation[] {
  const out: SpecLocation[] = []
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue
    const l = raw as Record<string, unknown>
    if (typeof l.name !== 'string' || !l.name.trim()) continue
    out.push({
      name: l.name,
      description: typeof l.description === 'string' ? l.description : undefined,
      type: typeof l.type === 'string' ? l.type : undefined,
      children: Array.isArray(l.children) ? parseLocationNodes(l.children) : undefined,
      levels: Array.isArray(l.levels) ? parseLevelNodes(l.levels) : undefined,
    })
  }
  return out
}

function parseLevelNodes(list: unknown[]): SpecLevel[] {
  const out: SpecLevel[] = []
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue
    const l = raw as Record<string, unknown>
    if (typeof l.name !== 'string' || !l.name.trim()) continue
    out.push({
      name: l.name,
      children: Array.isArray(l.children) ? parseLocationNodes(l.children) : undefined,
    })
  }
  return out
}

/**
 * Strip a stray wrapper node named after the reserved map (e.g. an AI that
 * puts every place under a single "Locations" root): promote such a node's
 * children to the top level so we never create a "Locations" location that then
 * perpetuates itself in the next prompt.
 */
function unwrapReservedRoots(nodes: SpecLocation[]): SpecLocation[] {
  const out: SpecLocation[] = []
  for (const n of nodes) {
    if (key(n.name) === key(LOCATIONS_MAP_NAME)) {
      if (n.children && n.children.length) out.push(...unwrapReservedRoots(n.children))
      // A bare "Locations" node with no children is dropped entirely.
    } else {
      out.push(n)
    }
  }
  return out
}

/** Parse and lightly validate a locations tree. */
export function parseLocationsSpec(text: string): { locations?: SpecLocation[]; error?: string } {
  const { list, error } = extractArray(text, 'locations')
  if (error) return { error }
  const locations = unwrapReservedRoots(parseLocationNodes(list!))
  if (locations.length === 0) return { error: 'No locations with a "name" were found in that JSON.' }
  return { locations }
}

/** Total number of place nodes in a location tree (children and floor locations). */
export function countLocations(nodes: SpecLocation[]): number {
  let n = 0
  for (const node of nodes) {
    n += 1 + (node.children ? countLocations(node.children) : 0)
    for (const lvl of node.levels ?? []) n += lvl.children ? countLocations(lvl.children) : 0
  }
  return n
}

/**
 * Render a world's existing location markers as an indented tree (following
 * sub-map links), so a generation prompt can tell the AI what's already there
 * and it can extend rather than repeat. Returns '' when there are none.
 */
export function formatLocationTree(
  layers: (Pick<MapLayer, 'id' | 'parentMapId'> & Partial<Pick<MapLayer, 'levelGroupId' | 'levelIndex' | 'levelLabel'>>)[],
  markers: Pick<LocationMarker, 'name' | 'mapLayerId' | 'linkedMapLayerId'>[],
): string {
  type M = Pick<LocationMarker, 'name' | 'mapLayerId' | 'linkedMapLayerId'>
  const byLayer = new Map<string, M[]>()
  for (const m of markers) {
    if (!byLayer.has(m.mapLayerId)) byLayer.set(m.mapLayerId, [])
    byLayer.get(m.mapLayerId)!.push(m)
  }
  const byId = new Map(layers.map((l) => [l.id, l]))
  const lines: string[] = []
  const visited = new Set<string>()
  const pad = (d: number) => '  '.repeat(d)

  function listMarkers(layerId: string, depth: number) {
    for (const m of byLayer.get(layerId) ?? []) {
      lines.push(`${pad(depth)}- ${m.name}`)
      if (m.linkedMapLayerId) walk(m.linkedMapLayerId, depth + 1)
    }
  }

  function walk(layerId: string, depth: number) {
    if (visited.has(layerId)) return
    const layer = byId.get(layerId)
    // A leveled place: show each floor as a header with its own locations nested.
    if (layer?.levelGroupId) {
      const floors = layers
        .filter((l) => l.levelGroupId === layer.levelGroupId)
        .sort((a, b) => (a.levelIndex ?? 0) - (b.levelIndex ?? 0) || a.id.localeCompare(b.id))
      for (const f of floors) visited.add(f.id)
      if (floors.length > 1) {
        for (const f of floors) {
          lines.push(`${pad(depth)}[${f.levelLabel || 'Level'}]`)
          listMarkers(f.id, depth + 1)
        }
        return
      }
      // A degenerate one-floor group reads like a normal map.
    }
    visited.add(layerId)
    listMarkers(layerId, depth)
  }

  for (const root of layers.filter((l) => l.parentMapId === null)) walk(root.id, 0)
  // List any markers on layers not reached from a root, so nothing is missed.
  for (const l of layers) if (!visited.has(l.id) && byLayer.has(l.id)) walk(l.id, 0)
  return lines.join('\n')
}

function iconTypeFor(node: SpecLocation): LocationIconType {
  const t = node.type?.trim().toLowerCase()
  if (t && LOCATION_ICON_TYPES.includes(t as LocationIconType)) return t as LocationIconType
  if (node.levels && node.levels.length > 0) return 'building' // a floored place
  return node.children && node.children.length > 0 ? 'region' : 'landmark'
}

/** Grid position for the i-th marker on a `w`×`h` map, clamped within margins. */
function positionForIndex(i: number, w: number, h: number): { x: number; y: number } {
  const cols = 6
  const mx = w * 0.1, my = h * 0.1
  const cw = (w - 2 * mx) / Math.max(1, cols - 1)
  const rh = (h - 2 * my) / 8
  const col = i % cols, row = Math.floor(i / cols)
  return {
    x: Math.round(mx + col * cw),
    y: Math.round(Math.min(h - my, my + row * rh)),
  }
}

/** A blank placeholder map image + its dimensions. */
export interface PlaceholderImage { blob: Blob; width: number; height: number }

/** Runtime default: draw a subtle blank canvas to stand in for a map image. */
async function defaultPlaceholderImage(): Promise<PlaceholderImage> {
  const canvas = document.createElement('canvas')
  canvas.width = PLACEHOLDER_W
  canvas.height = PLACEHOLDER_H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, PLACEHOLDER_W, PLACEHOLDER_H)
  ctx.strokeStyle = 'rgba(148,163,184,0.12)'
  ctx.lineWidth = 1
  for (let x = 0; x <= PLACEHOLDER_W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, PLACEHOLDER_H); ctx.stroke() }
  for (let y = 0; y <= PLACEHOLDER_H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PLACEHOLDER_W, y); ctx.stroke() }
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render placeholder map'))), 'image/png'))
  return { blob, width: PLACEHOLDER_W, height: PLACEHOLDER_H }
}

/**
 * Add a location tree to a world. Locations are markers on an auto-created
 * "Locations" placeholder map (reused across runs); a location with children
 * gets a linked sub-map holding them, recursively.
 *
 * Markers are matched by name **globally across the whole world**, not per map:
 * a place that already exists anywhere is updated in place and its new children
 * are added under it — so re-running (or an AI that re-nests an existing place
 * under a different parent) never creates a duplicate. A place's position in the
 * tree is fixed when it's first created. `makeImage` is injectable for testing.
 */
export async function addLocationsToWorld(
  worldId: string,
  locations: SpecLocation[],
  makeImage: () => Promise<PlaceholderImage> = defaultPlaceholderImage,
): Promise<SectionMergeResult> {
  const now = Date.now()
  let added = 0, updated = 0, skipped = 0
  const addedNames: string[] = []
  const updatedNames: string[] = []

  // One placeholder image, shared by the root map and every sub-map. Created
  // lazily so an all-unchanged re-run needn't render anything.
  let sharedImageId: string | null = null
  let imageDims: { width: number; height: number } = { width: PLACEHOLDER_W, height: PLACEHOLDER_H }
  async function imageId(): Promise<string> {
    if (sharedImageId) return sharedImageId
    const { blob, width, height } = await makeImage()
    const entry: BlobEntry = { id: generateId(), worldId, mimeType: blob.type || 'image/png', data: blob, createdAt: now }
    await db.blobs.add(entry)
    sharedImageId = entry.id
    imageDims = { width, height }
    return entry.id
  }

  async function createLayer(
    parentMapId: string | null,
    name: string,
    level?: { levelGroupId: string; levelIndex: number; levelLabel: string },
  ): Promise<MapLayer> {
    const id = await imageId()
    const layer: MapLayer = {
      id: generateId(), worldId, parentMapId, name,
      description: '', imageId: id,
      imageWidth: imageDims.width, imageHeight: imageDims.height,
      scalePixelsPerUnit: null, scaleUnit: null,
      levelGroupId: level?.levelGroupId ?? null,
      levelIndex: level?.levelIndex ?? 0,
      levelLabel: level?.levelLabel ?? '',
      createdAt: now, updatedAt: now,
    }
    await db.mapLayers.add(layer)
    return layer
  }

  // Global, world-wide index: place name → its (single) marker. First occurrence
  // wins, so a name that somehow already repeats collapses to one canonical place.
  const allMarkers = await db.locationMarkers.where('worldId').equals(worldId).toArray()
  const markerByName = new Map<string, LocationMarker>()
  for (const m of allMarkers) if (!markerByName.has(key(m.name))) markerByName.set(key(m.name), m)
  const countByLayer = new Map<string, number>()
  for (const m of allMarkers) countByLayer.set(m.mapLayerId, (countByLayer.get(m.mapLayerId) ?? 0) + 1)

  // Reuse an existing root "Locations" map if one is already there.
  const rootLayers = await db.mapLayers.where('worldId').equals(worldId).toArray()
  let rootMap = rootLayers.find((l) => l.parentMapId === null && key(l.name) === key(LOCATIONS_MAP_NAME)) ?? null

  /** Ensure a marker has a sub-map to hold children; returns its id. */
  async function ensureSubMap(marker: LocationMarker): Promise<string> {
    if (marker.linkedMapLayerId) return marker.linkedMapLayerId
    const sub = await createLayer(marker.mapLayerId, marker.name)
    await db.locationMarkers.update(marker.id, { linkedMapLayerId: sub.id, updatedAt: now })
    marker.linkedMapLayerId = sub.id
    return sub.id
  }

  /**
   * Turn a marker's sub-map into a level group and place each floor's locations.
   * The marker's sub-map is the ground floor (representative); further levels are
   * stacked above. Re-runs reuse a floor by its label instead of duplicating it.
   * Returns true if it created or changed any floor structure.
   */
  async function placeLevels(marker: LocationMarker, levels: SpecLevel[]): Promise<boolean> {
    if (levels.length === 0) return false
    let structural = false

    // Ground floor = the marker's sub-map.
    const groundId = await ensureSubMap(marker) // may create it (structural, but tracked by caller)
    const ground = (await db.mapLayers.get(groundId))!
    let groupId = ground.levelGroupId
    if (!groupId) {
      groupId = generateId()
      await db.mapLayers.update(groundId, {
        levelGroupId: groupId,
        levelIndex: 0,
        levelLabel: levels[0].name.trim() || ground.levelLabel || 'Ground floor',
        updatedAt: now,
      })
      structural = true
    }

    // Existing floors, indexed by label, plus the next free index above the top.
    const groupLayers = await db.mapLayers.where('levelGroupId').equals(groupId).toArray()
    const floorByLabel = new Map<string, MapLayer>()
    for (const l of groupLayers) floorByLabel.set(key(l.levelLabel), l)
    let nextIndex = groupLayers.length ? Math.max(...groupLayers.map((l) => l.levelIndex)) + 1 : 1

    for (let i = 0; i < levels.length; i++) {
      const lvl = levels[i]
      const label = lvl.name.trim()
      let floorId: string
      if (i === 0) {
        floorId = groundId // the representative is always the first level
      } else {
        const existingFloor = floorByLabel.get(key(label))
        if (existingFloor) {
          floorId = existingFloor.id
        } else {
          const floor = await createLayer(marker.mapLayerId, marker.name, {
            levelGroupId: groupId, levelIndex: nextIndex++, levelLabel: label || `Level ${i}`,
          })
          floorByLabel.set(key(label), floor)
          floorId = floor.id
          structural = true
        }
      }
      if (lvl.children && lvl.children.length > 0) await placeNodes(lvl.children, floorId)
    }
    return structural
  }

  async function placeNodes(nodes: SpecLocation[], mapLayerId: string): Promise<void> {
    for (const node of nodes) {
      const name = node.name.trim()
      if (!name) { skipped++; continue }
      const k = key(name)
      const existing = markerByName.get(k)

      if (existing) {
        // Update the canonical place in place, wherever it lives — never re-parent
        // or duplicate it. New children still attach under it.
        const patch: Partial<LocationMarker> = {}
        const desc = node.description?.trim()
        if (desc) patch.description = desc
        patch.iconType = iconTypeFor(node)
        const pruned = changedFields(existing, patch)
        let structural = false
        let subId = existing.linkedMapLayerId
        if (node.levels && node.levels.length > 0) {
          // Floors take over the sub-map; build/extend the level group.
          if (await placeLevels(existing, node.levels)) structural = true
          subId = existing.linkedMapLayerId
        } else if (node.children && node.children.length > 0 && !subId) {
          subId = await ensureSubMap(existing) // counts as a structural change
          structural = true
        }
        if (Object.keys(pruned).length) await db.locationMarkers.update(existing.id, { ...pruned, updatedAt: now })
        if (Object.keys(pruned).length > 0 || structural) { updated++; updatedNames.push(name) }
        else skipped++
        if (!node.levels?.length && node.children && node.children.length > 0 && subId) await placeNodes(node.children, subId)
        continue
      }

      // New place — create it on the current map layer.
      const idx = countByLayer.get(mapLayerId) ?? 0
      countByLayer.set(mapLayerId, idx + 1)
      const pos = positionForIndex(idx, imageDims.width, imageDims.height)
      const hasLevels = !!(node.levels && node.levels.length > 0)
      let subId: string | null = null
      if (!hasLevels && node.children && node.children.length > 0) subId = (await createLayer(mapLayerId, name)).id
      const marker: LocationMarker = {
        id: generateId(), worldId, mapLayerId,
        linkedMapLayerId: subId,
        name,
        description: node.description?.trim() ?? '',
        x: pos.x, y: pos.y,
        iconType: iconTypeFor(node),
        tags: [], factionId: null,
        createdAt: now, updatedAt: now,
      }
      await db.locationMarkers.add(marker)
      markerByName.set(k, marker)
      added++; addedNames.push(name)
      if (hasLevels) await placeLevels(marker, node.levels!)
      else if (subId) await placeNodes(node.children!, subId)
    }
  }

  if (!rootMap) rootMap = await createLayer(null, LOCATIONS_MAP_NAME)
  await placeNodes(locations, rootMap.id)

  return { added, updated, skipped, addedNames, updatedNames }
}
