import { describe, it, expect } from 'vitest'
import { computeInWorldDays } from '@/lib/inWorldTime'
import { storyOf } from '@/lib/stateEngine'
import { sceneTimeOf } from '@/lib/sceneTime'
import { buildCalendarMonths } from '@/lib/calendarView'
import { dayNumberToDate } from '@/lib/calendar'
import type { Chapter, Timeline, World, WorldEvent } from '@/types'
import coldChoir from '../../../e2e/fixtures/cold-choir.pwk?raw'

/*
  One date per scene (run-10 plan, Part 4). Every "when is this scene"
  question is answered by `computeInWorldDays`: the timeline's start, `When:`
  pins, travel days, and the book's rule for pins, read on the calendar's eras
  and leap years by `calendar.ts`. Writer run 10 found the checker, the Brief
  and the calendar disagreeing (issue 5: the checker counted every timeline
  from day 0). They agree now; this holds them to it, on run 10's own book, and
  holds every caller to passing what the answer depends on.
*/

describe('one date per scene, whichever route asks', () => {
  const book = JSON.parse(coldChoir) as {
    world: World; events: WorldEvent[]; chapters: Chapter[]; timelines: Timeline[]
  }
  const rules = { pinsSetClock: book.world.pinsSetClock }
  const calendar = book.world.calendar!

  it('on The Cold Choir: the checker and Brief, the state engine, the When: line and the calendar', () => {
    // The checker's and the Brief's route.
    const days = computeInWorldDays(book.events, book.chapters, book.timelines, rules)
    const story = storyOf(book.events, book.chapters, book.timelines, rules)
    const placed = new Map<string, string>()
    for (const month of buildCalendarMonths({ events: book.events, chapters: book.chapters, calendar, timelines: book.timelines, rules })) {
      for (const [day, scenes] of month.eventsByDay) for (const s of scenes) placed.set(s.id, `${month.year}/${month.month}/${day}`)
    }
    const disagree: string[] = []
    for (const e of book.events) {
      const day = days.get(e.id)!
      const date = dayNumberToDate(calendar, day)
      // The When: line counts from the scene before it on its timeline, or is pinned.
      const t = sceneTimeOf(e, { events: book.events, chapters: book.chapters, timeline: book.timelines.find((tl) => tl.id === e.timelineId), calendar, rules })
      const when = e.inWorldTime != null ? t.offset + e.inWorldTime : e.isFlashback ? day : t.previousDay + (e.travelDays ?? 0)
      const answers = [story.dayOf(e.id), when]
      if (answers.some((a) => a !== day) || placed.get(e.id) !== `${date.year}/${date.month}/${date.day}`) {
        disagree.push(`${e.title}: ${day} / ${answers.join(' / ')} / ${placed.get(e.id)}`)
      }
    }
    expect(book.events).toHaveLength(44)
    expect(disagree).toEqual([])
    // Three eras, three centuries apart: what a route that dropped the timeline's start would get wrong.
    expect(new Set(book.timelines.map((t) => t.dayOffset)).size).toBe(3)
  })
})

/*
  The answer depends on each timeline's start and on the book's rule for pins,
  so a call that leaves either out gets a different date for the same scene —
  issue 5 was exactly that. Held at the call sites, since the function cannot
  tell a forgotten argument from a deliberate one.
*/
describe('every caller passes the timelines and the rules', () => {
  const sources = import.meta.glob(['../../**/*.ts', '../../**/*.tsx', '!../../**/__tests__/**'], {
    eager: true, query: '?raw', import: 'default',
  }) as Record<string, string>
  /*
    The pacing curve plots one timeline's scenes by the gaps between their
    days, which a timeline's start cannot change: it is in every day alike.
  */
  const exempt = new Set(['../../features/timeline/PacingCurve.tsx'])

  /** Each call's arguments, split at the top level. */
  function callsOf(text: string, name: string): string[][] {
    const out: string[][] = []
    let from = text.indexOf(`${name}(`)
    while (from >= 0) {
      let i = from + name.length + 1
      let depth = 0
      let arg = ''
      const args: string[] = []
      for (; i < text.length; i++) {
        const c = text[i]
        if (depth === 0 && c === ')') break
        if ('([{'.includes(c)) depth++
        if (')]}'.includes(c)) depth--
        if (depth === 0 && c === ',') { args.push(arg.trim()); arg = ''; continue }
        arg += c
      }
      if (arg.trim()) args.push(arg.trim())
      out.push(args)
      from = text.indexOf(`${name}(`, i)
    }
    return out
  }

  const missing = (args: string[]) => args.length < 4 || args[2] === 'undefined'

  it('finds the callers', () => {
    const callers = Object.entries(sources).filter(([f, t]) => !f.endsWith('/inWorldTime.ts') && t.includes('computeInWorldDays('))
    expect(callers.length).toBeGreaterThan(5)
  })

  it('to computeInWorldDays', () => {
    const offenders: string[] = []
    for (const [f, text] of Object.entries(sources)) {
      if (exempt.has(f) || f.endsWith('/inWorldTime.ts')) continue
      for (const args of callsOf(text, 'computeInWorldDays')) if (missing(args)) offenders.push(`${f}: (${args.join(', ')})`)
    }
    expect(offenders).toEqual([])
  })

  it('and the rule would catch one', () => {
    expect(callsOf('computeInWorldDays(events, chapters, undefined, { pinsSetClock })', 'computeInWorldDays').map(missing)).toEqual([true])
    expect(callsOf('computeInWorldDays(events, chapters, timelines)', 'computeInWorldDays').map(missing)).toEqual([true])
    expect(callsOf('computeInWorldDays(a, [...m].map((x) => f(x, y)), timelines, { pinsSetClock: w?.p })', 'computeInWorldDays').map(missing)).toEqual([false])
  })
})
