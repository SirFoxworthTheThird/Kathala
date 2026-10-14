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
  const at = eraIndexOf(calendar, year)
  const said = yearLabel(calendar, year)
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
          const n = Math.floor(Number(e.target.value) || 0)
          onChange(at === null ? n : yearInEra(calendar, at, n))
        }}
      />
      {at !== null ? (
        <select
          className="h-8 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          aria-label={`${label} era`}
          value={at}
          onChange={(e) => onChange(yearInEra(calendar, Number(e.target.value), said.number))}
        >
          {eras.map((era, i) => <option key={i} value={i}>{era.label || `Era ${i + 1}`}</option>)}
        </select>
      ) : calendar.yearSuffix && (
        <span className="text-xs text-[hsl(var(--muted-foreground))]">{calendar.yearSuffix}</span>
      )}
    </>
  )
}
