import { Plus, Trash2, CalendarDays } from 'lucide-react'
import { updateWorld } from '@/db/hooks/useWorlds'
import { defaultCalendar, daysPerYear } from '@/lib/calendar'
import type { World, WorldCalendar } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { plural } from '@/lib/plural'

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

  function patch(next: WorldCalendar | null) {
    updateWorld(world.id, { calendar: next })
  }

  function updateMonth(index: number, field: 'name' | 'days', value: string) {
    if (!cal) return
    const months = cal.months.map((m, i) =>
      i === index
        ? { ...m, [field]: field === 'days' ? Math.max(1, Math.floor(Number(value) || 1)) : value }
        : m
    )
    patch({ ...cal, months })
  }

  /**
   * A year is an ordered list, and intercalary days sit *between* months — the
   * Shire's Lithe falls in the middle of the year, not after Foreyule — so
   * appending is not enough to build one. Each row can insert after itself.
   */
  function insertAfter(index: number) {
    if (!cal) return
    const months = [...cal.months]
    months.splice(index + 1, 0, { name: 'New day', days: 1, intercalary: true })
    patch({ ...cal, months })
  }

  function toggleIntercalary(index: number) {
    if (!cal) return
    const months = cal.months.map((m, i) => (i === index ? { ...m, intercalary: !m.intercalary } : m))
    patch({ ...cal, months })
  }

  function addMonth() {
    if (!cal) return
    patch({ ...cal, months: [...cal.months, { name: `Month ${cal.months.length + 1}`, days: 30 }] })
  }

  function removeMonth(index: number) {
    if (!cal || cal.months.length <= 1) return
    patch({ ...cal, months: cal.months.filter((_, i) => i !== index) })
  }

  return (
    <section id="settings-calendar" data-settings-section="Calendar" className="scroll-mt-16 space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Calendar</h2>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          Define an in-world calendar to show story dates (instead of "Day N") and compute character ages from a birth date.
        </p>
      </div>

      {!cal ? (
        <Button size="sm" variant="outline" className="gap-2" onClick={() => patch(defaultCalendar())}>
          <CalendarDays className="h-3.5 w-3.5" />
          Enable calendar
        </Button>
      ) : (
        <div className="space-y-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
          {/* Epoch + suffix */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cal-start-year">Start year</Label>
              <Input
                id="cal-start-year"
                type="number"
                className="h-8 w-28 text-xs"
                value={cal.startYear}
                onChange={(e) => patch({ ...cal, startYear: Math.floor(Number(e.target.value) || 0) })}
              />
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Year that in-world day 0 falls in.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cal-suffix">Year suffix</Label>
              <Input
                id="cal-suffix"
                className="h-8 w-28 text-xs"
                placeholder="e.g. AC, TA"
                value={cal.yearSuffix ?? ''}
                onChange={(e) => patch({ ...cal, yearSuffix: e.target.value })}
              />
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Shown after the year.</p>
            </div>
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
            <Label>Months</Label>
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
          </div>

          <div className="border-t border-[hsl(var(--border))] pt-3">
            <button
              onClick={() => patch(null)}
              className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" /> Disable calendar
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
