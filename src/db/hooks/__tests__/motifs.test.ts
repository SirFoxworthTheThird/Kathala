import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createEvent, updateEvent } from '@/db/hooks/useTimeline'
import { createMotif, updateMotif, deleteMotif } from '@/db/hooks/useMotifs'
import { collectWorldData, importWorldFromJson } from '@/lib/exportImport'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function makeEvent(worldId: string) {
  const tl = await createTimeline({ worldId, name: 'Main', description: '', color: '#fff' })
  const ch = await createChapter({ worldId, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
  return createEvent({
    worldId, chapterId: ch.id, timelineId: tl.id, title: 'Scene', description: '',
    locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
  })
}

describe('motifs', () => {
  it('creates a motif with a default empty description', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    const m = await createMotif({ worldId: world.id, name: 'Mirrors', color: '#e11d48' })
    expect(m.description).toBe('')
    expect((await db.motifs.get(m.id))!.name).toBe('Mirrors')
  })

  it('new events default to an empty motifIds array', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    const ev = await makeEvent(world.id)
    expect(ev.motifIds).toEqual([])
  })

  it('deleting a motif removes it from every tagged event', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    const ev = await makeEvent(world.id)
    const m = await createMotif({ worldId: world.id, name: 'Red', color: '#e11d48' })
    await updateEvent(ev.id, { motifIds: [m.id] })
    expect((await db.events.get(ev.id))!.motifIds).toEqual([m.id])

    await deleteMotif(m.id)
    expect(await db.motifs.get(m.id)).toBeUndefined()
    expect((await db.events.get(ev.id))!.motifIds).toEqual([])
  })

  it('updates a motif in place', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    const m = await createMotif({ worldId: world.id, name: 'Exile', color: '#000' })
    await updateMotif(m.id, { color: '#0891b2', description: 'the theme of banishment' })
    const stored = (await db.motifs.get(m.id))!
    expect(stored.color).toBe('#0891b2')
    expect(stored.description).toBe('the theme of banishment')
  })

  it('survives an export → import round-trip, with event tags intact', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    const ev = await makeEvent(world.id)
    const m = await createMotif({ worldId: world.id, name: 'Mirrors', color: '#7c3aed' })
    await updateEvent(ev.id, { motifIds: [m.id] })

    const collected = await collectWorldData(world.id)
    expect(collected.motifs).toHaveLength(1)
    const json = JSON.stringify({ version: 2, exportedAt: Date.now(), ...collected, blobs: [] })
    await db.delete(); await db.open()
    await importWorldFromJson(json)

    const motifs = await db.motifs.toArray()
    expect(motifs).toHaveLength(1)
    expect(motifs[0].name).toBe('Mirrors')
    const rev = (await db.events.toArray())[0]
    expect(rev.motifIds).toEqual([motifs[0].id])
  })
})
