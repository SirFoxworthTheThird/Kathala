import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { Character } from '@/types'
import { generateId } from '@/lib/id'

export function useCharacters(worldId: string | null) {
  return useLiveQuery(
    () => (worldId ? db.characters.where('worldId').equals(worldId).sortBy('name') : []),
    [worldId],
    []
  )
}

export function useCharacter(id: string | null) {
  return useLiveQuery(() => (id ? db.characters.get(id) : undefined), [id])
}

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
    createdAt: now,
    updatedAt: now,
  }
  await db.characters.add(character)
  return character
}

export async function updateCharacter(id: string, data: Partial<Omit<Character, 'id' | 'createdAt'>>) {
  await db.characters.update(id, { ...data, updatedAt: Date.now() })
}

export async function deleteCharacter(id: string) {
  await db.transaction('rw', [
    db.characters, db.characterSnapshots, db.characterMovements,
    db.relationships, db.relationshipSnapshots, db.factionMemberships,
  ], async () => {
    await db.characters.delete(id)
    await db.characterSnapshots.where('characterId').equals(id).delete()
    await db.characterMovements.where('characterId').equals(id).delete()
    await db.factionMemberships.where('characterId').equals(id).delete()
    // Collect relationship ids involving this character, then delete snapshots too
    const relIds = (await db.relationships
      .filter((r) => r.characterAId === id || r.characterBId === id)
      .toArray()
    ).map((r) => r.id)
    await db.relationships.bulkDelete(relIds)
    for (const relId of relIds) {
      await db.relationshipSnapshots.where('relationshipId').equals(relId).delete()
    }
  })
}
