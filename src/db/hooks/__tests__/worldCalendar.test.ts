import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld, updateWorld, updateWorldCalendar } from '@/db/hooks/useWorlds'
import { defaultCalendar } from '@/lib/calendar'
import type { WorldCalendar } from '@/types'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function worldWithCalendar() {
  const world = await createWorld({ name: 'Highbarrow', description: '' })
  await updateWorld(world.id, { calendar: defaultCalendar() })
  return world.id
}

const storedCalendar = async (id: string): Promise<WorldCalendar> =>
  (await db.worlds.get(id))!.calendar!

/**
 * HB-3a. The calendar is a nested object on `worlds`, so every field that edits
 * it writes the whole thing — and `CalendarEditor` built the new value by
 * spreading the calendar it had last *rendered*. A write to one field therefore
 * carried whatever the other fields looked like at that render, and two edits
 * landing inside each other's live-query round-trip lost one of them.
 *
 * HB-3 reported that shape as *"the start year silently reverts"*. Its stated
 * mechanism was wrong and driving the sequence did not reproduce it, so this is
 * filed on the code rather than on a symptom — which is exactly why it needs a
 * test that fails on the old shape rather than a repro that never fired.
 */
describe('updateWorldCalendar', () => {
  it('hands the mutator the calendar as stored, not one the caller held', async () => {
    const id = await worldWithCalendar()

    // What a component holds: the calendar as of its last render.
    const rendered = await storedCalendar(id)

    // Something else writes in between — another field, another tab, a live
    // query that has not come back yet.
    await updateWorldCalendar(id, (c) => ({ ...c, yearSuffix: 'HB' }))

    // The mutator sees the suffix, even though `rendered` does not.
    expect(rendered.yearSuffix ?? '').toBe('')
    let seen: WorldCalendar | null = null
    await updateWorldCalendar(id, (c) => { seen = c; return { ...c, startYear: 742 } })
    expect(seen!.yearSuffix).toBe('HB')

    const after = await storedCalendar(id)
    expect(after.startYear).toBe(742)
    expect(after.yearSuffix, 'the other field must survive').toBe('HB')
  })

  it('keeps both of two edits made back to back', async () => {
    const id = await worldWithCalendar()

    await updateWorldCalendar(id, (c) => ({ ...c, startYear: 742 }))
    await updateWorldCalendar(id, (c) => ({ ...c, yearSuffix: 'HB' }))

    const after = await storedCalendar(id)
    expect(after).toMatchObject({ startYear: 742, yearSuffix: 'HB' })
  })

  it('keeps both when the two are issued concurrently', async () => {
    const id = await worldWithCalendar()

    // Not awaited in turn: this is the interleaving the finding describes, and
    // the one a writer produces by typing in one field and then the next.
    await Promise.all([
      updateWorldCalendar(id, (c) => ({ ...c, startYear: 742 })),
      updateWorldCalendar(id, (c) => ({ ...c, yearSuffix: 'HB' })),
    ])

    const after = await storedCalendar(id)
    expect(after.startYear).toBe(742)
    expect(after.yearSuffix).toBe('HB')
  })

  it('protects the months too, which the finding never mentioned', async () => {
    const id = await worldWithCalendar()
    const before = await storedCalendar(id)

    await Promise.all([
      updateWorldCalendar(id, (c) => ({
        ...c,
        months: c.months.map((m, i) => (i === 0 ? { ...m, name: 'Afteryule' } : m)),
      })),
      updateWorldCalendar(id, (c) => ({
        ...c,
        months: c.months.map((m, i) => (i === 1 ? { ...m, days: 44 } : m)),
      })),
    ])

    const after = await storedCalendar(id)
    expect(after.months[0].name).toBe('Afteryule')
    expect(after.months[1].days).toBe(44)
    expect(after.months, 'no month should have been dropped').toHaveLength(before.months.length)
  })

  it('does nothing when the world has no calendar to edit part of', async () => {
    const world = await createWorld({ name: 'No calendar', description: '' })
    let called = false
    await updateWorldCalendar(world.id, (c) => { called = true; return c })

    expect(called, 'there is no stored calendar to hand the mutator').toBe(false)
    expect((await db.worlds.get(world.id))!.calendar ?? null).toBeNull()
  })

  it('does nothing for a world id that does not exist', async () => {
    await expect(updateWorldCalendar('nope', (c) => c)).resolves.toBeUndefined()
  })

  it('stamps updatedAt, so a change is visible to anything watching the record', async () => {
    const id = await worldWithCalendar()
    await db.worlds.update(id, { updatedAt: 0 })

    await updateWorldCalendar(id, (c) => ({ ...c, startYear: 5 }))
    expect((await db.worlds.get(id))!.updatedAt).toBeGreaterThan(0)
  })
})
