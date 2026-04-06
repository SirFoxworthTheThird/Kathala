import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import {
  createTimeline, updateTimeline, deleteTimeline,
  createChapter, updateChapter, deleteChapter,
  createEvent, updateEvent, deleteEvent,
} from '@/db/hooks/useTimeline'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

// ── createTimeline ────────────────────────────────────────────────────────────

describe('createTimeline', () => {
  it('persists the timeline with id and createdAt', async () => {
    const tl = await createTimeline({ worldId: 'w', name: 'Main', description: 'Primary arc', color: '#ff0' })
    expect(tl.id).toBeTruthy()
    expect(tl.name).toBe('Main')
    expect(tl.color).toBe('#ff0')
    expect(tl.createdAt).toBeGreaterThan(0)
    expect(await db.timelines.get(tl.id)).toBeDefined()
  })
})

describe('updateTimeline', () => {
  it('updates the given fields', async () => {
    const tl = await createTimeline({ worldId: 'w', name: 'Old', description: '', color: '#000' })
    await updateTimeline(tl.id, { name: 'New', color: '#fff' })
    const stored = await db.timelines.get(tl.id)
    expect(stored!.name).toBe('New')
    expect(stored!.color).toBe('#fff')
  })
})

describe('deleteTimeline', () => {
  it('removes the timeline', async () => {
    const tl = await createTimeline({ worldId: 'w', name: 'T', description: '', color: '#f00' })
    await deleteTimeline(tl.id)
    expect(await db.timelines.get(tl.id)).toBeUndefined()
  })

  it('cascades to chapters', async () => {
    const tl = await createTimeline({ worldId: 'w', name: 'T', description: '', color: '#f00' })
    await createChapter({ worldId: 'w', timelineId: tl.id, number: 1, title: 'Ch 1', synopsis: '' })
    await deleteTimeline(tl.id)
    expect(await db.chapters.where('timelineId').equals(tl.id).count()).toBe(0)
  })

  it('cascades to events', async () => {
    const tl = await createTimeline({ worldId: 'w', name: 'T', description: '', color: '#f00' })
    const ch = await createChapter({ worldId: 'w', timelineId: tl.id, number: 1, title: 'Ch 1', synopsis: '' })
    await createEvent({
      worldId: 'w', chapterId: ch.id, timelineId: tl.id, title: 'Ev',
      description: '', locationMarkerId: null, involvedCharacterIds: [],
      involvedItemIds: [], tags: [], sortOrder: 0,
    })
    await deleteTimeline(tl.id)
    expect(await db.events.where('timelineId').equals(tl.id).count()).toBe(0)
  })
})

// ── createChapter ─────────────────────────────────────────────────────────────

describe('createChapter', () => {
  it('persists the chapter with id and timestamps', async () => {
    const ch = await createChapter({ worldId: 'w', timelineId: 'tl-1', number: 3, title: 'The Betrayal', synopsis: 'Dark times' })
    expect(ch.id).toBeTruthy()
    expect(ch.number).toBe(3)
    expect(ch.title).toBe('The Betrayal')
    expect(ch.synopsis).toBe('Dark times')
    expect(ch.createdAt).toBeGreaterThan(0)
    expect(ch.updatedAt).toBe(ch.createdAt)
    expect(await db.chapters.get(ch.id)).toBeDefined()
  })
})

describe('updateChapter', () => {
  it('updates the given fields and bumps updatedAt', async () => {
    const ch = await createChapter({ worldId: 'w', timelineId: 'tl-1', number: 1, title: 'Old', synopsis: '' })
    await new Promise((r) => setTimeout(r, 5))
    await updateChapter(ch.id, { title: 'New', synopsis: 'Updated synopsis' })
    const stored = await db.chapters.get(ch.id)
    expect(stored!.title).toBe('New')
    expect(stored!.synopsis).toBe('Updated synopsis')
    expect(stored!.updatedAt).toBeGreaterThan(ch.updatedAt)
  })
})

describe('deleteChapter', () => {
  it('removes the chapter', async () => {
    const ch = await createChapter({ worldId: 'w', timelineId: 'tl-1', number: 1, title: 'Ch', synopsis: '' })
    await deleteChapter(ch.id)
    expect(await db.chapters.get(ch.id)).toBeUndefined()
  })

  it('cascades to events', async () => {
    const ch = await createChapter({ worldId: 'w', timelineId: 'tl-1', number: 1, title: 'Ch', synopsis: '' })
    await createEvent({
      worldId: 'w', chapterId: ch.id, timelineId: 'tl-1', title: 'Ev',
      description: '', locationMarkerId: null, involvedCharacterIds: [],
      involvedItemIds: [], tags: [], sortOrder: 0,
    })
    await deleteChapter(ch.id)
    expect(await db.events.where('chapterId').equals(ch.id).count()).toBe(0)
  })

  it('cascades to characterSnapshots', async () => {
    const ch = await createChapter({ worldId: 'w', timelineId: 'tl-1', number: 1, title: 'Ch', synopsis: '' })
    await db.characterSnapshots.add({
      id: 'snap-1', worldId: 'w', characterId: 'char-1', chapterId: ch.id,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
      createdAt: Date.now(), updatedAt: Date.now(),
    })
    await deleteChapter(ch.id)
    expect(await db.characterSnapshots.where('chapterId').equals(ch.id).count()).toBe(0)
  })
})

// ── createEvent ───────────────────────────────────────────────────────────────

describe('createEvent', () => {
  it('persists the event with id and timestamps', async () => {
    const ev = await createEvent({
      worldId: 'w', chapterId: 'ch-1', timelineId: 'tl-1',
      title: 'The Dragon Rises', description: 'Chaos erupts',
      locationMarkerId: 'loc-1', involvedCharacterIds: ['char-1'],
      involvedItemIds: ['item-1'], tags: ['battle'], sortOrder: 5,
    })
    expect(ev.id).toBeTruthy()
    expect(ev.title).toBe('The Dragon Rises')
    expect(ev.sortOrder).toBe(5)
    expect(ev.locationMarkerId).toBe('loc-1')
    expect(ev.involvedCharacterIds).toEqual(['char-1'])
    expect(ev.involvedItemIds).toEqual(['item-1'])
    expect(ev.tags).toEqual(['battle'])
    expect(ev.createdAt).toBeGreaterThan(0)
    expect(await db.events.get(ev.id)).toBeDefined()
  })
})

describe('updateEvent', () => {
  it('updates the given fields and bumps updatedAt', async () => {
    const ev = await createEvent({
      worldId: 'w', chapterId: 'ch-1', timelineId: 'tl-1',
      title: 'Old', description: '', locationMarkerId: null,
      involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 1,
    })
    await new Promise((r) => setTimeout(r, 5))
    await updateEvent(ev.id, { title: 'New', sortOrder: 10 })
    const stored = await db.events.get(ev.id)
    expect(stored!.title).toBe('New')
    expect(stored!.sortOrder).toBe(10)
    expect(stored!.updatedAt).toBeGreaterThan(ev.updatedAt)
  })
})

describe('deleteEvent', () => {
  it('removes the event', async () => {
    const ev = await createEvent({
      worldId: 'w', chapterId: 'ch-1', timelineId: 'tl-1',
      title: 'Gone', description: '', locationMarkerId: null,
      involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
    })
    await deleteEvent(ev.id)
    expect(await db.events.get(ev.id)).toBeUndefined()
  })

  it('is a no-op for a non-existent id', async () => {
    await expect(deleteEvent('ghost')).resolves.toBeUndefined()
  })
})
