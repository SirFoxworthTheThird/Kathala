import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createHeaderCharacter } from '@/db/hooks/useCharacters'

/** Somebody made from the header note: made once, and anybody already answering to the name — by any of their names — is that person. */

const now = Date.now()
beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.characters.add({ id: 'gull', worldId: 'w', name: 'Hester Gale', description: '', aliases: ['The Gull'], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
  await db.characters.add({ id: 'other', worldId: 'other', name: 'Lydia Marrick', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
})
afterAll(async () => { await db.delete() })

describe('somebody made from the header note', () => {
  it('is made once, in this world, and an alias is the person it belongs to', async () => {
    const lydia = await createHeaderCharacter('w', ' Lydia Marrick ')
    expect(lydia).not.toBe('other')
    expect(await db.characters.get(lydia)).toMatchObject({ worldId: 'w', name: 'Lydia Marrick', isAlive: true })
    expect(await createHeaderCharacter('w', 'lydia marrick')).toBe(lydia)
    expect(await createHeaderCharacter('w', 'the gull')).toBe('gull')
    expect(await db.characters.where('worldId').equals('w').count()).toBe(2)
  })
})
