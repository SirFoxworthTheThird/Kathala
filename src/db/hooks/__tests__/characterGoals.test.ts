import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld, deleteWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createEvent, deleteEvent } from '@/db/hooks/useTimeline'
import { createCharacter, deleteCharacter } from '@/db/hooks/useCharacters'
import {
  createCharacterGoal, updateCharacterGoal, deleteCharacterGoal,
} from '@/db/hooks/useCharacterGoals'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function seed() {
  const world = await createWorld({ name: 'Goals World', description: '' })
  const tl = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#fff' })
  const ch = await createChapter({ worldId: world.id, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
  const ev = await createEvent({
    worldId: world.id, chapterId: ch.id, timelineId: tl.id, title: 'Scene', description: '',
    locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
  })
  const char = await createCharacter({ worldId: world.id, name: 'Vela', description: '' })
  return { world, ev, char }
}

describe('character goals CRUD', () => {
  it('creates a goal with null scoping by default', async () => {
    const { world, char } = await seed()
    const goal = await createCharacterGoal({
      worldId: world.id, characterId: char.id, type: 'want', text: 'Reclaim the throne',
    })
    const stored = await db.characterGoals.get(goal.id)
    expect(stored?.text).toBe('Reclaim the throne')
    expect(stored?.type).toBe('want')
    expect(stored?.startEventId).toBeNull()
    expect(stored?.endEventId).toBeNull()
  })

  it('updates text and scoping', async () => {
    const { world, ev, char } = await seed()
    const goal = await createCharacterGoal({
      worldId: world.id, characterId: char.id, type: 'fear', text: 'The dark',
    })
    await updateCharacterGoal(goal.id, { text: 'Becoming his father', startEventId: ev.id })
    const stored = await db.characterGoals.get(goal.id)
    expect(stored?.text).toBe('Becoming his father')
    expect(stored?.startEventId).toBe(ev.id)
  })

  it('deletes a goal', async () => {
    const { world, char } = await seed()
    const goal = await createCharacterGoal({ worldId: world.id, characterId: char.id, type: 'flaw', text: 'Pride' })
    await deleteCharacterGoal(goal.id)
    expect(await db.characterGoals.get(goal.id)).toBeUndefined()
  })
})

describe('character goals cleanup', () => {
  it('drops a character\'s goals when the character is deleted', async () => {
    const { world, char } = await seed()
    await createCharacterGoal({ worldId: world.id, characterId: char.id, type: 'want', text: 'x' })
    await deleteCharacter(char.id)
    expect(await db.characterGoals.count()).toBe(0)
  })

  it('clears the scoping when a referenced event is deleted, keeping the goal', async () => {
    const { world, ev, char } = await seed()
    const goal = await createCharacterGoal({
      worldId: world.id, characterId: char.id, type: 'want', text: 'Reclaim the throne',
      startEventId: ev.id, endEventId: ev.id,
    })
    await deleteEvent(ev.id)
    const stored = await db.characterGoals.get(goal.id)
    // The goal survives — it just loses its bounds rather than dangling.
    expect(stored).toBeDefined()
    expect(stored!.startEventId).toBeNull()
    expect(stored!.endEventId).toBeNull()
  })

  it('drops goals when the world is deleted', async () => {
    const { world, char } = await seed()
    await createCharacterGoal({ worldId: world.id, characterId: char.id, type: 'need', text: 'y' })
    await deleteWorld(world.id)
    expect(await db.characterGoals.count()).toBe(0)
  })
})
