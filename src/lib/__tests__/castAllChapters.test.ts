import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { storyOf } from '@/lib/stateEngine'
import { selectBestCharacterSnapshots } from '@/db/hooks/useSnapshots'
import { castAliveSplit } from '@/lib/castAtCursor'

/*
  The dashboard's alive and dead with the cursor on All chapters
  (round-trip-plan-3.md, T13, S2). The second loop's writer saw "7 alive ·
  1 dead" there, in a book where two die; at the last scene it read 6 and 2.
  With no cursor the last record of each person was the one changed last, and
  the writer had touched Orrin Hask's record in chapter 5 after recording his
  death in chapter 6. The book, people and records are the run's own.
*/
const run = JSON.parse(readFileSync(path.join(__dirname, 'fixtures/docx/run-2026-11-12-loop2/people.json'), 'utf8'))
const story = storyOf(run.events, run.chapters, run.timelines, { pinsSetClock: run.world.pinsSetClock })
const nameOf = (id: string) => run.characters.find((c: { id: string }) => c.id === id)?.name

describe('alive and dead on All chapters', () => {
  it('the run’s book: at All chapters, as at its last scene, six alive and two dead', () => {
    const last = [...run.events].sort((a, b) => story.position(a.id) - story.position(b.id)).at(-1).id
    for (const cursor of [null, last]) {
      const best = selectBestCharacterSnapshots(run.characterSnapshots, cursor, story)
      expect(castAliveSplit(run.characters, best), `at ${cursor}`).toEqual({ alive: 6, dead: 2 })
      expect(best.filter((s) => !s.isAlive).map((s) => nameOf(s.characterId)).sort(), `at ${cursor}`).toEqual(['Idris Mallory', 'Orrin Hask'])
    }
  })

  it('the record changed last is not the last in the book: Orrin’s chapter 5 record was touched after his death', () => {
    const orrin = run.characters.find((c: { name: string }) => c.name === 'Orrin Hask').id
    const records = run.characterSnapshots.filter((s: { characterId: string }) => s.characterId === orrin)
    const lastChanged = records.reduce((a: { updatedAt: number }, b: { updatedAt: number }) => (b.updatedAt > a.updatedAt ? b : a))
    const death = records.find((r: { isAlive?: boolean }) => r.isAlive === false)
    // The case as it was: a record before the death, changed after it.
    expect(story.position(lastChanged.eventId)).toBeLessThan(story.position(death.eventId))
    const [state] = selectBestCharacterSnapshots(records, null, story)
    expect(state.isAlive).toBe(false)
    expect(state.eventId).toBe(death.eventId)
  })
})
