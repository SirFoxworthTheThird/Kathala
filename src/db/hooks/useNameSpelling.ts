import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { nameWords, worldNames } from '@/lib/nameSpelling'
import { spellingBridge } from '@/lib/desktopSpelling'
import { db, bibleOf } from '@/db/database'
import type { NameSource } from '@/lib/nameSpelling'

/*
  The world's names, for spelling (issue #705): what the desktop app's
  dictionary is told (D-1) and what near misses are measured against (D-3).
  Read whole from the store, so a name added, changed or deleted is followed
  as it happens. A series' books share their cast, places, items and factions.
*/

/** Every name the world's records give: its people with their other names, places, items and factions. */
export async function worldNameSource(worldId: string): Promise<NameSource> {
  const [characters, places, items, factions] = await Promise.all([
    db.characters.where('worldId').equals(bibleOf(worldId)).toArray(),
    db.locationMarkers.where('worldId').equals(bibleOf(worldId)).toArray(),
    db.items.where('worldId').equals(bibleOf(worldId)).toArray(),
    db.factions.where('worldId').equals(bibleOf(worldId)).toArray(),
  ])
  return {
    characters: characters.map((c) => ({ name: c.name, aliases: c.aliases ?? [], nameChanges: c.nameChanges ?? [] })),
    places: places.map((p) => ({ name: p.name })),
    items: items.map((i) => ({ name: i.name })),
    factions: factions.map((f) => ({ name: f.name })),
  }
}

/** `worldNameSource`, live. Null until read, or with no world. */
export function useNameSource(worldId: string | null | undefined): NameSource | null {
  return useLiveQuery(async () => (worldId ? worldNameSource(worldId) : null), [worldId], null)
}

/**
 * Say a word is not a misspelt name, or take that back (D-4). Kept on the
 * world, so it travels with the book; read and written in one transaction.
 */
export async function setSpellingAccepted(worldId: string, word: string, accepted: boolean): Promise<void> {
  const key = word.toLowerCase()
  await db.transaction('rw', db.worlds, async () => {
    const world = await db.worlds.get(worldId)
    if (!world) return
    const now = new Set(world.spellingAccepted ?? [])
    if (accepted) now.add(key)
    else now.delete(key)
    await db.worlds.update(worldId, { spellingAccepted: [...now].sort(), updatedAt: Date.now() })
  })
}

/**
 * In the desktop app, the open world's name words given to the spell checker's
 * dictionary (D-1): when the world opens, and again as names are added or
 * changed, so a new name stops being underlined at once. Nothing is taken out
 * — the dictionary is the device's, and a writer's own *Add to dictionary* is
 * in it too. Nothing at all in a browser.
 */
export function useDictionaryNames(worldId: string | null | undefined): void {
  const source = useNameSource(spellingBridge() ? worldId : null)
  useEffect(() => {
    const bridge = spellingBridge()
    if (!bridge || !source) return
    const words = nameWords(worldNames(source))
    if (words.length) void bridge.addWords(words).catch(() => { /* the app is closing, or the dictionary refused: the underline stays */ })
  }, [source])
}
