import type { WorldCalendar, InWorldDate } from '@/types'
import { Input } from '@/components/ui/input'
import { dateToDayNumber, longestLength, monthLength, weekdayName } from '@/lib/calendar'
import { YearField } from '@/components/YearField'

interface InWorldDatePickerProps {
  calendar: WorldCalendar
  value: InWorldDate | null
  onChange: (date: InWorldDate | null) => void
  /** Label shown on the "set" toggle when no date is set. */
  setLabel?: string
  /** The date the "set" toggle starts at: the first day of the start year when absent. */
  initial?: InWorldDate | null
}

/**
 * Picks a date on a world's custom calendar: month (from the calendar's months),
 * day (clamped to that month's length) and year. Returns null when cleared.
 */
export function InWorldDatePicker({ calendar, value, onChange, setLabel = 'Set date', initial }: InWorldDatePickerProps) {
  if (!value) {
    return (
      <button
        type="button"
        className="text-xs text-[hsl(var(--muted-foreground))] underline hover:text-[hsl(var(--foreground))]"
        onClick={() => onChange(initial ?? { year: calendar.startYear, month: 0, day: 1 })}
      >
        {setLabel}
      </button>
    )
  }

  const weekday = weekdayName(calendar, dateToDayNumber(calendar, value))
  const month = calendar.months[value.month]
  // This year's length: 29 February is there in 2028 and not in 2027.
  const monthLen = Math.max(1, monthLength(calendar, value.month, value.year))
  // A single day outside the months has no day number to pick — "Midyear's Day"
  // is the whole of the date. The clamp below already forced it to 1; the field
  // was just a spinner that could not spin.
  const bare = !!month?.intercalary && longestLength(calendar, value.month) === 1
  /** A date moved to another month or year keeps its day where that has it, and takes the last day where not. */
  const clamped = (next: InWorldDate) => ({ ...next, day: Math.min(next.day, Math.max(1, monthLength(calendar, next.month, next.year))) })

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!bare && (
      <Input
        className="h-8 w-16 text-xs"
        type="number"
        min="1"
        max={monthLen}
        aria-label="Day"
        value={value.day}
        onChange={(e) => {
          const day = Math.max(1, Math.min(monthLen, Math.floor(Number(e.target.value) || 1)))
          onChange({ ...value, day })
        }}
      />
      )}
      <select
        className="h-8 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        aria-label="Month"
        value={value.month}
        onChange={(e) => {
          onChange(clamped({ ...value, month: Math.floor(Number(e.target.value)) }))
        }}
      >
        {calendar.months.map((m, i) => (
          <option key={i} value={i}>{m.name}</option>
        ))}
      </select>
      <YearField calendar={calendar} year={value.year} onChange={(year) => onChange(clamped({ ...value, year }))} />
      {/* The weekday, where the calendar has a week (writer run 9). */}
      {weekday && <span className="text-xs text-[hsl(var(--muted-foreground))]" data-weekday>{weekday}</span>}
      <button
        type="button"
        className="text-xs text-[hsl(var(--muted-foreground))] underline hover:text-destructive"
        onClick={() => onChange(null)}
      >
        Clear
      </button>
    </div>
  )
}
