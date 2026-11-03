import { useState } from 'react'
import type { WorldCalendar } from '@/types'
import { Input } from '@/components/ui/input'
import { eraIndexOf, yearInEra, yearLabel } from '@/lib/calendar'

/**
 * A year on a world's calendar, as the writer says it: the number, and where
 * the calendar has eras, which one — 19 and BBY, not the count inside that
 * makes 19 BBY come before 18 BBY. Without eras, the number and the suffix,
 * as it always was.
 *
 * A number past its era's end — 0 BC — is taken to the era beside it, so a
 * spinner going one too far moves on rather than sticking.
 *
 * The era and the number each change the other's meaning, so each change is
 * read against what was last *asked for*, not against `year` as last rendered.
 * Where `year` comes back from the store, it is one write behind for a moment,
 * and a year typed straight after choosing BC went into AD: 44 BC was saved
 * as 44 AD (`calendarEras.spec.ts`).
 */
export function YearField({ calendar, year, onChange, label = 'Year', id, className = 'h-8 w-24 text-xs' }: {
  calendar: WorldCalendar
  /** The year as the calendar counts it inside. */
  year: number
  onChange: (year: number) => void
  /** The number's name; the era's is "<label> era". */
  label?: string
  id?: string
  className?: string
}) {
  const eras = calendar.eras ?? []
  /*
    What was last asked for: the era, the number, and the year they make. It
    stands only while nothing has arrived since — `year` and `calendar` still
    the ones it was asked against. Once the write lands, or anything else
    changes them (an undo), the props are the answer again.
  */
  const [asked, setAsked] = useState<{ era: number | null; number: number; from: number; cal: WorldCalendar } | null>(null)
  const pending = asked && asked.from === year && asked.cal === calendar ? asked : null
  const at = pending ? pending.era : eraIndexOf(calendar, year)
  const said = pending ? { number: pending.number } : yearLabel(calendar, year)
  function ask(era: number | null, number: number) {
    const next = era === null ? number : yearInEra(calendar, era, number)
    setAsked({ era: eraIndexOf(calendar, next), number: yearLabel(calendar, next).number, from: year, cal: calendar })
    onChange(next)
  }
  return (
    <>
      <Input
        id={id}
        className={className}
        type="number"
        // Named by its <label> where it has one (`id`), and by `label` where it has none.
        {...(id ? {} : { 'aria-label': label })}
        value={said.number}
        onChange={(e) => {
          ask(at, Math.floor(Number(e.target.value) || 0))
        }}
      />
      {at !== null ? (
        <select
          className="h-8 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          aria-label={`${label} era`}
          value={at}
          onChange={(e) => ask(Number(e.target.value), said.number)}
        >
          {eras.map((era, i) => <option key={i} value={i}>{era.label || `Era ${i + 1}`}</option>)}
        </select>
      ) : calendar.yearSuffix && (
        <span className="text-xs text-[hsl(var(--muted-foreground))]">{calendar.yearSuffix}</span>
      )}
    </>
  )
}
