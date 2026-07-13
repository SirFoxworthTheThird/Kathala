import { db } from '@/db/database'
import { generateId } from '@/lib/id'
import type {
  Character, Item, Faction, FactionMembership, Relationship,
  RelationshipStrength, RelationshipSentiment, LoreCategory, LorePage,
  KnowledgeFact, KnowledgeReveal, MapLayer, LocationMarker, LocationIconType, BlobEntry,
} from '@/types'
import type {
  SpecCharacter, SpecItem, SpecFaction, SpecRelationship, SpecLore, SpecKnowledge, SpecReveal,
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

/** Parse and lightly validate a relationships-only spec. */
export function parseRelationshipsSpec(text: string): { relationships?: SpecRelationship[]; error?: string } {
  const { list, error } = extractArray(text, 'relationships')
  if (error) return { error }
  const relationships: SpecRelationship[] = []
  for (const raw of list!) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    if (typeof r.a !== 'string' || !r.a.trim() || typeof r.b !== 'string' || !r.b.trim()) continue
    relationships.push({
      a: r.a,
      b: r.b,
      label: typeof r.label === 'string' ? r.label : undefined,
      strength: STRENGTHS.includes(r.strength as RelationshipStrength) ? r.strength as RelationshipStrength : undefined,
      sentiment: SENTIMENTS.includes(r.sentiment as RelationshipSentiment) ? r.sentiment as RelationshipSentiment : undefined,
      description: typeof r.description === 'string' ? r.description : undefined,
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

/**
 * Add or update relationships in a world. Endpoints match existing characters by
 * name/alias; an entry is skipped when either endpoint is unknown or both are the
 * same character. An existing pair (either order) is updated in place; a new pair
 * is created.
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

  const existing = await db.relationships.where('worldId').equals(worldId).toArray()
  const byPair = new Map(existing.map((r) => [pairKey(r.characterAId, r.characterBId), r]))

  const now = Date.now()
  const toAdd: Relationship[] = []
  const updates: { id: string; patch: Partial<Relationship> }[] = []
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
      if (Object.keys(patch).length) { updates.push({ id: match.id, patch }); updatedNames.push(label) }
      else skipped++
      continue
    }
    addedNames.push(label)
    toAdd.push({
      id: generateId(), worldId, characterAId: aId, characterBId: bId,
      label: sr.label?.trim() || 'connected',
      strength: sr.strength ?? 'moderate',
      sentiment: sr.sentiment ?? 'neutral',
      description: sr.description?.trim() ?? '',
      isBidirectional: true,
      startEventId: null,
      createdAt: now, updatedAt: now,
    })
  }

  if (toAdd.length > 0) await db.relationships.bulkAdd(toAdd)
  for (const u of updates) await db.relationships.update(u.id, { ...u.patch, updatedAt: now })
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
export interface SpecLocation {
  name: string
  description?: string
  /** city | town | dungeon | landmark | building | region | custom */
  type?: string
  children?: SpecLocation[]
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
    })
  }
  return out
}

/** Parse and lightly validate a locations tree. */
export function parseLocationsSpec(text: string): { locations?: SpecLocation[]; error?: string } {
  const { list, error } = extractArray(text, 'locations')
  if (error) return { error }
  const locations = parseLocationNodes(list!)
  if (locations.length === 0) return { error: 'No locations with a "name" were found in that JSON.' }
  return { locations }
}

/** Total number of nodes in a location tree (all levels). */
export function countLocations(nodes: SpecLocation[]): number {
  let n = 0
  for (const node of nodes) n += 1 + (node.children ? countLocations(node.children) : 0)
  return n
}

function iconTypeFor(node: SpecLocation): LocationIconType {
  const t = node.type?.trim().toLowerCase()
  if (t && LOCATION_ICON_TYPES.includes(t as LocationIconType)) return t as LocationIconType
  return node.children && node.children.length > 0 ? 'region' : 'landmark'
}

/** Evenly spread `n` markers across a `w`×`h` map, with margins. */
function gridPositions(n: number, w: number, h: number): { x: number; y: number }[] {
  if (n <= 0) return []
  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  const mx = w * 0.12, my = h * 0.12
  const cw = cols > 1 ? (w - 2 * mx) / (cols - 1) : 0
  const ch = rows > 1 ? (h - 2 * my) / (rows - 1) : 0
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols
    out.push({
      x: Math.round(cols > 1 ? mx + c * cw : w / 2),
      y: Math.round(rows > 1 ? my + r * ch : h / 2),
    })
  }
  return out
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
 * gets a linked sub-map holding them, recursively. Markers are matched by name
 * within their map: new ones are created, existing ones updated in place, and a
 * parent that gains children grows its sub-map — so re-running extends the tree
 * without duplicating. `makeImage` is injectable for testing.
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
  async function imageId(): Promise<string> {
    if (sharedImageId) return sharedImageId
    const { blob, width, height } = await makeImage()
    const entry: BlobEntry = { id: generateId(), worldId, mimeType: blob.type || 'image/png', data: blob, createdAt: now }
    await db.blobs.add(entry)
    sharedImageId = entry.id
    // Stash dims for callers that create layers.
    imageDims = { width, height }
    return entry.id
  }
  let imageDims: { width: number; height: number } = { width: PLACEHOLDER_W, height: PLACEHOLDER_H }

  async function createLayer(parentMapId: string | null, name: string): Promise<MapLayer> {
    const id = await imageId()
    const layer: MapLayer = {
      id: generateId(), worldId, parentMapId, name,
      description: '', imageId: id,
      imageWidth: imageDims.width, imageHeight: imageDims.height,
      scalePixelsPerUnit: null, scaleUnit: null,
      createdAt: now, updatedAt: now,
    }
    await db.mapLayers.add(layer)
    return layer
  }

  // Reuse an existing root "Locations" map if one is already there.
  const rootLayers = await db.mapLayers.where('worldId').equals(worldId).toArray()
  let rootMap = rootLayers.find((l) => l.parentMapId === null && key(l.name) === key(LOCATIONS_MAP_NAME)) ?? null

  async function placeNodes(nodes: SpecLocation[], mapLayerId: string, mapW: number, mapH: number): Promise<void> {
    const existing = await db.locationMarkers.where('mapLayerId').equals(mapLayerId).toArray()
    const byName = new Map(existing.map((m) => [key(m.name), m]))
    const newNodes = nodes.filter((n) => n.name.trim() && !byName.has(key(n.name.trim())))
    const positions = gridPositions(existing.length + newNodes.length, mapW, mapH).slice(existing.length)
    let posIx = 0
    const seen = new Set<string>()

    for (const node of nodes) {
      const name = node.name.trim()
      if (!name || seen.has(key(name))) { skipped++; continue }
      seen.add(key(name))
      const match = byName.get(key(name))

      if (match) {
        const patch: Partial<LocationMarker> = {}
        const desc = node.description?.trim()
        if (desc) patch.description = desc
        patch.iconType = iconTypeFor(node)
        const pruned = changedFields(match, patch)

        // A parent that gained children needs (or reuses) a sub-map.
        let subMapId = match.linkedMapLayerId
        let linkedNow = false
        if (node.children && node.children.length > 0 && !subMapId) {
          const sub = await createLayer(mapLayerId, name)
          subMapId = sub.id
          linkedNow = true
        }
        if (linkedNow) pruned.linkedMapLayerId = subMapId

        const changed = Object.keys(pruned).length > 0
        if (changed) { await db.locationMarkers.update(match.id, { ...pruned, updatedAt: now }); updated++; updatedNames.push(name) }
        else skipped++
        if (node.children && node.children.length > 0 && subMapId) {
          await placeNodes(node.children, subMapId, imageDims.width, imageDims.height)
        }
        continue
      }

      // New marker.
      const pos = positions[posIx++] ?? { x: Math.round(mapW / 2), y: Math.round(mapH / 2) }
      let subMapId: string | null = null
      if (node.children && node.children.length > 0) {
        const sub = await createLayer(mapLayerId, name)
        subMapId = sub.id
      }
      const marker: LocationMarker = {
        id: generateId(), worldId, mapLayerId,
        linkedMapLayerId: subMapId,
        name,
        description: node.description?.trim() ?? '',
        x: pos.x, y: pos.y,
        iconType: iconTypeFor(node),
        tags: [], factionId: null,
        createdAt: now, updatedAt: now,
      }
      await db.locationMarkers.add(marker)
      added++; addedNames.push(name)
      if (node.children && node.children.length > 0 && subMapId) {
        await placeNodes(node.children, subMapId, imageDims.width, imageDims.height)
      }
    }
  }

  if (!rootMap) rootMap = await createLayer(null, LOCATIONS_MAP_NAME)
  await placeNodes(locations, rootMap.id, rootMap.imageWidth, rootMap.imageHeight)

  return { added, updated, skipped, addedNames, updatedNames }
}
