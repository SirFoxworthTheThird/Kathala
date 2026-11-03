import { describe, it, expect } from 'vitest'
import { storyOf, lastKnown, lastKnownOne, lastKnownRecords, carriedFrom, outOfEra, inEras, type StoryScene } from '@/lib/stateEngine'
import { computeSortKeySync } from '@/lib/sortKey'

/*
  The rule the engine replaced (snapshotUtils.selectBestSnapshots, before Part
  1b), kept here as the reference a one-timeline book must still agree with.
*/
function selectBestSnapshots<T extends { eventId: string; sortKey?: number | null; updatedAt: number }>(
  all: T[], cursor: string | null,
  events: Array<{ id: string; chapterId: string; sortOrder: number }>, chapters: Array<{ id: string; number: number }>,
  entityOf: (r: T) => string,
): T[] {
  const byEntity = new Map<string, T>()
  if (!cursor) {
    for (const r of all) { const c = byEntity.get(entityOf(r)); if (!c || r.updatedAt > c.updatedAt) byEntity.set(entityOf(r), r) }
    return [...byEntity.values()]
  }
  const eventById = new Map(events.map((e) => [e.id, e]))
  const numbers = new Map(chapters.map((c) => [c.id, c.number]))
  const orderOf = (r: T) => { const at = computeSortKeySync(r.eventId, eventById, numbers); return at === -1 ? r.sortKey ?? -1 : at }
  const here = computeSortKeySync(cursor, eventById, numbers)
  if (here === -1) return all.filter((r) => r.eventId === cursor)
  for (const r of all) {
    const at = orderOf(r)
    if (at === -1 || at > here) continue
    const c = byEntity.get(entityOf(r))
    if (!c || r.eventId === cursor || (c.eventId !== cursor && at > orderOf(c))) byEntity.set(entityOf(r), r)
  }
  return [...byEntity.values()]
}

type Rec = { id: string; who: string; eventId: string; updatedAt: number; sortKey?: number | null }
const rec = (id: string, who: string, eventId: string, updatedAt = 1): Rec => ({ id, who, eventId, updatedAt })
const byWho = (r: Rec) => r.who

/*
  Three eras braided, as run 10 was: Mercy (days 0–2), Compact (1000–1002),
  Quiet (5000–5002), one chapter each in turn — Mercy 1, Compact 2, Quiet 3,
  Mercy 4, Compact 5, Quiet 6.
*/
const timelines = [{ id: 'mercy', dayOffset: 0 }, { id: 'compact', dayOffset: 1000 }, { id: 'quiet', dayOffset: 5000 }]
const order = ['mercy', 'compact', 'quiet', 'mercy', 'compact', 'quiet']
const chapters = order.map((_, i) => ({ id: `c${i + 1}`, number: i + 1 }))
const scenes: StoryScene[] = order.map((timelineId, i) => ({
  id: `s${i + 1}`, chapterId: `c${i + 1}`, sortOrder: 0, timelineId, travelDays: i < 3 ? 0 : 2, inWorldTime: null, isFlashback: false,
}))
const eras = storyOf(scenes, chapters, timelines)

describe('the story: positions, days and eras', () => {
  it('places scenes in the book and on the world clock', () => {
    expect(eras.position('s4')).toBe(4)
    expect(eras.position('nope')).toBe(-1)
    expect(eras.dayOf('s2')).toBe(1000)
    expect(eras.dayOf('s5')).toBe(1002)
    expect(eras.timelineOf('s6')).toBe('quiet')
    expect(eras.spans.get('quiet')).toEqual({ first: 5000, last: 5002, undated: false })
  })

  it('counts timelines as one era only where their spans overlap', () => {
    expect(eras.sameEra('mercy', 'mercy')).toBe(true)
    expect(eras.sameEra('mercy', 'compact')).toBe(false)
    expect(eras.sameEra('compact', 'quiet')).toBe(false)
    const parallel = storyOf(scenes, chapters, [{ id: 'mercy', dayOffset: 0 }, { id: 'compact', dayOffset: 1 }, { id: 'quiet', dayOffset: 5000 }])
    expect(parallel.sameEra('mercy', 'compact')).toBe(true)
    expect(parallel.sameEra('mercy', 'quiet')).toBe(false)
  })

  it('takes a timeline nothing dates as sharing people with every other', () => {
    const undatedFrame = storyOf(
      scenes.map((s) => (s.timelineId === 'quiet' ? { ...s, travelDays: null } : s)),
      chapters,
      [{ id: 'mercy', dayOffset: 0 }, { id: 'compact', dayOffset: 1000 }, { id: 'quiet' }],
    )
    expect(undatedFrame.spans.get('quiet')?.undated).toBe(true)
    expect(undatedFrame.sameEra('quiet', 'compact')).toBe(true)
    expect(undatedFrame.sameEra('quiet', 'mercy')).toBe(true)
    // It joins nobody else together: the dated two are still apart.
    expect(undatedFrame.sameEra('mercy', 'compact')).toBe(false)
    // A pinned date is a date.
    const pinned = storyOf(
      scenes.map((s) => (s.id === 's6' ? { ...s, travelDays: null, inWorldTime: 3 } : s.timelineId === 'quiet' ? { ...s, travelDays: null } : s)),
      chapters,
      [{ id: 'mercy', dayOffset: 0 }, { id: 'compact', dayOffset: 1000 }, { id: 'quiet' }],
    )
    expect(pinned.spans.get('quiet')?.undated).toBe(false)
  })
})

describe('people stay in their era', () => {
  it('does not carry a person into an era they have no record in', () => {
    // Isidor is recorded in the Compact (ch 2); at the Quiet's ch 3 he is not in this era.
    const records = [rec('a', 'isidor', 's2'), rec('b', 'osh', 's3')]
    const at3 = lastKnown(records, 's3', eras, 'person', byWho)
    expect([...at3.keys()]).toEqual(['osh'])
    // In his own era, two chapters on, he still is where he was.
    expect(lastKnown(records, 's5', eras, 'person', byWho).get('isidor')?.record.id).toBe('a')
  })

  it('reads a person across overlapping timelines in book order, as before eras', () => {
    const parallel = storyOf(scenes, chapters, [{ id: 'mercy', dayOffset: 0 }, { id: 'compact', dayOffset: 1 }, { id: 'quiet', dayOffset: 5000 }])
    const records = [rec('a', 'neve', 's1'), rec('b', 'neve', 's2')]
    expect(lastKnown(records, 's4', parallel, 'person', byWho).get('neve')).toEqual({ record: records[1], carriedFrom: null })
  })

  it('prefers the record at the cursor, and reads nothing after it', () => {
    const records = [rec('a', 'kit', 's3'), rec('b', 'kit', 's6')]
    expect(lastKnownOne(records, 's3', eras, 'person')?.record.id).toBe('a')
    expect(lastKnownOne(records, 's6', eras, 'person')?.record.id).toBe('b')
    expect(lastKnownOne([records[1]], 's3', eras, 'person')).toBeUndefined()
  })
})

describe('things cross eras by in-world time, and say so', () => {
  it('carries an item from an earlier era when its own has nothing yet', () => {
    // The Torque Key: Mercy ch 1, then nothing until the Quiet.
    const records = [rec('m', 'key', 's1')]
    const atQuiet = lastKnown(records, 's3', eras, 'thing', byWho).get('key')
    expect(atQuiet).toEqual({ record: records[0], carriedFrom: 'mercy' })
    // The same record, read as a person's, is not carried.
    expect(lastKnown(records, 's3', eras, 'person', byWho).has('key')).toBe(false)
  })

  it('takes its own era first, and otherwise the latest earlier era by in-world time, not by book order', () => {
    // Compact (day 1000) is read in ch 2, Mercy (day 2) in ch 4: in book order Mercy is later, in time Compact is.
    const records = [rec('c', 'key', 's2'), rec('m', 'key', 's4')]
    expect(lastKnown(records, 's6', eras, 'thing', byWho).get('key')).toEqual({ record: records[0], carriedFrom: 'compact' })
    const withOwn = [...records, rec('q', 'key', 's3')]
    expect(lastKnown(withOwn, 's6', eras, 'thing', byWho).get('key')).toEqual({ record: withOwn[2], carriedFrom: null })
  })

  it('never carries from a later era, or from a chapter the book has not reached', () => {
    // A Quiet record (day 5000) at the Compact's ch 5 (day 1002): later in time.
    expect(lastKnown([rec('q', 'key', 's3')], 's5', eras, 'thing', byWho).has('key')).toBe(false)
    // A Mercy record in ch 4 (day 2), at the Quiet's ch 3 (day 5000): earlier in time, later in the book.
    expect(lastKnown([rec('m', 'key', 's4')], 's3', eras, 'thing', byWho).has('key')).toBe(false)
    // …and once the book has reached it, it carries.
    expect(lastKnown([rec('m', 'key', 's4')], 's6', eras, 'thing', byWho).get('key')?.carriedFrom).toBe('mercy')
  })
})

describe('the edges the old rule had', () => {
  it('with no cursor, the most recently updated record per entity', () => {
    const records = [rec('a', 'x', 's1', 5), rec('b', 'x', 's6', 2), rec('c', 'y', 's2', 1)]
    expect(lastKnownRecords(records, null, eras, 'person', byWho).map((r) => r.id).sort()).toEqual(['a', 'c'])
    expect(lastKnownOne(records, null, eras, 'person')).toBeUndefined()
  })

  it('with a cursor that is not a scene, only records at it', () => {
    const records = [rec('a', 'x', 'ghost'), rec('b', 'x', 's1')]
    expect(lastKnownRecords(records, 'ghost', eras, 'person', byWho).map((r) => r.id)).toEqual(['a'])
  })

  it('places a record whose scene is gone by its stored key', () => {
    const orphan = { ...rec('o', 'x', 'gone'), sortKey: 2.5 }
    expect(lastKnownOne([orphan], 's3', eras, 'person')?.record.id).toBe('o')
    expect(lastKnownOne([orphan], 's2', eras, 'person')).toBeUndefined()
  })

  it('in one timeline, agrees with the rule it replaces on every scene', () => {
    const one: StoryScene[] = Array.from({ length: 12 }, (_, i) => ({
      id: `e${i}`, chapterId: `k${i % 4}`, sortOrder: (i * 7) % 5, timelineId: 't', travelDays: i % 3, inWorldTime: null, isFlashback: false,
    }))
    const ks = [0, 1, 2, 3].map((n) => ({ id: `k${n}`, number: n + 1 }))
    const story = storyOf(one, ks, [{ id: 't' }])
    const records: Rec[] = []
    for (let i = 0; i < 30; i++) records.push(rec(`r${i}`, `p${i % 4}`, `e${(i * 5) % 12}`, i))
    for (const cursor of [null, ...one.map((s) => s.id)]) {
      for (const rule of ['person', 'thing'] as const) {
        const now = lastKnownRecords(records, cursor, story, rule, byWho).map((r) => r.id).sort()
        const before = selectBestSnapshots(records, cursor, one, ks, byWho).map((r) => r.id).sort()
        expect(now, `at ${cursor}`).toEqual(before)
      }
    }
  })
})

describe('eras as groups, and saying where a thing was carried from', () => {
  it('gives each era its own key, and a frame nobody dated joins them all', () => {
    expect(new Set(scenes.map((s) => eras.eraOf(s.id))).size).toBe(3)
    expect(eras.eraOf('s1')).toBe(eras.eraOf('s4'))
    expect(eras.eraOf('nope')).toBeNull()
    const framed = storyOf(
      scenes.map((s) => (s.timelineId === 'quiet' ? { ...s, travelDays: null } : s)),
      chapters,
      [{ id: 'mercy', dayOffset: 0 }, { id: 'compact', dayOffset: 1000 }, { id: 'quiet' }],
    )
    expect(new Set(scenes.map((s) => framed.eraOf(s.id))).size).toBe(1)
  })

  it('names the timeline a record came from only when it is another era’s', () => {
    expect(carriedFrom({ eventId: 's1' }, 's3', eras)).toBe('mercy')
    expect(carriedFrom({ eventId: 's1' }, 's4', eras)).toBeNull()
    expect(carriedFrom({ eventId: 's1' }, null, eras)).toBeNull()
  })
})

describe('who is not of this era', () => {
  it('names the people whose records are all in other eras', () => {
    const records = [rec('a', 'isidor', 's2'), rec('b', 'osh', 's3'), rec('c', 'neve', 's2'), rec('d', 'neve', 's6')]
    // At the Quiet's ch 3: Isidor has only Compact records; Neve has one in the Quiet (ch 6), later but of this era.
    expect([...outOfEra(records, 's3', eras, byWho)]).toEqual(['isidor'])
    // In the Compact, Osh is the one from elsewhere.
    expect([...outOfEra(records, 's5', eras, byWho)]).toEqual(['osh'])
    expect(outOfEra(records, null, eras, byWho).size).toBe(0)
    expect(outOfEra(records, 'nope', eras, byWho).size).toBe(0)
  })
})

describe('whether a book is in eras', () => {
  it('is when two of its timelines never meet, and is not when they all do', () => {
    expect(inEras(eras, ['mercy', 'compact', 'quiet'])).toBe(true)
    const parallel = storyOf(scenes, chapters, [{ id: 'mercy', dayOffset: 0 }, { id: 'compact', dayOffset: 1 }, { id: 'quiet', dayOffset: 2 }])
    expect(inEras(parallel, ['mercy', 'compact', 'quiet'])).toBe(false)
    expect(inEras(eras, ['mercy'])).toBe(false)
    expect(inEras(eras, [])).toBe(false)
  })
})
