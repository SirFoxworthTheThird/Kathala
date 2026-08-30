import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createCharacter, deleteCharacter } from '@/db/hooks/useCharacters'
import { createTimeline, createChapter, createEvent, updateEvent } from '@/db/hooks/useTimeline'
import { createKnowledgeFact, createKnowledgeReveal } from '@/db/hooks/useKnowledge'
import { upsertSnapshot } from '@/db/hooks/useSnapshots'
import { operationsForEntity, resolveSubjects } from '@/db/hooks/useOperations'
import { describeOperation } from '@/lib/operations'

/**
 * N6, from a blind writer run: after accepting seventeen continuity fixes, the
 * Recent changes panel showed seventeen consecutive rows reading exactly
 * *"Edited scene — involved characters"*, with no scene name on any of them.
 * The reviewer then pressed Ctrl+Z five times and took back a structural move
 * made twenty minutes earlier on a different screen, because the panel gave no
 * way to see it coming.
 *
 * The wording is unit-tested in `src/lib/__tests__/operationSubject.test.ts`.
 * These are about the join: that the name really is recoverable from the store
 * for the operations that cannot name themselves.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function seedScene(title: string) {
  const world = await createWorld({ name: 'Journal World', description: '' })
  const tl = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#fff' })
  const ch = await createChapter({ worldId: world.id, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
  const ev = await createEvent({
    worldId: world.id, chapterId: ch.id, timelineId: tl.id, title, description: '',
    locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
  })
  return { world, ev }
}

async function updateOp(entityType: 'event' | 'characterSnapshot', entityId: string) {
  const ops = await operationsForEntity(entityType, entityId)
  const update = ops.find((o) => o.type === 'update')
  expect(update).toBeDefined()
  return update!
}

describe('resolveSubjects', () => {
  it('names the scene a cast edit landed on, which its payload cannot', async () => {
    const { world, ev } = await seedScene('The ninth bell does not ring')
    const char = await createCharacter({ worldId: world.id, name: 'Corvin Adze', description: '' })
    await updateEvent(ev.id, { involvedCharacterIds: [char.id] })

    const op = await updateOp('event', ev.id)
    // The finding itself: the operation carries the changed field and nothing
    // that identifies the scene.
    expect(op.changedFields).toEqual(['involvedCharacterIds'])
    expect(op.payload.title).toBeUndefined()
    expect(describeOperation(op)).toBe('Edited scene — involved characters')

    const subjects = await resolveSubjects([op])
    expect(describeOperation(op, subjects.get(op.id)))
      .toBe('Edited scene “The ninth bell does not ring” — involved characters')
  })

  it('tells two edits of the same kind apart, which is the whole point', async () => {
    const { world, ev } = await seedScene('The ninth bell does not ring')
    const second = await createEvent({
      worldId: world.id, chapterId: ev.chapterId, timelineId: ev.timelineId,
      title: 'The clapper changes hands', description: '',
      locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 1,
    })
    const char = await createCharacter({ worldId: world.id, name: 'Corvin Adze', description: '' })
    await updateEvent(ev.id, { involvedCharacterIds: [char.id] })
    await updateEvent(second.id, { involvedCharacterIds: [char.id] })

    const ops = [await updateOp('event', ev.id), await updateOp('event', second.id)]
    const subjects = await resolveSubjects(ops)
    const lines = ops.map((o) => describeOperation(o, subjects.get(o.id)))
    expect(new Set(lines).size).toBe(2)
    expect(lines).toContain('Edited scene “The ninth bell does not ring” — involved characters')
    expect(lines).toContain('Edited scene “The clapper changes hands” — involved characters')
  })

  it('names the character a state edit is about, not the state record', async () => {
    const { world, ev } = await seedScene('The ninth bell does not ring')
    const char = await createCharacter({ worldId: world.id, name: 'Corvin Adze', description: '' })
    const base = {
      worldId: world.id, characterId: char.id,
      currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', travelModeId: null,
    }
    // `eventId` named at each call, per `snapshotWriteScenes.test.ts`: the rule
    // is uniform so the dangerous case cannot hide among the safe ones.
    const snap = await upsertSnapshot({ ...base, eventId: ev.id, isAlive: true, statusNotes: 'whole' })
    await upsertSnapshot({ ...base, eventId: ev.id, isAlive: true, statusNotes: 'wounded' })

    // A snapshot has no name of its own — neither the create nor the update
    // could name it without the second hop.
    const ops = await operationsForEntity('characterSnapshot', snap.id)
    expect(ops.map((o) => o.type)).toEqual(['create', 'update'])
    const subjects = await resolveSubjects(ops)
    const lines = ops.map((o) => describeOperation(o, subjects.get(o.id)))
    expect(lines[0]).toBe('Added character state “Corvin Adze”')
    // The field list is asserted only as a prefix: `upsertSnapshot` hands the
    // whole state to every write, so an edit to one field is journalled as an
    // edit to all of them. That is a separate untidiness in the payload, not
    // in the naming, and pinning the whole string here would make this test
    // fail the next time a field joins the snapshot.
    expect(lines[1]).toMatch(/^Edited character state “Corvin Adze” — /)
  })

  it('falls back to the bare label when the record it named is gone', async () => {
    const { world, ev } = await seedScene('The ninth bell does not ring')
    const char = await createCharacter({ worldId: world.id, name: 'Corvin Adze', description: '' })
    const snap = await upsertSnapshot({
      worldId: world.id, characterId: char.id, eventId: ev.id, isAlive: true,
      currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: 'whole', travelModeId: null,
    })
    const op = (await operationsForEntity('characterSnapshot', snap.id))[0]

    // Present first, so the absence below is about the deletion and not about
    // the lookup never having worked.
    expect((await resolveSubjects([op])).get(op.id)).toBe('Corvin Adze')

    await deleteCharacter(char.id)
    const subjects = await resolveSubjects([op])
    expect(subjects.has(op.id)).toBe(false)
    expect(describeOperation(op, subjects.get(op.id))).toBe('Added character state')
  })

  it('does not read the store for an operation that already names itself', async () => {
    const { world } = await seedScene('The ninth bell does not ring')
    const char = await createCharacter({ worldId: world.id, name: 'Corvin Adze', description: '' })
    const created = (await operationsForEntity('character', char.id))[0]

    // A create carries the whole record, so it is skipped entirely — the map
    // holds nothing for it, and the payload does the naming.
    const subjects = await resolveSubjects([created])
    expect(subjects.size).toBe(0)
    expect(describeOperation(created, subjects.get(created.id))).toBe('Added character “Corvin Adze”')
  })

  /*
    The same finding, a run later: twelve reveals recorded in one sitting gave
    twelve rows reading "Added knowledge reveal", with nothing to choose
    between them — and this is the panel you use to decide what to take back.
    A reveal is a character and a fact and nothing else, so both are named.
  */
  it('names both ends of a knowledge reveal, which is only foreign keys', async () => {
    const { world, ev } = await seedScene('The lining of the coat')
    const perrin = await createCharacter({ worldId: world.id, name: 'Perrin Vaux', description: '' })
    const isquel = await createCharacter({ worldId: world.id, name: 'Isquel Vaux', description: '' })
    const fact = await createKnowledgeFact({
      worldId: world.id, title: 'Cathe Vaux thinned the tin', description: '', tags: [],
    })

    const a = await createKnowledgeReveal({ worldId: world.id, factId: fact.id, characterId: perrin.id, eventId: ev.id, note: '' })
    const b = await createKnowledgeReveal({ worldId: world.id, factId: fact.id, characterId: isquel.id, eventId: ev.id, note: '' })
    const ops = [
      (await operationsForEntity('knowledgeReveal', a.id))[0],
      (await operationsForEntity('knowledgeReveal', b.id))[0],
    ]

    const subjects = await resolveSubjects(ops)
    const rows = ops.map((op) => describeOperation(op, subjects.get(op.id)))
    expect(rows).toEqual([
      'Added knowledge reveal “Perrin Vaux — Cathe Vaux thinned the tin”',
      'Added knowledge reveal “Isquel Vaux — Cathe Vaux thinned the tin”',
    ])
    // The point of the fix, stated as itself: two rows about two records read
    // differently.
    expect(rows[0]).not.toBe(rows[1])
  })

  it('follows a rename, because the row is a way to find the record', async () => {
    const { world, ev } = await seedScene('Working title')
    const char = await createCharacter({ worldId: world.id, name: 'Corvin Adze', description: '' })
    await updateEvent(ev.id, { involvedCharacterIds: [char.id] })
    const op = await updateOp('event', ev.id)

    await updateEvent(ev.id, { title: 'The ninth bell does not ring' })
    const subjects = await resolveSubjects([op])
    expect(subjects.get(op.id)).toBe('The ninth bell does not ring')
  })
})
