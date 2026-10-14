import { describe, it, expect } from 'vitest'
import { formatWhen, readWhen, planWhen, sceneTimeOf, type SceneTime } from '@/lib/sceneTime'
import { dateToDayNumber, earthWeek } from '@/lib/calendar'
import { formatSceneHeader, parseSceneHeader, planHeader, splitSceneHeader } from '@/lib/sceneHeader'
import type { Chapter, WorldCalendar, WorldEvent } from '@/types'

/**
 * The `When:` line (docs/records/scene-time-plan.md): a scene's days since the
 * previous one, or its pin, said in the book's own calendar.
 */

const EARTH: WorldCalendar = {
  startYear: 2025,
  yearSuffix: '',
  months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    .map((name, i) => ({ name, days: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][i] })),
  week: earthWeek(2025),
}

/** Shire Reckoning: twelve months of thirty, five days outside them, and a week those days are not in. */
const SHIRE: WorldCalendar = {
  startYear: 1418,
  yearSuffix: '',
  months: [
    { name: '2 Yule', days: 1, intercalary: true },
    ...['Afteryule', 'Solmath', 'Rethe', 'Astron', 'Thrimidge', 'Forelithe'].map((name) => ({ name, days: 30 })),
    { name: '1 Lithe', days: 1, intercalary: true },
    { name: "Midyear's Day", days: 1, intercalary: true },
    { name: '2 Lithe', days: 1, intercalary: true },
    ...['Afterlithe', 'Wedmath', 'Halimath', 'Winterfilth', 'Blotmath', 'Foreyule'].map((name) => ({ name, days: 30 })),
    { name: '1 Yule', days: 1, intercalary: true },
  ],
  week: { days: ['Sterday', 'Sunday', 'Monday', 'Trewsday', 'Hevensday', 'Mersday', 'Highday'], first: 0 },
}

// Run 9's book: an Earth calendar, its timeline starting on 8 October 2025 (day 280).
const OCT8 = dateToDayNumber(EARTH, { year: 2025, month: 9, day: 8 })
const run9 = (over: Partial<SceneTime> = {}): SceneTime => ({ travelDays: null, inWorldTime: null, calendar: EARTH, offset: OCT8, previousDay: OCT8, ...over })

describe('drawing the When: line', () => {
  it('a pin is its date, counted from the timeline’s start; with no calendar, its day', () => {
    expect(OCT8).toBe(280)
    expect(formatWhen(run9({ inWorldTime: 8 }))).toBe('16 October, 2025')
    expect(formatWhen({ travelDays: null, inWorldTime: 8, calendar: null, offset: 280 })).toBe('day 288')
  })

  it('days since, “same day” for none, and nothing for a scene with neither', () => {
    expect(formatWhen(run9({ travelDays: 3 }))).toBe('+3 days')
    expect(formatWhen(run9({ travelDays: 1 }))).toBe('+1 day')
    expect(formatWhen(run9({ travelDays: 0 }))).toBe('same day')
    expect(formatWhen(run9())).toBeUndefined()
    // The pin is what the clock uses: drawn over the days since.
    expect(formatWhen(run9({ travelDays: 3, inWorldTime: 8 }))).toBe('16 October, 2025')
  })
})

describe('reading the When: line', () => {
  const read = (text: string, over: Partial<SceneTime> = {}) => readWhen(text, run9(over))

  it('days since, in its spellings', () => {
    expect(read('+3 days')).toEqual({ days: 3 })
    expect(read('+1 day')).toEqual({ days: 1 })
    expect(read('+3d')).toEqual({ days: 3 })
    expect(read('same day')).toEqual({ days: 0 })
    expect(read('Same Day')).toEqual({ days: 0 })
  })

  it('weeks are the book’s own: seven on Earth, ten in a ten-day week, seven with no calendar', () => {
    expect(read('+2 weeks')).toEqual({ days: 14 })
    expect(read('+1 week', { calendar: { ...EARTH, week: { days: Array.from({ length: 10 }, (_, i) => `D${i}`), first: 0 } } })).toEqual({ days: 10 })
    expect(read('+2w', { calendar: null })).toEqual({ days: 14 })
  })

  it('a day of the clock, with or without a calendar', () => {
    expect(read('day 412')).toEqual({ day: 412, exact: true })
    expect(read('day 10.25', { calendar: null })).toEqual({ day: 10.25, exact: true })
  })

  it('a date both ways round, with its weekday checked', () => {
    expect(read('16 October 2025')).toEqual({ day: 288, exact: false })
    expect(read('16 October, 2025')).toEqual({ day: 288, exact: false })
    expect(read('October 16, 2025')).toEqual({ day: 288, exact: false })
    expect(read('october 16 2025')).toEqual({ day: 288, exact: false })
    expect(read('Thursday 16 October 2025')).toEqual({ day: 288, exact: false })
    expect(read('Monday 16 October 2025')).toEqual({ error: '16 October, 2025 is a Thursday, not a Monday.' })
  })

  it('no year: the first such date on or after the scene before', () => {
    // From 8 October: 16 October is this year's, 3 January next year's.
    expect(read('16 October')).toEqual({ day: 288, exact: false })
    expect(read('3 January')).toEqual({ day: dateToDayNumber(EARTH, { year: 2026, month: 0, day: 3 }), exact: false })
    // The same day as the scene before is on or after it.
    expect(read('8 October')).toEqual({ day: 280, exact: false })
  })

  it('Shire Reckoning: its months, a day outside them by name, and its week, which those days are not in', () => {
    const shire = (text: string) => readWhen(text, { calendar: SHIRE, previousDay: 0 })
    const halimath23 = dateToDayNumber(SHIRE, { year: 1418, month: 12, day: 23 })
    expect(shire('23 Halimath 1418')).toEqual({ day: halimath23, exact: false })
    expect(shire("Midyear's Day 1418")).toEqual({ day: dateToDayNumber(SHIRE, { year: 1418, month: 8, day: 1 }), exact: false })
    expect(shire('2 Lithe 1418')).toEqual({ day: dateToDayNumber(SHIRE, { year: 1418, month: 9, day: 1 }), exact: false })
    // 1 Afteryule is a Sterday: the year's first day, 2 Yule, is outside the week.
    expect(shire('Sterday 1 Afteryule 1418')).toEqual({ day: 1, exact: false })
    expect(shire("Sterday Midyear's Day 1418")).toEqual({ error: "Midyear's Day, 1418 is outside the week, so it has no weekday." })
    // September is Earth's.
    expect(shire('23 September 1418')).toMatchObject({ error: expect.stringContaining('is not a date on this book’s calendar') })
  })

  it('a month whose name ends another’s is not found inside it', () => {
    const fall: WorldCalendar = { startYear: 1200, yearSuffix: '', months: [{ name: 'Fall', days: 30 }, { name: 'Leaf Fall', days: 30 }] }
    expect(readWhen('3 Leaf Fall 1200', { calendar: fall, previousDay: 0 })).toEqual({ day: 32, exact: false })
    expect(readWhen('3 Fall 1200', { calendar: fall, previousDay: 0 })).toEqual({ day: 2, exact: false })
  })

  it('a year’s suffix, even one that is an editorial note', () => {
    const noted = { ...EARTH, yearSuffix: ' (editorial chronology)' }
    expect(readWhen('16 October, 2025 (editorial chronology)', { calendar: noted, previousDay: 0 })).toEqual({ day: 288, exact: false })
    expect(readWhen('16 October, 2025', { calendar: noted, previousDay: 0 })).toEqual({ day: 288, exact: false })
  })

  it('says what it cannot read', () => {
    expect(read('32 October 2025')).toEqual({ error: 'October has 31 days, so “32 October 2025” is not a date in it.' })
    expect(read('Octobre 16 2025')).toMatchObject({ error: '“Octobre 16 2025” is not a date on this book’s calendar. Write it as “8 October, 2025”, or as “+3 days”.' })
    expect(read('October 2025')).toMatchObject({ error: expect.stringContaining('Which day of October?') })
    expect(read('three days later')).toMatchObject({ error: expect.any(String) })
    expect(read('16 October 2025', { calendar: null })).toMatchObject({ error: expect.stringContaining('It has no calendar') })
  })
})

describe('what the When: line writes', () => {
  it('drawn again, nothing; the same date in other words, nothing either', () => {
    expect(planWhen('+3 days', run9({ travelDays: 3 }))).toEqual({ update: null })
    expect(planWhen('16 October, 2025', run9({ inWorldTime: 8 }))).toEqual({ update: null })
    expect(planWhen('Thursday October 16 2025', run9({ inWorldTime: 8 }))).toEqual({ update: null })
  })

  it('a date pins the scene, counted from the timeline’s start, and leaves the days since', () => {
    expect(planWhen('16 October 2025', run9({ travelDays: 3 }))).toEqual({ update: { inWorldTime: 8 } })
  })

  it('days since over a date take the pin off', () => {
    expect(planWhen('+3 days', run9({ travelDays: 3, inWorldTime: 8 }))).toEqual({ update: { inWorldTime: null } })
    expect(planWhen('+2 days', run9({ inWorldTime: 8 }))).toEqual({ update: { travelDays: 2, inWorldTime: null } })
  })

  it('no line takes back what it drew: the pin, else the days since', () => {
    expect(planWhen(undefined, run9({ travelDays: 3, inWorldTime: 8 }))).toEqual({ update: { inWorldTime: null } })
    expect(planWhen('', run9({ travelDays: 3 }))).toEqual({ update: { travelDays: null } })
    expect(planWhen(undefined, run9())).toEqual({ update: null })
  })

  it('a date keeps the time of day the pin had; a day typed with one is taken as typed', () => {
    expect(planWhen('17 October 2025', run9({ inWorldTime: 8.25 }))).toEqual({ update: { inWorldTime: 9.25 } })
    expect(planWhen('day 300.5', run9({ inWorldTime: 8.25 }))).toEqual({ update: { inWorldTime: 20.5 } })
  })

  it('what cannot be read writes nothing, and says so', () => {
    expect(planWhen('Monday 16 October 2025', run9({ travelDays: 3 }))).toEqual({ update: null, refused: '16 October, 2025 is a Thursday, not a Monday.' })
  })
})

describe('where a scene sits, for its When: line', () => {
  const chapter = (id: string, number: number): Chapter => ({ id, worldId: 'w', timelineId: 't', number, title: '', synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 })
  const event = (id: string, chapterId: string, sortOrder: number, opts: Partial<WorldEvent> = {}): WorldEvent => ({
    id, worldId: 'w', chapterId, timelineId: 't', title: id, description: '', locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
    tags: [], threadIds: [], sortOrder, travelDays: null, inWorldTime: null, tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false, createdAt: 0, updatedAt: 0, ...opts,
  })
  const chapters = [chapter('c1', 1), chapter('c2', 2)]
  const events = [
    event('a', 'c1', 0),
    event('b', 'c1', 1, { travelDays: 3 }),
    event('back', 'c2', 0, { isFlashback: true, inWorldTime: -100 }),
    event('c', 'c2', 1, { travelDays: 2 }),
  ]
  const at = (e: WorldEvent) => sceneTimeOf(e, { events, chapters, timeline: { id: 't', dayOffset: 280 }, calendar: EARTH })

  it('the first scene counts from the timeline’s start; a later one from the scene before, passing over a flashback', () => {
    expect(at(events[0]).previousDay).toBe(280)
    expect(at(events[1]).previousDay).toBe(280)
    expect(at(events[3])).toEqual({ travelDays: 2, inWorldTime: null, calendar: EARTH, offset: 280, previousDay: 283 })
  })
})

describe('the When: line in the header', () => {
  it('is drawn after the cast, read back, and read only in a block', () => {
    const header = { place: 'Bag End', characters: ['Frodo Baggins'], when: '23 Halimath 1418' }
    const drawn = formatSceneHeader(header)
    expect(drawn).toBe('[\n  Place: #Bag End\n  Characters: @@Frodo Baggins\n  When: 23 Halimath 1418\n]')
    expect(parseSceneHeader(drawn)).toEqual(header)
    // The one-line form has no labels, so nothing in it is a When: line.
    expect(parseSceneHeader('[When: +3 days]').when).toBeUndefined()
    expect(parseSceneHeader('[\nWhen: +3 days\n]').when).toBe('+3 days')
  })

  it('is read by its label, not its sigils: `day #4` is not a place', () => {
    expect(parseSceneHeader('[\n  Characters: @@Frodo Baggins\n  When: day #4\n]')).toEqual({ place: null, characters: ['Frodo Baggins'], when: 'day #4' })
  })

  it('alone in a block, a time is a header; a question is a margin note, and prose', () => {
    expect(splitSceneHeader('[\n  When: +3 days\n]\nRain.').header).toBe('[\n  When: +3 days\n]')
    expect(splitSceneHeader('[\n  When: does the assize sit?\n]\nRain.').header).toBeNull()
    // Beside a name it is a header's line whatever it says, and planWhen says what is wrong with it.
    expect(splitSceneHeader('[\n  Characters: @@Frodo\n  When: Midyear’s Day\n]\nRain.').header).not.toBeNull()
  })

  it('planHeader writes what it says, and refuses what it cannot read, beside the rest of the line', () => {
    const world = { characters: [{ id: 'nell', name: 'Nell Ashdown' }], places: [] }
    const scene = { involved: ['nell'], mentioned: [], place: null, time: run9({ travelDays: 1 }) }
    expect(planHeader('[\n  Characters: @@Nell Ashdown\n  When: 16 October 2025\n]', world, scene).time).toEqual({ inWorldTime: 8 })
    const wrong = planHeader('[\n  Characters: @@Nell Ashdown\n  When: Monday 16 October 2025\n]', world, scene)
    expect([wrong.time, wrong.unknown.refused]).toEqual([null, ['16 October, 2025 is a Thursday, not a Monday.']])
    // Without the scene's time, the line is not read: nothing to say what a date means there.
    expect(planHeader('[\n  Characters: @@Nell Ashdown\n  When: 16 October 2025\n]', world, { ...scene, time: undefined }).time).toBeNull()
  })
})

describe('the When: line, in a calendar with eras', () => {
  const months = [{ name: 'Harvest', days: 30 }, { name: 'Frost', days: 30 }]
  // The story begins in 19 BBY.
  const STAR_WARS: WorldCalendar = { startYear: -19, yearSuffix: '', months, eras: [{ label: 'BBY', counts: 'down', first: 1 }, { label: 'ABY', start: 0, counts: 'up', first: 0 }] }
  const BC_AD: WorldCalendar = { startYear: 2025, yearSuffix: 'AD', months, eras: [{ label: 'BC', counts: 'down', first: 1 }, { label: 'AD', start: 1, counts: 'up', first: 1 }] }
  const read = (text: string, cal = STAR_WARS) => readWhen(text, { calendar: cal, previousDay: 0 })

  it('a year with its era, and a year without one in the era the story is in', () => {
    const day4 = dateToDayNumber(STAR_WARS, { year: -19, month: 0, day: 4 })
    expect(read('4 Harvest 19 BBY')).toEqual({ day: day4, exact: false })
    expect(read('Harvest 4, 19 bby')).toEqual({ day: day4, exact: false })
    expect(read('4 Harvest 19')).toEqual({ day: day4, exact: false })
    expect(read('4 Harvest 0 ABY')).toEqual({ day: dateToDayNumber(STAR_WARS, { year: 0, month: 0, day: 4 }), exact: false })
  })

  it('the era’s label, not an old suffix that is the same word', () => {
    // A suffix of "BC" left from before the eras: taken off first, "1 BC" would be 1 of the era the story is in, AD.
    const leftover = { ...BC_AD, yearSuffix: 'BC' }
    expect(read('1 Harvest 1 BC', leftover)).toEqual({ day: dateToDayNumber(BC_AD, { year: 0, month: 0, day: 1 }), exact: false })
    expect(read('1 Harvest 2025 AD', BC_AD)).toEqual({ day: 0, exact: false })
  })

  it('a year with no era is in the era of the scene before, whichever that is', () => {
    // The story is in 2025 AD, the second era: 2026 is 2026 AD, not 2026 BC.
    expect(read('1 Harvest 2026', BC_AD)).toEqual({ day: dateToDayNumber(BC_AD, { year: 2026, month: 0, day: 1 }), exact: false })
  })

  it('says what is wrong with a year its era has not got, or an era with no year', () => {
    expect(read('1 Harvest 0 BC', BC_AD)).toEqual({ error: 'There is no year 0 BC on this book’s calendar.' })
    expect(read('4 Harvest BBY')).toEqual({ error: 'Which year BBY? Write it as “1 Harvest, 19 BBY”.' })
  })

  it('is drawn in the era, and a date drawn so is read back to the same pin', () => {
    const t: SceneTime = { travelDays: null, inWorldTime: 3, calendar: STAR_WARS, offset: 0, previousDay: 0 }
    expect(formatWhen(t)).toBe('4 Harvest, 19 BBY')
    expect(planWhen('4 Harvest, 19 BBY', t)).toEqual({ update: null })
    expect(planWhen('4 Harvest, 18 BBY', t)).toEqual({ update: { inWorldTime: 63 } })
  })
})
