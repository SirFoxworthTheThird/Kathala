import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'
import { recordMention } from '@/db/hooks/useMentions'
import type { MapLayer } from '@/types'

/**
 * What the "@" picker writes, against the real hooks: the scene card's draft and
 * the Manuscript's Page both go through `recordMention`, so this is the one
 * place its claims are pinned.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function seed(scene: { involved?: string[]; mentioned?: string[]; place?: string | null } = {}) {
  const world = await createWorld({ name: 'W', description: '' })
  const tl = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#fff' })
  const ch = await createChapter({ worldId: world.id, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
  const e = await createEvent({
    worldId: world.id, chapterId: ch.id, timelineId: tl.id, title: 'The quay', description: '',
    locationMarkerId: scene.place ?? null, involvedCharacterIds: scene.involved ?? [], involvedItemIds: [],
    tags: [], sortOrder: 1, status: 'draft',
  })
  if (scene.mentioned) await db.events.update(e.id, { mentionedCharacterIds: scene.mentioned })
  return { worldId: world.id, eventId: e.id }
}
const none = { markers: [], mapLayers: [] }
const scene = async (id: string) => (await db.events.get(id))!

describe('recording what "@" named', () => {
  it('@ on a character records them as mentioned, once', async () => {
    const { eventId } = await seed()
    const marn = { type: 'existing', kind: 'character', id: 'marn', name: 'Marn', insert: 'Marn' } as const
    await recordMention(eventId, marn, 'mention', none)
    await recordMention(eventId, marn, 'mention', none)
    const e = await scene(eventId)
    expect(e.mentionedCharacterIds).toEqual(['marn'])
    expect(e.involvedCharacterIds).toEqual([])
  })

  it('but not someone already in the room: that is the stronger claim', async () => {
    const { eventId } = await seed({ involved: ['marn'] })
    await recordMention(eventId, { type: 'existing', kind: 'character', id: 'marn', name: 'Marn', insert: 'Marn' }, 'mention', none)
    expect((await scene(eventId)).mentionedCharacterIds ?? []).toEqual([])
  })

  it('@@ puts a character in the room and takes them off the mentioned list, in one write', async () => {
    const { eventId } = await seed({ mentioned: ['marn', 'vey'] })
    await recordMention(eventId, { type: 'existing', kind: 'character', id: 'marn', name: 'Marn', insert: 'Marn' }, 'present', none)
    const e = await scene(eventId)
    expect(e.involvedCharacterIds).toEqual(['marn'])
    expect(e.mentionedCharacterIds).toEqual(['vey'])
  })

  it('a new character is made, and mentioned', async () => {
    const { worldId, eventId } = await seed()
    await recordMention(eventId, { type: 'create', kind: 'character', name: 'Wenmere' }, 'mention', none)
    const made = (await db.characters.where('worldId').equals(worldId).toArray()).find((c) => c.name === 'Wenmere')
    expect(made).toBeDefined()
    expect((await scene(eventId)).mentionedCharacterIds).toEqual([made!.id])
  })

  it('an item, new or not, goes with the scene', async () => {
    const { worldId, eventId } = await seed()
    await recordMention(eventId, { type: 'existing', kind: 'item', id: 'knife', name: 'Knife', insert: 'Knife' }, 'mention', none)
    await recordMention(eventId, { type: 'create', kind: 'item', name: 'Ledger' }, 'mention', none)
    const ledger = (await db.items.where('worldId').equals(worldId).toArray()).find((i) => i.name === 'Ledger')
    expect((await scene(eventId)).involvedItemIds).toEqual(['knife', ledger!.id])
  })

  it('a place sets the scene’s setting only when it has none', async () => {
    const empty = await seed()
    await recordMention(empty.eventId, { type: 'existing', kind: 'location', id: 'quay', name: 'Quay', insert: 'Quay' }, 'mention', none)
    expect((await scene(empty.eventId)).locationMarkerId).toBe('quay')
    const set = await seed({ place: 'court' })
    await recordMention(set.eventId, { type: 'existing', kind: 'location', id: 'quay', name: 'Quay', insert: 'Quay' }, 'mention', none)
    expect((await scene(set.eventId)).locationMarkerId).toBe('court')
  })

  it('a new place goes at the centre of the first map, or on none when there is no map', async () => {
    const { worldId, eventId } = await seed()
    const layer = { id: 'm1', imageWidth: 400, imageHeight: 200 } as MapLayer
    await recordMention(eventId, { type: 'create', kind: 'location', name: 'The Ossuary' }, 'mention', { markers: [], mapLayers: [layer] })
    const made = (await db.locationMarkers.where('worldId').equals(worldId).toArray()).find((m) => m.name === 'The Ossuary')!
    expect([made.mapLayerId, made.x, made.y]).toEqual(['m1', 200, 100])
    expect((await scene(eventId)).locationMarkerId).toBe(made.id)

    const bare = await seed()
    await recordMention(bare.eventId, { type: 'create', kind: 'location', name: 'The Kitchen' }, 'mention', none)
    const kitchen = (await db.locationMarkers.toArray()).find((m) => m.name === 'The Kitchen')!
    expect(kitchen.mapLayerId).toBeNull()
  })

  it('a caller’s own mention is used in place of the scene’s', async () => {
    const { eventId } = await seed()
    const asked: string[] = []
    await recordMention(eventId, { type: 'existing', kind: 'character', id: 'marn', name: 'Marn', insert: 'Marn' }, 'mention',
      { ...none, mention: (id) => { asked.push(id) } })
    expect(asked).toEqual(['marn'])
    expect((await scene(eventId)).mentionedCharacterIds ?? []).toEqual([])
  })
})
