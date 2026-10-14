import { useState } from 'react'
import { Plus, Trash2, CalendarDays, ChevronRight } from 'lucide-react'
import { updateWorld, updateWorldCalendar } from '@/db/hooks/useWorlds'
import { defaultCalendar, daysPerYear, earthWeek, isEarthWeek, isEarthYear, EARTH_WEEKDAYS, formatInWorldDate } from '@/lib/calendar'
import type { World, WorldCalendar } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldName } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { plural } from '@/lib/plural'
import { CALENDAR_PRESETS } from '@/lib/calendarPresets'
import { SettingsSection } from './SettingsSection'
import { YearField } from '@/components/YearField'
import { CalendarEras } from './CalendarEras'

interface CalendarEditorProps {
  world: World
}

/**
 * Per-world calendar configuration. When enabled, in-world day numbers are
 * rendered as calendar dates (see `formatInWorldDate`) and character ages can
 * be computed from a birth date. Disabled = dates shown as "Day N".
 */
export function CalendarEditor({ world }: CalendarEditorProps) {
  const cal = world.calendar ?? null
  const namedDays = cal?.months.filter((m) => m.intercalary).length ?? 0
  /*
    HB-9: twelve month rows sat open in the middle of Settings, and on a world
    with a thirteenth entry for festival days, thirteen. Folded away by default
    — the summary beside the heading already says how long the year is and how
    many months make it, which is what anyone is checking most of the time.
  */
  const [monthsOpen, setMonthsOpen] = useState(false)

  /**
   * HB-3a: every one of these writes the whole calendar, because it is a nested
   * object on `worlds`. Building the new value from the calendar this component
   * last *rendered* means a write to one field carries a stale copy of every
   * other, so two edits landing inside each other's live-query round-trip lose
   * one of the two. `updateWorldCalendar` hands the mutator the calendar as
   * stored, read inside the same transaction as the write.
   */
  function patch(mutate: (current: WorldCalendar) => WorldCalendar) {
    updateWorldCalendar(world.id, mutate)
  }

  function updateMonth(index: number, field: 'name' | 'days', value: string) {
    patch((c) => ({
      ...c,
      months: c.months.map((m, i) =>
        i === index
          ? { ...m, [field]: field === 'days' ? Math.max(1, Math.floor(Number(value) || 1)) : value }
          : m
      ),
    }))
  }

  /**
   * A year is an ordered list, and intercalary days sit *between* months — the
   * Shire's Lithe falls in the middle of the year, not after Foreyule — so
   * appending is not enough to build one. Each row can insert after itself.
   */
  function insertAfter(index: number) {
    patch((c) => {
      const months = [...c.months]
      months.splice(index + 1, 0, { name: 'New day', days: 1, intercalary: true })
      return { ...c, months }
    })
  }

  function toggleIntercalary(index: number) {
    patch((c) => ({
      ...c,
      months: c.months.map((m, i) => (i === index ? { ...m, intercalary: !m.intercalary } : m)),
    }))
  }

  function addMonth() {
    patch((c) => ({ ...c, months: [...c.months, { name: `Month ${c.months.length + 1}`, days: 30 }] }))
  }

  function removeMonth(index: number) {
    patch((c) => (c.months.length <= 1 ? c : { ...c, months: c.months.filter((_, i) => i !== index) }))
  }

  return (
    <SettingsSection id="settings-calendar" label="Calendar"
      blurb={<>Define an in-world calendar to show story dates (instead of "Day N") and compute character ages from a birth date.</>}
    >
      {!cal ? (
        <div className="space-y-3">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => updateWorld(world.id, { calendar: defaultCalendar() })}>
            <CalendarDays className="h-3.5 w-3.5" />
            Enable calendar
          </Button>
          {/*
            HB-9's other half: the only route to a calendar unlike Earth's was
            editing twelve rows by hand. These commit to the *shape* — the day
            counts, and which entries fall outside the months — and leave the
            names to be changed, which is the quick part.

            Offered only here. Applying one over a calendar somebody has
            already edited would throw their work away.
          */}
          <div className="space-y-1.5">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Or start from a shape and rename it:</p>
            <div className="flex flex-wrap gap-2">
              {CALENDAR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => updateWorld(world.id, { calendar: preset.build() })}
                  className="max-w-xs rounded-md border border-[hsl(var(--border))] px-3 py-2 text-left transition-colors hover:bg-[hsl(var(--accent)/0.5)]"
                >
                  <span className="block text-xs font-medium text-[hsl(var(--foreground))]">{preset.label}</span>
                  <span className="block text-[10px] text-[hsl(var(--muted-foreground))]">{preset.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
          {/* Epoch + suffix */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cal-start-year">Start year</Label>
              <div className="flex items-center gap-2">
                <YearField
                  calendar={cal}
                  id="cal-start-year"
                  label="Start year"
                  className="h-8 w-28 text-xs"
                  year={cal.startYear}
                  onChange={(y) => {
                    // An Earth year with Earth's week keeps its weekdays true to the year: 1 January 2025 was a Wednesday.
                    patch((c) => ({ ...c, startYear: y, ...(isEarthYear(c) && isEarthWeek(c.week) ? { week: earthWeek(y) } : {}) }))
                  }}
                />
              </div>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Year that in-world day 0 falls in.</p>
            </div>
            {/* With eras, each era's label is said after the year instead. */}
            {!cal.eras?.length && <div className="space-y-1.5">
              <Label htmlFor="cal-suffix">Year suffix</Label>
              <Input
                id="cal-suffix"
                className="h-8 w-28 text-xs"
                placeholder="e.g. AC, TA"
                value={cal.yearSuffix ?? ''}
                onChange={(e) => { const s = e.target.value; patch((c) => ({ ...c, yearSuffix: s })) }}
              />
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Shown after the year.</p>
            </div>}
            <div className="ml-auto text-right">
              <p className="text-xs font-medium text-[hsl(var(--foreground))]">{daysPerYear(cal)} days/year</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {plural(cal.months.filter((m) => !m.intercalary).length, 'month')}
                {namedDays > 0 && ` · ${plural(namedDays, 'named day')}`}
              </p>
            </div>
          </div>

          {/* Months */}
          <div className="space-y-1.5">
            <button
              onClick={() => setMonthsOpen((o) => !o)}
              aria-expanded={monthsOpen}
              className="flex w-full items-center gap-1.5 rounded py-1 text-left transition-colors hover:text-[hsl(var(--foreground))]"
            >
              <ChevronRight
                className={`h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${monthsOpen ? 'rotate-90' : ''}`}
                aria-hidden="true"
              />
              <FieldName className="cursor-pointer">Months</FieldName>
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {plural(cal.months.length, 'entry', 'entries')}
              </span>
            </button>
            {/*
              Rendered away rather than hidden with a class: a control that is
              in the DOM but not on screen is still reachable, and this one
              writes to the world.
            */}
            {monthsOpen && (<>
            <div className="space-y-1.5">
              {cal.months.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-right text-[10px] text-[hsl(var(--muted-foreground))]">{i + 1}.</span>
                  <Input
                    className="h-7 flex-1 text-xs"
                    value={m.name}
                    aria-label={`Month ${i + 1} name`}
                    onChange={(e) => updateMonth(i, 'name', e.target.value)}
                  />
                  <Input
                    className="h-7 w-20 text-xs"
                    type="number"
                    min="1"
                    step="1"
                    value={m.days}
                    aria-label={`Month ${i + 1} length in days`}
                    onChange={(e) => updateMonth(i, 'days', e.target.value)}
                  />
                  <span className="w-8 shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">days</span>
                  <label className="flex shrink-0 items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                    <input
                      type="checkbox"
                      className="accent-[hsl(var(--ring))]"
                      checked={!!m.intercalary}
                      aria-label={`Entry ${i + 1} is days outside the months`}
                      onChange={() => toggleIntercalary(i)}
                    />
                    outside the months
                  </label>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    aria-label={`Insert a named day after entry ${i + 1}`}
                    onClick={() => insertAfter(i)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive disabled:opacity-30"
                    disabled={cal.months.length <= 1}
                    aria-label={`Remove month ${i + 1}`}
                    onClick={() => removeMonth(i)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={addMonth}>
              <Plus className="h-3.5 w-3.5" /> Add month
            </Button>
            </>)}
          </div>

          {/*
            The week (writer run 9): the Calendar's columns and a date's
            weekday come from it. An Earth year gets Earth's; any other
            calendar names its own days, as many as it has.
          */}
          <div role="group" aria-labelledby="cal-week" className="space-y-1.5">
            <FieldName id="cal-week">Week</FieldName>
            {cal.week ? (<>
              <div className="flex flex-wrap items-center gap-1.5">
                {cal.week.days.map((d, i) => (
                  <Input
                    key={i}
                    className="h-7 w-24 text-xs"
                    value={d}
                    aria-label={`Weekday ${i + 1} name`}
                    onChange={(e) => { const name = e.target.value; patch((c) => (c.week ? { ...c, week: { ...c.week, days: c.week.days.map((x, j) => (j === i ? name : x)) } } : c)) }}
                  />
                ))}
                <Button
                  size="icon" variant="ghost" className="h-7 w-7" aria-label="Add a weekday"
                  onClick={() => patch((c) => (c.week ? { ...c, week: { ...c.week, days: [...c.week.days, `Day ${c.week.days.length + 1}`] } } : c))}
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive disabled:opacity-30" aria-label="Remove the last weekday"
                  disabled={cal.week.days.length <= 1}
                  onClick={() => patch((c) => (c.week && c.week.days.length > 1 ? { ...c, week: { days: c.week.days.slice(0, -1), first: Math.min(c.week.first, c.week.days.length - 2) } } : c))}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <label className="flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                The story's first day, {formatInWorldDate(cal, 0)}, is a
                <select
                  className="h-7 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))]"
                  value={cal.week.first}
                  onChange={(e) => { const first = Number(e.target.value); patch((c) => (c.week ? { ...c, week: { ...c.week, first } } : c)) }}
                >
                  {cal.week.days.map((d, i) => <option key={i} value={i}>{d || `Day ${i + 1}`}</option>)}
                </select>
              </label>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                Days outside the months are outside the week, and do not move it along.
              </p>
              <button
                onClick={() => patch((c) => { const { week: _week, ...rest } = c; return rest })}
                className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" /> Remove the week
              </button>
            </>) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm" variant="outline" className="gap-1.5"
                  onClick={() => patch((c) => ({ ...c, week: isEarthYear(c) ? earthWeek(c.startYear) : { days: [...EARTH_WEEKDAYS], first: 0 } }))}
                >
                  <Plus className="h-3.5 w-3.5" /> Add a week
                </Button>
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">No week: dates have no weekday, and the Calendar no weekday columns.</span>
              </div>
            )}
          </div>

          <CalendarEras calendar={cal} patch={patch} />

          <div className="border-t border-[hsl(var(--border))] pt-3">
            <button
              /* Removing the calendar entirely is not a partial edit of it. */
              onClick={() => updateWorld(world.id, { calendar: null })}
              className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" /> Disable calendar
            </button>
          </div>
        </div>
      )}
    </SettingsSection>
  )
}
