import type { WorldCalendar, InWorldDate } from '@/types'
import { Input } from '@/components/ui/input'

interface InWorldDatePickerProps {
  calendar: WorldCalendar
  value: InWorldDate | null
  onChange: (date: InWorldDate | null) => void
  /** Label shown on the "set" toggle when no date is set. */
  setLabel?: string
}

/**
 * Picks a date on a world's custom calendar: month (from the calendar's months),
 * day (clamped to that month's length) and year. Returns null when cleared.
 */
export function InWorldDatePicker({ calendar, value, onChange, setLabel = 'Set date' }: InWorldDatePickerProps) {
  if (!value) {
    return (
      <button
        type="button"
        className="text-xs text-[hsl(var(--muted-foreground))] underline hover:text-[hsl(var(--foreground))]"
        onClick={() => onChange({ year: calendar.startYear, month: 0, day: 1 })}
      >
        {setLabel}
      </button>
    )
  }

  const monthLen = Math.max(1, Math.floor(calendar.months[value.month]?.days ?? 30))

  return (
    <div className="flex flex-wrap items-center gap-2">
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
      <select
        className="h-8 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        aria-label="Month"
        value={value.month}
        onChange={(e) => {
          const month = Math.floor(Number(e.target.value))
          const len = Math.max(1, Math.floor(calendar.months[month]?.days ?? 30))
          onChange({ ...value, month, day: Math.min(value.day, len) })
        }}
      >
        {calendar.months.map((m, i) => (
          <option key={i} value={i}>{m.name}</option>
        ))}
      </select>
      <Input
        className="h-8 w-24 text-xs"
        type="number"
        aria-label="Year"
        value={value.year}
        onChange={(e) => onChange({ ...value, year: Math.floor(Number(e.target.value) || 0) })}
      />
      {calendar.yearSuffix && (
        <span className="text-xs text-[hsl(var(--muted-foreground))]">{calendar.yearSuffix}</span>
      )}
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
