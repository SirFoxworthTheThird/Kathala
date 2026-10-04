import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useGate } from './ReadingGateContext'
import type { Character } from '@/types'
import { generateId } from '@/lib/id'
import { journalGroup, withJournal } from './useOperations'

export function useCharacters(worldId: string | null) {
  // Gated here rather than in each view: a roster, a graph, an arc grid and a
  // map all read this, and a screen added later would otherwise leak by
  // default. The default has to be safe.
  const gate = useGate()
  const all = useLiveQuery(
    () => (worldId ? db.characters.where('worldId').equals(worldId).sortBy('name') : []),
    [worldId],
    []
  )
  /*
    And named as the reader knows them at their place (`gate.names`) — then in
    that order, since a reader at Bree looks for Strider under S.
  */
  return useMemo(() => {
    const shown = gate.names(gate.filter(all))
    return gate.active ? shown.sort((a, b) => a.name.localeCompare(b.name)) : shown
  }, [gate, all])
}

/**
 * One character, by id. Not filtered — a page reached by its address has
 * already been decided on — but named as the reader knows them, the same as
 * the roster: the character page read this ungated, and so told a reader who
 * had just met Strider that he was Aragorn.
 */
export function useCharacter(id: string | null) {
  const gate = useGate()
  const character = useLiveQuery(() => (id ? db.characters.get(id) : undefined), [id])
  return useMemo(() => (character ? gate.names([character])[0] : character), [gate, character])
}

/** Records predating v52 — and older `.pwk` imports — carry no version. */
const versionOf = (c: Pick<Character, 'version'> | undefined) => c?.version ?? 1

export async function createCharacter(data: Pick<Character, 'worldId' | 'name' | 'description'>): Promise<Character> {
  const now = Date.now()
  const character: Character = {
    id: generateId(),
    worldId: data.worldId,
    name: data.name,
    aliases: [],
    description: data.description,
    portraitImageId: null,
    tags: [],
    isAlive: true,
    color: null,
    birthDate: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  }
  return withJournal([db.characters], {
    worldId: character.worldId,
    entityType: 'character',
    entityId: character.id,
    type: 'create',
    payload: character as unknown as Record<string, unknown>,
    apply: async () => {
      await db.characters.add(character)
      return character
    },
  })
}

export async function updateCharacter(id: string, data: Partial<Omit<Character, 'id' | 'createdAt'>>) {
  const existing = await db.characters.get(id)
  if (!existing) return
  const base = versionOf(existing)
  const patch = { ...data, updatedAt: Date.now(), version: base + 1 }
  await withJournal([db.characters], {
    worldId: existing.worldId,
    entityType: 'character',
    entityId: id,
    type: 'update',
    baseVersion: base,
    payload: patch as unknown as Record<string, unknown>,
    apply: () => db.characters.update(id, patch),
  })
}

export async function deleteCharacter(id: string) {
  const existing = await db.characters.get(id)
  if (!existing) return
  /*
    Anyone revealed to be them is let go first — a link to nobody would hold
    them in a group that no longer has a head. Journalled, in one group with the
    delete, so one undo brings back the character and the links together.
  */
  await journalGroup(async () => {
    for (const c of await db.characters.where('worldId').equals(existing.worldId).toArray()) {
      if (c.revealedAs?.characterId === id) await updateCharacter(c.id, { revealedAs: undefined })
    }
    await withJournal(
      [
        db.characters, db.characterSnapshots, db.characterMovements,
        db.relationships, db.relationshipSnapshots, db.factionMemberships,
        db.characterGoals,
      ],
      {
        worldId: existing.worldId,
        entityType: 'character',
        entityId: id,
        type: 'delete',
        baseVersion: versionOf(existing),
        // The whole record, so the operation can be inverted back into a create.
        payload: existing as unknown as Record<string, unknown>,
        apply: async () => {
          await db.characters.delete(id)
          await db.characterSnapshots.where('characterId').equals(id).delete()
          await db.characterMovements.where('characterId').equals(id).delete()
          await db.factionMemberships.where('characterId').equals(id).delete()
          await db.characterGoals.where('characterId').equals(id).delete()
          // Collect relationship ids involving this character, then delete snapshots too
          const relIds = (await db.relationships
            .filter((r) => r.characterAId === id || r.characterBId === id)
            .toArray()
          ).map((r) => r.id)
          await db.relationships.bulkDelete(relIds)
          for (const relId of relIds) {
            await db.relationshipSnapshots.where('relationshipId').equals(relId).delete()
          }
        },
      },
    )
  })
}
