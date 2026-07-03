import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import {
  createTimeline, createChapter, createEvent, updateEvent,
  deleteEvent, deleteChapter, deleteTimeline,
} from '@/db/hooks/useTimeline'
import { createCharacter } from '@/db/hooks/useCharacters'
import { upsertSnapshot } from '@/db/hooks/useSnapshots'
import { createKnowledgeFact } from '@/db/hooks/useKnowledge'
import { setSceneText } from '@/db/hooks/useManuscript'
import { serializeWorldForSync, importWorldFromJson } from '@/lib/exportImport'
import { computeCharacterAppearances } from '@/lib/characterAppearances'
import { computeProseMentionIssues, computeKnowledgeLeaks } from '@/lib/proseContinuity'

// ── Shared fixture: a small world with one chapter and three scenes ───────────

async function seedWorld(worldId: string) {
  await db.worlds.put({
    id: worldId, name: 'Test World', description: '', coverImageId: null,
    theme: null, continuityStaleThreshold: 5, createdAt: 1, updatedAt: 1,
  } as never)
  const timeline = await createTimeline({ worldId, name: 'Main', description: '', color: '#6366f1' })
  const chapter = await createChapter({ worldId, timelineId: timeline.id, number: 1, title: 'Ch 1', synopsis: '' })
  const mkEvent = (title: string, sortOrder: number, involvedCharacterIds: string[] = []) =>
    createEvent({
      worldId, timelineId: timeline.id, chapterId: chapter.id, title, description: '',
      locationMarkerId: null, involvedCharacterIds, involvedItemIds: [], tags: [], sortOrder,
    })
  const kael = await createCharacter({ worldId, name: 'Kael', description: '' })
  const mira = await createCharacter({ worldId, name: 'Mira', description: '' })
  const e1 = await mkEvent('Opening', 0, [kael.id])
  const e2 = await mkEvent('The Road', 1, [mira.id])
  const e3 = await mkEvent('Reunion', 2, [mira.id])
  return { timeline, chapter, kael, mira, e1, e2, e3 }
}

async function sceneTextMap(worldId: string) {
  const rows = await db.sceneTexts.where('worldId').equals(worldId).toArray()
  return new Map(rows.map((s) => [s.eventId, s.text]))
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})
afterAll(async () => {
  await db.delete()
})

// ── Scene text lifecycle via setSceneText ─────────────────────────────────────

describe('scene text lifecycle', () => {
  it('creates a row and computes the word count', async () => {
    const { e1 } = await seedWorld('w1')
    await setSceneText('w1', e1.id, 'The storm broke over the hills.')
    const row = await db.sceneTexts.where('eventId').equals(e1.id).first()
    expect(row).toBeDefined()
    expect(row!.wordCount).toBe(6)
    expect(row!.worldId).toBe('w1')
  })

  it('overwrites the existing row and recomputes the count (no duplicates)', async () => {
    const { e1 } = await seedWorld('w1')
    await setSceneText('w1', e1.id, 'One two three.')
    await setSceneText('w1', e1.id, 'One two three four five.')
    const rows = await db.sceneTexts.where('eventId').equals(e1.id).toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].wordCount).toBe(5)
  })

  it('deletes the row when set to empty prose', async () => {
    const { e1 } = await seedWorld('w1')
    await setSceneText('w1', e1.id, 'Something.')
    await setSceneText('w1', e1.id, '   ')
    expect(await db.sceneTexts.where('eventId').equals(e1.id).count()).toBe(0)
  })
})

// ── Mention persistence via the real event CRUD ───────────────────────────────

describe('mention persistence', () => {
  it('defaults mentionedCharacterIds to [] on createEvent', async () => {
    const { e1 } = await seedWorld('w1')
    const stored = await db.events.get(e1.id)
    expect(stored!.mentionedCharacterIds).toEqual([])
  })

  it('persists an @-mention written through updateEvent', async () => {
    const { e3, kael } = await seedWorld('w1')
    await updateEvent(e3.id, { mentionedCharacterIds: [kael.id] })
    const stored = await db.events.get(e3.id)
    expect(stored!.mentionedCharacterIds).toEqual([kael.id])
  })
})

// ── Cascade deletion of scene text ────────────────────────────────────────────

describe('scene text cascade deletes', () => {
  it('removes an event\'s scene text when the event is deleted', async () => {
    const { e1 } = await seedWorld('w1')
    await setSceneText('w1', e1.id, 'Prose here.')
    await deleteEvent(e1.id)
    expect(await db.sceneTexts.where('eventId').equals(e1.id).count()).toBe(0)
  })

  it('removes scene text when the chapter is deleted', async () => {
    const { chapter, e1, e2 } = await seedWorld('w1')
    await setSceneText('w1', e1.id, 'Alpha prose.')
    await setSceneText('w1', e2.id, 'Beta prose.')
    await deleteChapter(chapter.id)
    expect(await db.sceneTexts.where('worldId').equals('w1').count()).toBe(0)
  })

  it('removes scene text when the whole timeline is deleted', async () => {
    const { timeline, e1 } = await seedWorld('w1')
    await setSceneText('w1', e1.id, 'Gamma prose.')
    await deleteTimeline(timeline.id)
    expect(await db.sceneTexts.where('worldId').equals('w1').count()).toBe(0)
  })
})

// ── Character appearances derived from DB-written data ─────────────────────────

describe('character appearances (present vs mentioned)', () => {
  it('splits present (cast/POV) from mentioned across stored events', async () => {
    const { e1, e2, e3, kael } = await seedWorld('w1')
    // Kael is cast in e1, POV in e2, and merely mentioned in e3.
    await updateEvent(e2.id, { povCharacterId: kael.id })
    await updateEvent(e3.id, { mentionedCharacterIds: [kael.id] })

    const events = await db.events.where('worldId').equals('w1').toArray()
    const chapters = await db.chapters.where('worldId').equals('w1').toArray()
    const { present, mentioned } = computeCharacterAppearances({ characterId: kael.id, events, chapters })

    expect(present.map((a) => a.eventId).sort()).toEqual([e1.id, e2.id].sort())
    expect(mentioned.map((a) => a.eventId)).toEqual([e3.id])
  })
})

// ── Prose-aware continuity over the real store ────────────────────────────────

describe('prose continuity from stored scene text', () => {
  it('flags a dead character named in a later scene, then silences it once mentioned', async () => {
    const { e1, e3, kael } = await seedWorld('w1')
    // Kael dies at e1; his name appears in e3's prose (e3 cast is Mira only).
    await upsertSnapshot({
      worldId: 'w1', characterId: kael.id, eventId: e1.id, isAlive: false,
      currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
    })
    await setSceneText('w1', e3.id, 'Mira wept, remembering Kael.')

    const events = await db.events.where('worldId').equals('w1').toArray()
    const chapters = await db.chapters.where('worldId').equals('w1').toArray()
    const characters = await db.characters.where('worldId').equals('w1').toArray()
    const snapshots = await db.characterSnapshots.where('worldId').equals('w1').toArray()

    const before = computeProseMentionIssues({ events, chapters, characters, snapshots, sceneTextByEvent: await sceneTextMap('w1') })
    expect(before.some((i) => i.kind === 'dead' && i.characterId === kael.id && i.eventId === e3.id)).toBe(true)

    // Explicitly acknowledging the mention resolves the nudge.
    await updateEvent(e3.id, { mentionedCharacterIds: [kael.id] })
    const eventsAfter = await db.events.where('worldId').equals('w1').toArray()
    const after = computeProseMentionIssues({ events: eventsAfter, chapters, characters, snapshots, sceneTextByEvent: await sceneTextMap('w1') })
    expect(after.some((i) => i.characterId === kael.id && i.eventId === e3.id)).toBe(false)
  })

  it('flags a reader knowledge leak when a fact tag appears before its reveal', async () => {
    const { e1, e3 } = await seedWorld('w1')
    await createKnowledgeFact({ worldId: 'w1', title: 'The true heir', description: '', tags: ['heir'], readerLearnsAtEventId: e3.id })
    await setSceneText('w1', e1.id, 'A hidden heir waited in the north.')

    const events = await db.events.where('worldId').equals('w1').toArray()
    const chapters = await db.chapters.where('worldId').equals('w1').toArray()
    const facts = await db.knowledgeFacts.where('worldId').equals('w1').toArray()

    const leaks = computeKnowledgeLeaks({ facts, events, chapters, sceneTextByEvent: await sceneTextMap('w1') })
    expect(leaks).toHaveLength(1)
    expect(leaks[0]).toMatchObject({ leakEventId: e1.id, revealEventId: e3.id, matchedTerm: 'heir' })
  })
})

// ── Full export → import round-trip through the real serializer ────────────────

describe('export/import round-trip', () => {
  it('preserves mentions and scene text across serialize → import into a fresh DB', async () => {
    const { e1, e3, kael } = await seedWorld('w1')
    await updateEvent(e3.id, { mentionedCharacterIds: [kael.id] })
    await setSceneText('w1', e1.id, 'The opening scene, four words plus more.')

    const json = await serializeWorldForSync('w1')

    // Simulate importing into a clean install.
    await db.delete()
    await db.open()
    const importedId = await importWorldFromJson(json)
    expect(importedId).toBe('w1')

    const e3Stored = await db.events.get(e3.id)
    expect(e3Stored!.mentionedCharacterIds).toEqual([kael.id])

    const scene = await db.sceneTexts.where('eventId').equals(e1.id).first()
    expect(scene).toBeDefined()
    expect(scene!.text).toBe('The opening scene, four words plus more.')
    expect(scene!.wordCount).toBe(7)
  })
})
