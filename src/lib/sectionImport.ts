import { db } from '@/db/database'
import { generateId } from '@/lib/id'
import type {
  Character, Item, Faction, FactionMembership, Relationship,
  RelationshipStrength, RelationshipSentiment, LoreCategory, LorePage,
} from '@/types'
import type { SpecCharacter, SpecItem, SpecFaction, SpecRelationship, SpecLore } from '@/lib/worldSpec'

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
 * `add*ToWorld` (idempotent merge that skips names already present). Entities are
 * referenced by name — no ids — matching the compact spec used for full worlds.
 */

const key = (s: string) => s.trim().toLowerCase()

export interface SectionMergeResult {
  added: number
  skipped: number
  /** Names that were added, in order. */
  addedNames: string[]
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

/**
 * Add characters to a world, skipping any whose name already exists there
 * (case-insensitive) or repeats within the batch. Returns how many were added.
 */
export async function addCharactersToWorld(
  worldId: string,
  characters: SpecCharacter[],
): Promise<SectionMergeResult> {
  const existing = await db.characters.where('worldId').equals(worldId).toArray()
  const seen = new Set(existing.map((c) => key(c.name)))
  const now = Date.now()
  const toAdd: Character[] = []
  const addedNames: string[] = []
  let skipped = 0

  for (const sc of characters) {
    const name = sc.name?.trim()
    if (!name) { skipped++; continue }
    if (seen.has(key(name))) { skipped++; continue }
    seen.add(key(name))
    addedNames.push(name)
    toAdd.push({
      id: generateId(),
      worldId,
      name,
      aliases: (sc.aliases ?? []).map((a) => a.trim()).filter(Boolean),
      description: sc.description?.trim() ?? '',
      portraitImageId: null,
      tags: (sc.tags ?? []).filter(Boolean),
      isAlive: sc.alive ?? true,
      color: sc.color ?? null,
      createdAt: now,
      updatedAt: now,
    })
  }

  if (toAdd.length > 0) await db.characters.bulkAdd(toAdd)
  return { added: toAdd.length, skipped, addedNames }
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

/**
 * Add items to a world, skipping any whose name already exists there
 * (case-insensitive) or repeats within the batch.
 */
export async function addItemsToWorld(
  worldId: string,
  items: SpecItem[],
): Promise<SectionMergeResult> {
  const existing = await db.items.where('worldId').equals(worldId).toArray()
  const seen = new Set(existing.map((i) => key(i.name)))
  const toAdd: Item[] = []
  const addedNames: string[] = []
  let skipped = 0

  for (const si of items) {
    const name = si.name?.trim()
    if (!name) { skipped++; continue }
    if (seen.has(key(name))) { skipped++; continue }
    seen.add(key(name))
    addedNames.push(name)
    toAdd.push({
      id: generateId(),
      worldId,
      name,
      description: si.description?.trim() ?? '',
      iconType: si.icon?.trim() || 'other',
      imageId: null,
      tags: (si.tags ?? []).filter(Boolean),
    })
  }

  if (toAdd.length > 0) await db.items.bulkAdd(toAdd)
  return { added: toAdd.length, skipped, addedNames }
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

/**
 * Add factions to a world, skipping names already present (case-insensitive) or
 * repeated within the batch. Members are matched to existing characters by name
 * or alias; unknown names are ignored (no characters are created here).
 */
export async function addFactionsToWorld(
  worldId: string,
  factions: SpecFaction[],
): Promise<SectionMergeResult> {
  const existingFactions = await db.factions.where('worldId').equals(worldId).toArray()
  const seen = new Set(existingFactions.map((f) => key(f.name)))

  // name/alias → character id, for resolving members.
  const chars = await db.characters.where('worldId').equals(worldId).toArray()
  const charIdByName = new Map<string, string>()
  for (const c of chars) {
    charIdByName.set(key(c.name), c.id)
    for (const a of c.aliases ?? []) if (a?.trim()) charIdByName.set(key(a), c.id)
  }

  const now = Date.now()
  const factionsToAdd: Faction[] = []
  const membershipsToAdd: FactionMembership[] = []
  const addedNames: string[] = []
  let skipped = 0
  let colorIx = existingFactions.length

  for (const sf of factions) {
    const name = sf.name?.trim()
    if (!name) { skipped++; continue }
    if (seen.has(key(name))) { skipped++; continue }
    seen.add(key(name))
    addedNames.push(name)
    const factionId = generateId()
    factionsToAdd.push({
      id: factionId,
      worldId,
      name,
      description: sf.description?.trim() ?? '',
      color: sf.color?.trim() || FACTION_COLORS[colorIx++ % FACTION_COLORS.length],
      coverImageId: null,
      tags: (sf.tags ?? []).filter(Boolean),
      createdAt: now,
      updatedAt: now,
    })
    const usedChars = new Set<string>()
    for (const m of sf.members ?? []) {
      const memberName = typeof m === 'string' ? m : m?.name
      const role = typeof m === 'string' ? null : (m?.role?.trim() || null)
      const charId = memberName ? charIdByName.get(key(memberName)) : undefined
      if (!charId || usedChars.has(charId)) continue
      usedChars.add(charId)
      membershipsToAdd.push({
        id: generateId(), worldId, factionId, characterId: charId,
        role, startEventId: null, endEventId: null, notes: '',
        createdAt: now, updatedAt: now,
      })
    }
  }

  if (factionsToAdd.length > 0) await db.factions.bulkAdd(factionsToAdd)
  if (membershipsToAdd.length > 0) await db.factionMemberships.bulkAdd(membershipsToAdd)
  return { added: factionsToAdd.length, skipped, addedNames }
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

/**
 * Add relationships to a world. Endpoints are matched to existing characters by
 * name or alias; a relationship is skipped when either endpoint is unknown, both
 * endpoints are the same character, or that pair already has a relationship
 * (in the world or earlier in this batch).
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
  const seenPairs = new Set(existing.map((r) => pairKey(r.characterAId, r.characterBId)))

  const now = Date.now()
  const toAdd: Relationship[] = []
  const addedNames: string[] = []
  let skipped = 0

  for (const sr of relationships) {
    const aId = sr.a ? charIdByName.get(key(sr.a)) : undefined
    const bId = sr.b ? charIdByName.get(key(sr.b)) : undefined
    if (!aId || !bId || aId === bId) { skipped++; continue }
    const pk = pairKey(aId, bId)
    if (seenPairs.has(pk)) { skipped++; continue }
    seenPairs.add(pk)
    addedNames.push(`${sr.a.trim()} ↔ ${sr.b.trim()}`)
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
  return { added: toAdd.length, skipped, addedNames }
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
 * Add lore pages to a world, skipping page titles already present
 * (case-insensitive) or repeated within the batch. Categories are matched to
 * existing ones by name and created on demand when new.
 */
export async function addLoreToWorld(
  worldId: string,
  lore: SpecLore[],
): Promise<SectionMergeResult> {
  const existingPages = await db.lorePages.where('worldId').equals(worldId).toArray()
  const seenTitles = new Set(existingPages.map((p) => key(p.title)))

  const existingCats = await db.loreCategories.where('worldId').equals(worldId).toArray()
  const categoryIdByName = new Map<string, string>()
  for (const c of existingCats) categoryIdByName.set(key(c.name), c.id)
  let categoryOrder = existingCats.length

  const now = Date.now()
  const categoriesToAdd: LoreCategory[] = []
  const pagesToAdd: LorePage[] = []
  const addedNames: string[] = []
  let skipped = 0

  for (const sl of lore) {
    const title = sl.title?.trim()
    if (!title) { skipped++; continue }
    if (seenTitles.has(key(title))) { skipped++; continue }
    seenTitles.add(key(title))
    addedNames.push(title)

    let categoryId: string | null = null
    if (sl.category?.trim()) {
      const ck = key(sl.category)
      categoryId = categoryIdByName.get(ck) ?? null
      if (!categoryId) {
        categoryId = generateId()
        categoryIdByName.set(ck, categoryId)
        categoriesToAdd.push({ id: categoryId, worldId, name: sl.category.trim(), color: null, sortOrder: categoryOrder++ })
      }
    }

    pagesToAdd.push({
      id: generateId(), worldId, categoryId,
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
  return { added: pagesToAdd.length, skipped, addedNames }
}
