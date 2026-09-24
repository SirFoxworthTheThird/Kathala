/**
 * Tests for upsertSnapshot deduplication logic.
 * The delta model skips writing a new snapshot when the state is identical to
 * the most recent prior snapshot for the same character.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { upsertSnapshot } from '@/db/hooks/useSnapshots'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function setup() {
  const tl = await createTimeline({ worldId: 'w', name: 'T', description: '', color: '#000' })
  const ch = await createChapter({ worldId: 'w', timelineId: tl.id, number: 1, title: 'Ch 1', synopsis: '' })
  const ev1 = await createEvent({
    worldId: 'w', timelineId: tl.id, chapterId: ch.id,
    title: 'Ev1', description: '', locationMarkerId: null,
    involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
  })
  const ev2 = await createEvent({
    worldId: 'w', timelineId: tl.id, chapterId: ch.id,
    title: 'Ev2', description: '', locationMarkerId: null,
    involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 1,
  })
  const ev3 = await createEvent({
    worldId: 'w', timelineId: tl.id, chapterId: ch.id,
    title: 'Ev3', description: '', locationMarkerId: null,
    involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 2,
  })
  return { ev1, ev2, ev3 }
}

const BASE = {
  worldId: 'w',
  characterId: 'char-1',
  isAlive: true,
  currentLocationMarkerId: null,
  currentMapLayerId: null,
  inventoryItemIds: [] as string[],
  inventoryNotes: '',
  statusNotes: '',
  travelModeId: null,
}

describe('upsertSnapshot — deduplication', () => {
  it('skips write when all fields equal the prior snapshot', async () => {
    const { ev1, ev2 } = await setup()

    await upsertSnapshot({ ...BASE, eventId: ev1.id })
    const result = await upsertSnapshot({ ...BASE, eventId: ev2.id })

    expect(await db.characterSnapshots.count()).toBe(1)
    expect(result.eventId).toBe(ev1.id)
  })

  it('writes new record when isAlive changes', async () => {
    const { ev1, ev2 } = await setup()

    await upsertSnapshot({ ...BASE, eventId: ev1.id, isAlive: true })
    await upsertSnapshot({ ...BASE, eventId: ev2.id, isAlive: false })

    expect(await db.characterSnapshots.count()).toBe(2)
  })

  it('writes new record when location changes', async () => {
    const { ev1, ev2 } = await setup()

    await upsertSnapshot({ ...BASE, eventId: ev1.id, currentLocationMarkerId: 'loc-A' })
    await upsertSnapshot({ ...BASE, eventId: ev2.id, currentLocationMarkerId: 'loc-B' })

    expect(await db.characterSnapshots.count()).toBe(2)
  })

  it('writes new record when statusNotes changes', async () => {
    const { ev1, ev2 } = await setup()

    await upsertSnapshot({ ...BASE, eventId: ev1.id, statusNotes: 'healthy' })
    await upsertSnapshot({ ...BASE, eventId: ev2.id, statusNotes: 'wounded' })

    expect(await db.characterSnapshots.count()).toBe(2)
  })

  it('writes new record when inventory changes', async () => {
    const { ev1, ev2 } = await setup()

    await upsertSnapshot({ ...BASE, eventId: ev1.id, inventoryItemIds: [] })
    await upsertSnapshot({ ...BASE, eventId: ev2.id, inventoryItemIds: ['sword'] })

    expect(await db.characterSnapshots.count()).toBe(2)
  })

  it('treats inventory as equal regardless of item order (set equality)', async () => {
    const { ev1, ev2 } = await setup()

    await upsertSnapshot({ ...BASE, eventId: ev1.id, inventoryItemIds: ['sword', 'shield'] })
    // Same items in different order — should deduplicate
    const result = await upsertSnapshot({ ...BASE, eventId: ev2.id, inventoryItemIds: ['shield', 'sword'] })

    expect(await db.characterSnapshots.count()).toBe(1)
    expect(result.eventId).toBe(ev1.id)
  })

  it('does not deduplicate when there is no prior snapshot for that character', async () => {
    const { ev1 } = await setup()

    await upsertSnapshot({ ...BASE, eventId: ev1.id })

    expect(await db.characterSnapshots.count()).toBe(1)
  })

  it('updates in-place when the same (characterId + eventId) is upserted again', async () => {
    const { ev1 } = await setup()

    const first = await upsertSnapshot({ ...BASE, eventId: ev1.id, statusNotes: 'initial' })
    await new Promise(r => setTimeout(r, 5))
    const second = await upsertSnapshot({ ...BASE, eventId: ev1.id, statusNotes: 'updated' })

    expect(second.id).toBe(first.id)
    expect(second.statusNotes).toBe('updated')
    expect(second.updatedAt).toBeGreaterThan(first.updatedAt)
    expect(await db.characterSnapshots.count()).toBe(1)
  })

  it('only deduplicates against the most recent prior snapshot, not an older one', async () => {
    const { ev1, ev2, ev3 } = await setup()

    await upsertSnapshot({ ...BASE, eventId: ev1.id, statusNotes: 'ch1' })
    // ev2 changes state
    await upsertSnapshot({ ...BASE, eventId: ev2.id, statusNotes: 'ch2' })
    // ev3 reverts to same as ev1 but is different from ev2 → should write
    await upsertSnapshot({ ...BASE, eventId: ev3.id, statusNotes: 'ch1' })

    expect(await db.characterSnapshots.count()).toBe(3)
  })

  it('travelModeId change alone triggers a new record', async () => {
    const { ev1, ev2 } = await setup()

    await upsertSnapshot({ ...BASE, eventId: ev1.id, travelModeId: null })
    await upsertSnapshot({ ...BASE, eventId: ev2.id, travelModeId: 'horse' })

    expect(await db.characterSnapshots.count()).toBe(2)
  })
})

/**
 * The one write the dedupe must not swallow.
 *
 * A writer walked down a chapter's cast, saw *no state recorded*, opened the
 * quick form, found it prefilled with the room the character was already in,
 * and pressed **Record state**. Nothing happened — no row, no toast, no error,
 * and the panel went on inviting them to record it. Nine of sixty-two cast rows
 * in a twelve-chapter draft, and three chapters of recording appeared to work
 * and did not land.
 *
 * The dedupe above is right for the writes nobody asked for. This is the one
 * somebody asked for, and it is the case the form exists to serve — the guide
 * promises it by name: *"makes confirming that somebody hasn't moved a single
 * click."*
 */
describe('upsertSnapshot — confirming a state that has not changed', () => {
  it('writes a record at this scene when the writer asks for one', async () => {
    const { ev1, ev2 } = await setup()

    await upsertSnapshot({ ...BASE, eventId: ev1.id, currentLocationMarkerId: 'office' })
    const result = await upsertSnapshot(
      { ...BASE, eventId: ev2.id, currentLocationMarkerId: 'office' },
      { confirmUnchanged: true },
    )

    expect(await db.characterSnapshots.count()).toBe(2)
    // At *this* scene — a record that landed on the earlier one would leave the
    // panel saying exactly what the writer pressed the button to change.
    expect(result.eventId).toBe(ev2.id)
  })

  it('still skips the write when nobody asked for it', async () => {
    // The pair. The same two calls without the flag, so the difference measured
    // is the flag and not the data.
    const { ev1, ev2 } = await setup()

    await upsertSnapshot({ ...BASE, eventId: ev1.id, currentLocationMarkerId: 'office' })
    const result = await upsertSnapshot({ ...BASE, eventId: ev2.id, currentLocationMarkerId: 'office' })

    expect(await db.characterSnapshots.count()).toBe(1)
    expect(result.eventId).toBe(ev1.id)
  })

  it('does not duplicate a record that already exists at this scene', async () => {
    // Confirming twice is not two assertions about one moment. The in-place
    // branch runs before the dedupe, so the flag must not reach past it.
    const { ev1, ev2 } = await setup()

    await upsertSnapshot({ ...BASE, eventId: ev1.id, currentLocationMarkerId: 'office' })
    await upsertSnapshot({ ...BASE, eventId: ev2.id, currentLocationMarkerId: 'office' }, { confirmUnchanged: true })
    await upsertSnapshot({ ...BASE, eventId: ev2.id, currentLocationMarkerId: 'office' }, { confirmUnchanged: true })

    expect(await db.characterSnapshots.count()).toBe(2)
    expect(await db.characterSnapshots.where('eventId').equals(ev2.id).count()).toBe(1)
  })
})
