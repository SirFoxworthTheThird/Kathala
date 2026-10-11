import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { recordIdentityChanges } from '@/db/hooks/useCharacters'

/**
 * The Characters line's `:called …` and `:is …`, written to the characters:
 * a name change at the scene, a reveal at the scene, and each taken back.
 */

const now = Date.now()
const none = { rename: [], unrename: [], reveal: [], unreveal: [] }

beforeEach(async () => {
  await db.delete()
  await db.open()
  const person = (id: string, name: string, extra: object = {}) => db.characters.add({
    id, worldId: 'w', name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now, ...extra,
  })
  // Aragorn is called Strider from the first scene; Hyde is revealed as Jekyll at a later one.
  await person('ara', 'Aragorn', { nameChanges: [{ eventId: 'e1', name: 'Strider' }] })
  await person('hyde', 'Edward Hyde', { revealedAs: { characterId: 'jek', eventId: 'e9' } })
  await person('jek', 'Dr Henry Jekyll')
})
afterAll(async () => { await db.delete() })

const get = (id: string) => db.characters.get(id)

describe('names and reveals on the Characters line, written', () => {
  it(':called Aragorn at a scene adds the change there and keeps the others; taken back, only that one goes', async () => {
    await recordIdentityChanges('e5', { ...none, rename: [{ characterId: 'ara', name: 'Aragorn' }] })
    expect((await get('ara'))?.nameChanges).toEqual([{ eventId: 'e1', name: 'Strider' }, { eventId: 'e5', name: 'Aragorn' }])
    // Another name at the same scene replaces it rather than adding a second.
    await recordIdentityChanges('e5', { ...none, rename: [{ characterId: 'ara', name: 'Elessar' }] })
    expect((await get('ara'))?.nameChanges).toEqual([{ eventId: 'e1', name: 'Strider' }, { eventId: 'e5', name: 'Elessar' }])
    await recordIdentityChanges('e5', { ...none, unrename: ['ara'] })
    expect((await get('ara'))?.nameChanges).toEqual([{ eventId: 'e1', name: 'Strider' }])
  })

  it(':is at a scene sets the reveal there; taken back there, it goes — but not a reveal recorded at another scene', async () => {
    await recordIdentityChanges('e5', { ...none, unreveal: ['hyde'] })
    expect((await get('hyde'))?.revealedAs).toEqual({ characterId: 'jek', eventId: 'e9' })
    await recordIdentityChanges('e5', { ...none, reveal: [{ characterId: 'hyde', asId: 'jek' }] })
    expect((await get('hyde'))?.revealedAs).toEqual({ characterId: 'jek', eventId: 'e5' })
    await recordIdentityChanges('e5', { ...none, unreveal: ['hyde'] })
    expect((await get('hyde'))?.revealedAs).toBeUndefined()
  })
})
