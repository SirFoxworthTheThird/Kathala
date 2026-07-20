import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'
import { setSceneText } from '@/db/hooks/useManuscript'
import { logWritingProgress } from '@/db/hooks/useWritingLog'
import { localDayKey } from '@/lib/writingProgress'
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

describe('writing log — logging through setSceneText', () => {
  it('logs net word deltas as prose is written, edited and cleared', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    const ev = await makeEvent(world.id)
    const today = localDayKey(Date.now())

    // First draft: 5 words.
    await setSceneText(world.id, ev.id, 'one two three four five')
    let row = await db.writingLogs.where('[worldId+date]').equals([world.id, today]).first()
    expect(row?.words).toBe(5)

    // Expand to 8 words → +3.
    await setSceneText(world.id, ev.id, 'one two three four five six seven eight')
    row = await db.writingLogs.where('[worldId+date]').equals([world.id, today]).first()
    expect(row?.words).toBe(8)

    // Trim to 2 words → -6, net 2 for the day.
    await setSceneText(world.id, ev.id, 'one two')
    row = await db.writingLogs.where('[worldId+date]').equals([world.id, today]).first()
    expect(row?.words).toBe(2)

    // Clear entirely → -2, net 0; the row stays but reads 0.
    await setSceneText(world.id, ev.id, '')
    row = await db.writingLogs.where('[worldId+date]').equals([world.id, today]).first()
    expect(row?.words).toBe(0)
    // Scene text itself is gone.
    expect(await db.sceneTexts.where('eventId').equals(ev.id).count()).toBe(0)
  })

  it('accumulates separate days into separate rows', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    await logWritingProgress(world.id, 400, new Date(2026, 6, 18, 9).getTime())
    await logWritingProgress(world.id, 600, new Date(2026, 6, 18, 20).getTime())
    await logWritingProgress(world.id, 300, new Date(2026, 6, 19, 10).getTime())

    const rows = await db.writingLogs.where('worldId').equals(world.id).toArray()
    const byDate = Object.fromEntries(rows.map((r) => [r.date, r.words]))
    expect(byDate['2026-07-18']).toBe(1000)
    expect(byDate['2026-07-19']).toBe(300)
  })

  it('survives an export → import round-trip', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    await db.worlds.update(world.id, { wordTarget: 50000 })
    const ev = await makeEvent(world.id)
    await setSceneText(world.id, ev.id, 'alpha beta gamma')

    const collected = await collectWorldData(world.id)
    expect(collected.writingLogs.length).toBe(1)
    const json = JSON.stringify({ version: 2, exportedAt: Date.now(), ...collected, blobs: [] })
    await db.delete(); await db.open()
    await importWorldFromJson(json)

    const rows = await db.writingLogs.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].words).toBe(3)
    const rw = (await db.worlds.toArray())[0]
    expect(rw.wordTarget).toBe(50000)
  })
})
