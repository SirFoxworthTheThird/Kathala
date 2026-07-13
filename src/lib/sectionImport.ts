import { db } from '@/db/database'
import { generateId } from '@/lib/id'
import type { Character, Item } from '@/types'
import type { SpecCharacter, SpecItem } from '@/lib/worldSpec'

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
