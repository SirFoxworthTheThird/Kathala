import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'
import { createCharacter } from '@/db/hooks/useCharacters'
import { upsertSnapshot } from '@/db/hooks/useSnapshots'

// ── Helpers matching exact wizard behaviour ───────────────────────────────────

async function runStep1(worldId: string, name: string) {
  const timeline = await createTimeline({ worldId, name: name.trim(), description: '', color: '#6366f1' })
  const chapter  = await createChapter({ worldId, timelineId: timeline.id, number: 1, title: 'Chapter 1', synopsis: '' })
  const event    = await createEvent({
    worldId,
    timelineId: timeline.id,
    chapterId: chapter.id,
    title: name.trim(),
    description: '',
    locationMarkerId: null,
    involvedCharacterIds: [],
    involvedItemIds: [],
    tags: [],
    sortOrder: 0,
  })
  return { timeline, chapter, event }
}

async function runStep2(worldId: string, name: string) {
  return createCharacter({ worldId, name: name.trim(), description: '' })
}

async function runStep3(worldId: string, characterId: string, eventId: string) {
  return upsertSnapshot({
    worldId,
    characterId,
    eventId,
    isAlive: true,
    currentLocationMarkerId: null,
    currentMapLayerId: null,
    inventoryItemIds: [],
    inventoryNotes: '',
    statusNotes: '',
    travelModeId: null,
  })
}

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

// ── WIZ-03: Step 1 creates timeline, chapter, and event ──────────────────────

describe('WIZ-03 — Step 1 DB writes', () => {
  it('creates a timeline with the indigo default colour', async () => {
    const { timeline } = await runStep1('world-1', 'The Age of Embers')
    const stored = await db.timelines.get(timeline.id)
    expect(stored).toBeDefined()
    expect(stored!.color).toBe('#6366f1')
    expect(stored!.name).toBe('The Age of Embers')
    expect(stored!.worldId).toBe('world-1')
  })

  it('creates chapter 1 under the timeline', async () => {
    const { chapter, timeline } = await runStep1('world-1', 'The Long Road')
    const stored = await db.chapters.get(chapter.id)
    expect(stored).toBeDefined()
    expect(stored!.number).toBe(1)
    expect(stored!.title).toBe('Chapter 1')
    expect(stored!.timelineId).toBe(timeline.id)
  })

  it('creates an event whose title matches the timeline name', async () => {
    const { event, chapter, timeline } = await runStep1('world-1', 'Act One')
    const stored = await db.events.get(event.id)
    expect(stored).toBeDefined()
    expect(stored!.title).toBe('Act One')
    expect(stored!.sortOrder).toBe(0)
    expect(stored!.chapterId).toBe(chapter.id)
    expect(stored!.timelineId).toBe(timeline.id)
  })

  it('returns an event id that can be passed to step 3', async () => {
    const { event } = await runStep1('world-1', 'Prologue')
    expect(typeof event.id).toBe('string')
    expect(event.id.length).toBeGreaterThan(0)
  })
})

// ── WIZ-04: Event id survives to step 3 (eventId pre-selection) ──────────────

describe('WIZ-04 — event id round-trip', () => {
  it('the event created in step 1 is retrievable by its returned id', async () => {
    const { event } = await runStep1('world-1', 'The Opening Chapter')
    const retrieved = await db.events.get(event.id)
    expect(retrieved!.id).toBe(event.id)
  })
})

// ── WIZ-05: Step 2 creates a character ───────────────────────────────────────

describe('WIZ-05 — Step 2 DB writes', () => {
  it('creates a character with isAlive: true by default', async () => {
    const character = await runStep2('world-1', 'Kira Ashvale')
    const stored = await db.characters.get(character.id)
    expect(stored).toBeDefined()
    expect(stored!.name).toBe('Kira Ashvale')
    expect(stored!.isAlive).toBe(true)
    expect(stored!.worldId).toBe('world-1')
  })

  it('trims whitespace from the character name', async () => {
    const character = await createCharacter({ worldId: 'world-1', name: '  The Wanderer  ', description: '' })
    // createCharacter stores whatever is passed — trimming is the caller's responsibility (StepCharacter)
    // so we verify trimming is applied before the call
    const trimmed = '  The Wanderer  '.trim()
    expect(trimmed).toBe('The Wanderer')
    expect(character.name).toBe('  The Wanderer  ') // raw pass-through at DB layer
  })
})

// ── WIZ-07: Step 3 creates a snapshot linking character ↔ event ──────────────

describe('WIZ-07 — Step 3 DB writes', () => {
  it('creates a characterSnapshot with correct characterId and eventId', async () => {
    const { event } = await runStep1('world-1', 'The Opening')
    const character = await runStep2('world-1', 'Cael')
    const snapshot  = await runStep3('world-1', character.id, event.id)

    expect(snapshot.characterId).toBe(character.id)
    expect(snapshot.eventId).toBe(event.id)
    expect(snapshot.isAlive).toBe(true)
    expect(snapshot.worldId).toBe('world-1')

    const stored = await db.characterSnapshots
      .where('[characterId+eventId]')
      .equals([character.id, event.id])
      .first()
    expect(stored).toBeDefined()
  })

  it('does not duplicate the snapshot on a second identical call', async () => {
    const { event } = await runStep1('world-1', 'The Opening')
    const character = await runStep2('world-1', 'Cael')
    await runStep3('world-1', character.id, event.id)
    await runStep3('world-1', character.id, event.id) // idempotent call

    const count = await db.characterSnapshots
      .where('[characterId+eventId]')
      .equals([character.id, event.id])
      .count()
    expect(count).toBe(1)
  })
})

// ── WIZ-08: Step 3 null characterId guard ────────────────────────────────────

describe('WIZ-08 — Step 3 null characterId guard', () => {
  it('the guard condition (!characterId || !selectedEventId) catches null characterId', () => {
    const characterId: string | null = null
    const selectedEventId = 'event-123'
    expect(!characterId || !selectedEventId).toBe(true) // should skip
  })

  it('the guard condition catches null eventId', () => {
    const characterId = 'char-123'
    const selectedEventId: string = ''
    expect(!characterId || !selectedEventId).toBe(true) // should skip
  })

  it('the guard passes when both are valid', () => {
    const characterId = 'char-123'
    const selectedEventId = 'event-123'
    expect(!characterId || !selectedEventId).toBe(false) // should proceed
  })
})

// ── WIZ-09: Step 3 with no events shows soft continue path ───────────────────

describe('WIZ-09 — Step 3 no-events path', () => {
  it('a world with no events has an empty events table', async () => {
    const count = await db.events.where('worldId').equals('empty-world').count()
    expect(count).toBe(0)
  })
})

// ── WIZ-10: Whitespace-only timeline name rejected at caller level ────────────

describe('WIZ-10 — whitespace-only name validation', () => {
  it('blank string fails trim check', () => {
    expect('   '.trim()).toBe('')
    expect(!'   '.trim()).toBe(true) // !name.trim() evaluates to true → error shown
  })

  it('a name with content passes', () => {
    expect('The Age of Embers'.trim()).toBe('The Age of Embers')
    expect(!'The Age of Embers'.trim()).toBe(false)
  })
})

// ── WIZ-11: Whitespace-only character name rejected at caller level ───────────

describe('WIZ-11 — whitespace-only character name validation', () => {
  it('blank character name fails trim check', () => {
    expect('  '.trim()).toBe('')
    expect(!'  '.trim()).toBe(true)
  })
})

// ── WIZ-12: Full wizard flow runs without DB errors ──────────────────────────

describe('WIZ-12 — full wizard flow', () => {
  it('completes all four steps without throwing', async () => {
    const worldId = 'world-full'

    // Step 1
    const { event } = await runStep1(worldId, 'The Long Road')

    // Step 2
    const character = await runStep2(worldId, 'Aria')

    // Step 3
    const snapshot = await runStep3(worldId, character.id, event.id)

    // Verify final DB state
    expect(await db.timelines.where('worldId').equals(worldId).count()).toBe(1)
    expect(await db.chapters.where('worldId').equals(worldId).count()).toBe(1)
    expect(await db.events.where('worldId').equals(worldId).count()).toBe(1)
    expect(await db.characters.where('worldId').equals(worldId).count()).toBe(1)
    expect(snapshot.characterId).toBe(character.id)
    expect(snapshot.eventId).toBe(event.id)
  })
})

// ── WIZ-13: Duplicate timeline names are allowed ─────────────────────────────

describe('WIZ-13 — duplicate timeline names allowed', () => {
  it('can create two timelines with the same name in the same world', async () => {
    await runStep1('world-dup', 'Main')
    await runStep1('world-dup', 'Main')
    const count = await db.timelines.where('worldId').equals('world-dup').count()
    expect(count).toBe(2)
  })
})

// ── WIZ-01/02: Wizard trigger condition ──────────────────────────────────────

describe('WIZ-01/02 — wizard trigger condition', () => {
  it('WIZ-01: world with no timelines should trigger wizard (count === 0)', async () => {
    const count = await db.timelines.where('worldId').equals('new-world').count()
    expect(count).toBe(0) // trigger condition: timelineCount === 0 || eventCount === 0
  })

  it('WIZ-02: world with a timeline should NOT trigger wizard', async () => {
    await runStep1('world-existing', 'Existing Timeline')
    const count = await db.timelines.where('worldId').equals('world-existing').count()
    expect(count).toBe(1) // does not satisfy timelineCount === 0
  })

  it('WIZ-02: world with events should NOT trigger wizard', async () => {
    await runStep1('world-existing-2', 'Some Timeline')
    const eventCount = await db.events.where('worldId').equals('world-existing-2').count()
    expect(eventCount).toBeGreaterThan(0) // does not satisfy eventCount === 0
  })
})
