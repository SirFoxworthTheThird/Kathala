import { Plus, Trash2 } from 'lucide-react'
import { daysPerYear, formatYear, gregorianLeap, isEarthYear, nextLeapYear } from '@/lib/calendar'
import type { CalendarLeap, WorldCalendar } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldName } from '@/components/ui/field'

/**
 * The calendar's leap years: which years they are, and which entry gains the
 * days. February and the Gregorian rule for an Earth year; any entry and any
 * rule for a world's own — the Shire's Overlithe is a day outside the months
 * that only leap years have.
 *
 * Offered, never applied of itself: a calendar written without leap years has
 * dates worked out without them, and a rule added now moves every date after
 * the first leap day by a day for each one before it.
 */
export function CalendarLeapYears({ calendar: cal, patch }: {
  calendar: WorldCalendar
  patch: (mutate: (current: WorldCalendar) => WorldCalendar) => void
}) {
  const leap = cal.leap
  const set = (change: Partial<CalendarLeap>) => patch((c) => (c.leap ? { ...c, leap: { ...c.leap, ...change } } : c))
  /** A rule's optional step: blank is none. */
  const optional = (raw: string) => { const n = Math.floor(Number(raw)); return raw.trim() === '' || !(n >= 1) ? undefined : n }
  const next = nextLeapYear(cal, cal.startYear)

  return (
    <div role="group" aria-labelledby="cal-leap" className="space-y-1.5">
      <FieldName id="cal-leap">Leap years</FieldName>
      {!leap ? (
        <div className="flex flex-wrap items-center gap-2">
          {isEarthYear(cal) && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => patch((c) => ({ ...c, leap: gregorianLeap() }))}>
              <Plus className="h-3.5 w-3.5" /> Earth’s leap years
            </Button>
          )}
          <Button
            size="sm" variant="outline" className="gap-1.5"
            onClick={() => patch((c) => ({ ...c, leap: { month: Math.max(0, c.months.findIndex((m) => !m.intercalary)), days: 1, every: 4 } }))}
          >
            <Plus className="h-3.5 w-3.5" /> Add a leap rule
          </Button>
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">No leap years: every year is {daysPerYear(cal)} days.</span>
        </div>
      ) : (<>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          <span>In a leap year</span>
          <select
            className="h-7 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))]"
            aria-label="Entry that gains the leap days"
            value={leap.month}
            onChange={(e) => set({ month: Number(e.target.value) })}
          >
            {cal.months.map((m, i) => <option key={i} value={i}>{m.name || `Entry ${i + 1}`}</option>)}
          </select>
          <span>gains</span>
          <Input
            className="h-7 w-14 text-xs" type="number" min="1" aria-label="Leap days"
            value={leap.days}
            onChange={(e) => set({ days: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
          />
          <span>{leap.days === 1 ? 'day' : 'days'}.</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          <span>Every</span>
          <Input
            className="h-7 w-16 text-xs" type="number" min="1" aria-label="A leap year every"
            value={leap.every}
            onChange={(e) => set({ every: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
          />
          <span>years, except every</span>
          <Input
            className="h-7 w-16 text-xs" type="number" min="1" aria-label="Except every" placeholder="—"
            value={leap.skip ?? ''}
            onChange={(e) => set({ skip: optional(e.target.value) })}
          />
          <span>unless every</span>
          <Input
            className="h-7 w-16 text-xs" type="number" min="1" aria-label="Unless every" placeholder="—"
            value={leap.keep ?? ''}
            onChange={(e) => set({ keep: optional(e.target.value) })}
          />
        </div>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {daysPerYear(cal)} days in a common year, {daysPerYear(cal) + leap.days} in a leap year.
          {next !== null && <> The first leap year from the story’s start is {formatYear(cal, next)}.</>}
          {/* Only where it can confuse: an era counting down numbers its years the other way. */}
          {!!cal.eras?.length && <> Leap years are counted as the calendar counts years inside, whatever the era calls them: with BC and AD, 1 BC is year 0, a leap year.</>}
        </p>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          Adding, changing or removing the rule moves every date after the first leap day by a day for each one before it. Scenes keep their place in the story.
        </p>
        <button
          onClick={() => patch((c) => { const { leap: _leap, ...rest } = c; return rest })}
          className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" /> Remove the leap rule
        </button>
      </>)}
    </div>
  )
}
