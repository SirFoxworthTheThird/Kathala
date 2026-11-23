import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll, afterEach, vi } from 'vitest'
import { db } from '@/db/database'
import { createWorld, deleteWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'
import { setSceneText } from '@/db/hooks/useManuscript'
import { splitScene, joinWithNext, replaceSceneTexts } from '@/db/hooks/useSceneStructure'
import {
  startSprint, pauseSprint, resumeSprint, stopSprint, finishSprint, closeOverdueSprints, openSprint,
} from '@/db/hooks/useSprints'
import { localDayKey, computeStreak } from '@/lib/writingProgress'
import { SPRINT_GRACE_MS } from '@/lib/sprints'
import { collectWorldData, importWorldFromJson, applyWorldImport, previewWorldMerge, serializeWorldForSync } from '@/lib/exportImport'

/*
  Sprints against the real hooks (issue #706, sprints-plan.md): a sprint's
  figures against the writing log, saved by typing, a cut, a split, a join and
  Find & replace; the sprint's window; ending it, and a page closed; the file.
*/

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterEach(() => { vi.restoreAllMocks() })

afterAll(async () => {
  await db.delete()
})

const MIN = 60_000
const T0 = new Date(2026, 10, 23, 9, 0).getTime()
/** The clock, for the hooks that read it. */
function at(t: number) { vi.spyOn(Date, 'now').mockReturnValue(t) }

async function seed() {
  const world = await createWorld({ name: 'W', description: '' })
  const tl = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#fff' })
  const ch = await createChapter({ worldId: world.id, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
  const scene = async (title: string, sortOrder: number) => (await createEvent({
    worldId: world.id, chapterId: ch.id, timelineId: tl.id, title, description: '',
    locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder,
  })).id
  return { world, a: await scene('a', 1), b: await scene('b', 2) }
}

const today = async (worldId: string) => {
  const row = await db.writingLogs.where('[worldId+date]').equals([worldId, localDayKey(T0)]).first()
  return { words: row?.words ?? 0, added: row?.added ?? 0, cut: row?.cut ?? 0 }
}
const sprintRow = async (id: string) => (await db.sprints.get(id))!

describe('a sprint’s words are the log’s words for its time', () => {
  it('typing, a rewrite, a cut, a split, a join and a replacement, each as the day counts it', async () => {
    const { world, a, b } = await seed()
    at(T0 - MIN)
    // Before the sprint: not in it.
    await setSceneText(world.id, a, 'Teodora walked to the gate.')
    const before = await today(world.id)
    at(T0)
    const s = (await startSprint(world.id, 25))!

    at(T0 + MIN)
    await setSceneText(world.id, a, 'Teodora walked to the gate. It was shut, and she waited by it.') // +8
    at(T0 + 2 * MIN)
    await setSceneText(world.id, a, 'Teodora ran to the gate. It was shut, and she waited by it.') // a word rewritten: +1 −1
    at(T0 + 3 * MIN)
    await setSceneText(world.id, a, 'Teodora ran to the gate. It was shut.') // −5, and *shut,* is *shut.* now: +1 −6
    expect(await sprintRow(s.id)).toMatchObject({ wordsAdded: 10, wordsCut: 7 })

    // A split moves words and counts nothing; a join of two scenes, likewise (S8).
    at(T0 + 4 * MIN)
    await setSceneText(world.id, b, 'Ambrose was not there.') // +4
    const split = (await splitScene(a, 'Teodora ran to the gate.'.length, 'the gate'))!
    expect(await sprintRow(s.id)).toMatchObject({ wordsAdded: 14, wordsCut: 7 })
    await joinWithNext(a)
    expect(await sprintRow(s.id)).toMatchObject({ wordsAdded: 14, wordsCut: 7 })

    // Find & replace is writing, not a move: what it put in and took out.
    at(T0 + 5 * MIN)
    const joined = (await db.sceneTexts.where('eventId').equals(a).first())!.text
    await replaceSceneTexts(world.id, [{ eventId: a, text: joined.replace('ran', 'hurried') }], { label: 'Replace' })
    expect(await sprintRow(s.id)).toMatchObject({ wordsAdded: 15, wordsCut: 8 })

    // The sprint holds exactly what the log gained while it ran.
    const after = await today(world.id)
    const row = await sprintRow(s.id)
    expect(row.wordsAdded).toBe(after.added - before.added)
    expect(row.wordsCut).toBe(after.cut - before.cut)
    expect(after.words - before.words).toBe(row.wordsAdded - row.wordsCut)
    // The scenes saved: a split and a join that only moved words saved nothing, and the scene split off is gone.
    expect(new Set(row.eventIds)).toEqual(new Set([a, b]))
    expect(await db.events.get(split.id)).toBeUndefined()
  })

  it('a save after its time and grace is not in it; one within the grace is', async () => {
    const { world, a } = await seed()
    at(T0)
    const s = (await startSprint(world.id, 15))!
    at(T0 + 15 * MIN + SPRINT_GRACE_MS)
    await setSceneText(world.id, a, 'Saved as the time ran out.') // 6 words
    at(T0 + 15 * MIN + SPRINT_GRACE_MS + 1)
    await setSceneText(world.id, a, 'Saved as the time ran out. Too late.')
    expect(await sprintRow(s.id)).toMatchObject({ wordsAdded: 6, wordsCut: 0 })
    expect((await today(world.id)).added).toBe(8)
  })

  it('a pause counts nothing, and moves the end on by its length', async () => {
    const { world, a } = await seed()
    at(T0)
    const s = (await startSprint(world.id, 15))!
    at(T0 + 5 * MIN)
    await pauseSprint(s.id)
    at(T0 + 6 * MIN)
    await setSceneText(world.id, a, 'Written while paused.')
    at(T0 + 15 * MIN)
    await resumeSprint(s.id)
    // Ten minutes paused: the end is at 25 minutes now.
    at(T0 + 24 * MIN)
    await setSceneText(world.id, a, 'Written while paused. Written after it.')
    expect(await sprintRow(s.id)).toMatchObject({ wordsAdded: 3, wordsCut: 0, pausedMs: 10 * MIN, pausedAt: null })
  })

  it('one sprint open in a world at a time; another world has its own', async () => {
    const { world, a } = await seed()
    const other = await createWorld({ name: 'Other', description: '' })
    at(T0)
    const s = (await startSprint(world.id, 25))!
    expect(await startSprint(world.id, 15)).toBeNull()
    const o = (await startSprint(other.id, 15))!
    await setSceneText(world.id, a, 'Only in the first world.')
    expect(await sprintRow(s.id)).toMatchObject({ wordsAdded: 5 })
    expect(await sprintRow(o.id)).toMatchObject({ wordsAdded: 0 })
  })
})

describe('ending a sprint', () => {
  it('stopped: ends now, with the time it ran and nothing after', async () => {
    const { world, a } = await seed()
    at(T0)
    const s = (await startSprint(world.id, 25))!
    at(T0 + 4 * MIN)
    await pauseSprint(s.id)
    at(T0 + 9 * MIN)
    await stopSprint(s.id)
    await setSceneText(world.id, a, 'After the stop.')
    expect(await sprintRow(s.id)).toMatchObject({ endedAt: T0 + 9 * MIN, ended: 'stopped', pausedMs: 5 * MIN, pausedAt: null, wordsAdded: 0 })
    expect(await openSprint(world.id)).toBeUndefined()
    // Ended is ended: nothing changes it after.
    expect(await resumeSprint(s.id)).toBeNull()
    expect(await finishSprint(s.id, 'done')).toBeNull()
  })

  it('done: ends at its planned end, not when the end was written', async () => {
    const { world } = await seed()
    at(T0)
    const s = (await startSprint(world.id, 25))!
    at(T0 + 25 * MIN + 1500)
    await finishSprint(s.id, 'done')
    expect(await sprintRow(s.id)).toMatchObject({ endedAt: T0 + 25 * MIN, ended: 'done' })
  })

  it('a page closed mid-sprint: ended at its planned end when the app next opens, with the words saved before', async () => {
    const { world, a } = await seed()
    at(T0)
    const s = (await startSprint(world.id, 25))!
    at(T0 + 10 * MIN)
    await setSceneText(world.id, a, 'Saved before the page closed.')
    // Still within its time: nothing to close.
    expect(await closeOverdueSprints(world.id, T0 + 20 * MIN)).toEqual([])
    expect(await closeOverdueSprints(world.id, T0 + 25 * MIN + SPRINT_GRACE_MS)).toEqual([])
    // Opened the next day.
    const closed = await closeOverdueSprints(world.id, T0 + 26 * 60 * MIN)
    expect(closed.map((c) => c.id)).toEqual([s.id])
    expect(await sprintRow(s.id)).toMatchObject({ endedAt: T0 + 25 * MIN, ended: 'closed', wordsAdded: 5 })
  })

  it('a paused sprint is not closed: it waits, paused, for the writer', async () => {
    const { world } = await seed()
    at(T0)
    const s = (await startSprint(world.id, 25))!
    at(T0 + 3 * MIN)
    await pauseSprint(s.id)
    expect(await closeOverdueSprints(world.id, T0 + 26 * 60 * MIN)).toEqual([])
    expect(await sprintRow(s.id)).toMatchObject({ endedAt: null, pausedAt: T0 + 3 * MIN })
  })
})

describe('the streak, through the log (D-2)', () => {
  it('a day that only cut 800 words keeps the streak; a day of nothing breaks it', async () => {
    const { world, a } = await seed()
    const long = Array.from({ length: 900 }, (_, i) => `w${i}`).join(' ')
    const day = (d: number) => new Date(2026, 10, d, 10).getTime()
    at(day(21))
    await setSceneText(world.id, a, long)
    at(day(22))
    await setSceneText(world.id, a, long.split(' ').slice(0, 100).join(' ')) // cut 800
    const logs = () => db.writingLogs.where('worldId').equals(world.id).toArray()
    expect((await logs()).find((l) => l.date === localDayKey(day(22)))).toMatchObject({ words: -800, added: 0, cut: 800 })
    expect(computeStreak(await logs(), localDayKey(day(22)))).toBe(2)
    // Nothing on the 23rd, and on the 24th the run is broken.
    expect(computeStreak(await logs(), localDayKey(day(24)))).toBe(0)
  })
})

describe('sprints in the file (D-3)', () => {
  it('finished sprints travel; one still open stays on its device, and is kept there through an import', async () => {
    const { world, a } = await seed()
    at(T0)
    const done = (await startSprint(world.id, 25))!
    await setSceneText(world.id, a, 'Four words of prose.')
    at(T0 + 9 * MIN)
    await stopSprint(done.id)
    at(T0 + 10 * MIN)
    const open = (await startSprint(world.id, 15))!

    const collected = await collectWorldData(world.id)
    expect(collected.sprints.map((s) => s.id)).toEqual([done.id])
    const json = JSON.stringify({ version: 2, exportedAt: Date.now(), ...collected, blobs: [] })
    // Brought in over itself, as a restore from a backup.
    await importWorldFromJson(json)
    expect((await db.sprints.toArray()).map((s) => s.id).sort()).toEqual([done.id, open.id].sort())

    await db.delete(); await db.open()
    await importWorldFromJson(json)
    const rows = await db.sprints.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: done.id, wordsAdded: 4, ended: 'stopped' })
  })

  it('merge: a sprint from the other device arrives beside this one’s, and the one open here stays open', async () => {
    const { world } = await seed()
    at(T0)
    const here = (await startSprint(world.id, 25))!
    at(T0 + 25 * MIN + 5_000)
    await finishSprint(here.id, 'done')
    const theirs = JSON.parse(await serializeWorldForSync(world.id))
    theirs.sprints.push({ ...theirs.sprints[0], id: 'from-there', startedAt: T0 + 60 * MIN, endedAt: T0 + 75 * MIN, wordsAdded: 300 })
    at(T0 + 80 * MIN)
    const open = (await startSprint(world.id, 15))!

    await applyWorldImport((await previewWorldMerge(JSON.stringify(theirs))).parsed, 'merge')
    const rows = await db.sprints.where('worldId').equals(world.id).toArray()
    expect(rows.map((r) => r.id).sort()).toEqual([here.id, open.id, 'from-there'].sort())
    expect(rows.find((r) => r.id === open.id)).toMatchObject({ endedAt: null })
  })

  it('a world deleted takes its sprints with it', async () => {
    const { world } = await seed()
    at(T0)
    await startSprint(world.id, 25)
    await deleteWorld(world.id)
    expect(await db.sprints.count()).toBe(0)
  })
})
