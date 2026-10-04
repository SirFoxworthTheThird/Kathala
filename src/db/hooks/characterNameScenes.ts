import { db } from '@/db/database'
import { journalUpdate } from './useOperations'
import { sortKeysByEvent } from '@/lib/spoilers'
import { moveNameScenes, sceneAfterRemoval, type Named } from '@/lib/characterNames'
import type { Character } from '@/types'

/**
 * Keep a character's name changes on the book when the scenes they are at go.
 *
 * A change points at a scene: "from here, called Aragorn". Clearing the
 * pointer would mean *from the start*, which is the reveal given away; dropping
 * the change would lose the reveal. So a removed scene's changes, and its
 * aliases' *known from*, move to the next scene in reading order that is not
 * also being removed — else the one before, else nowhere (`sceneAfterRemoval`).
 *
 * Called before the scenes are removed, inside the same journal group, so one
 * undo puts the scenes and the changes back where they were.
 */
export async function relocateNameScenes(worldId: string, removing: readonly string[]): Promise<void> {
  if (removing.length === 0) return
  const gone = new Set(removing)
  const characters = await db.characters.where('worldId').equals(worldId).toArray()
  const affected = characters.filter((c) =>
    c.nameChanges?.some((n) => gone.has(n.eventId)) || c.aliasesFrom?.some((a) => gone.has(a.eventId)))
  if (affected.length === 0) return
  const [events, chapters] = await Promise.all([
    db.events.where('worldId').equals(worldId).toArray(),
    db.chapters.where('worldId').equals(worldId).toArray(),
  ])
  const keys = sortKeysByEvent(events, new Map(chapters.map((c) => [c.id, c.number])))
  /*
    Latest first. Two changes moving onto one scene keep the one a reader
    reaches last — the reveal, not what it replaced — because a change landing
    where one already is gives way (`moveNameScenes`).
  */
  const latestFirst = [...removing].sort((a, b) => (keys.get(b) ?? -Infinity) - (keys.get(a) ?? -Infinity))
  for (const c of affected) {
    let named: Named = c
    for (const id of latestFirst) {
      const patch = moveNameScenes(named, id, sceneAfterRemoval(id, gone, keys))
      if (patch) named = { ...named, ...patch }
    }
    await write(c, named)
  }
}

/**
 * A join: the scene that goes is folded into the one that stays, and what was
 * recorded at it goes with it — as `joinWithNext` does for every other record
 * that points at a scene.
 */
export async function repointNameScenes(worldId: string, from: string, to: string): Promise<void> {
  const characters = await db.characters.where('worldId').equals(worldId).toArray()
  for (const c of characters) {
    const patch = moveNameScenes(c, from, to)
    if (patch) await write(c, { ...c, ...patch })
  }
}

async function write(c: Character, named: Named) {
  await journalUpdate('character', db.characters, c.id, {
    nameChanges: named.nameChanges ?? [],
    aliasesFrom: named.aliasesFrom ?? [],
    updatedAt: Date.now(),
  })
}
