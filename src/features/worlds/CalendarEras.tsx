import { Plus, Trash2 } from 'lucide-react'
import { bcAdEras, eraBeginsAfter, formatYear, withEraAdded, withEraBeginningAfter } from '@/lib/calendar'
import type { CalendarEra, WorldCalendar } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldName } from '@/components/ui/field'

/**
 * The calendar's eras (docs/records/scene-time-plan.md, Part 2): how its years
 * are numbered and named. BC counting down to AD; BBY to ABY; the Second Age
 * and then the Third, counting again from 1. The years inside stay one count,
 * so nothing a scene is dated by moves when an era is added, renamed or
 * changed — only how its year is said.
 */
export function CalendarEras({ calendar: cal, patch }: {
  calendar: WorldCalendar
  patch: (mutate: (current: WorldCalendar) => WorldCalendar) => void
}) {
  const eras = cal.eras ?? []
  const setEra = (i: number, change: Partial<CalendarEra>) =>
    patch((c) => (c.eras?.[i] ? { ...c, eras: c.eras.map((e, j) => (j === i ? { ...e, ...change } : e)) } : c))

  return (
    <div role="group" aria-labelledby="cal-eras" className="space-y-1.5">
      <FieldName id="cal-eras">Eras</FieldName>
      {eras.length === 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => patch((c) => ({ ...c, eras: bcAdEras() }))}>
            <Plus className="h-3.5 w-3.5" /> BC and AD
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => patch(withEraAdded)}>
            <Plus className="h-3.5 w-3.5" /> Add an era
          </Button>
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">No eras: years count up from the start year, with the suffix after them.</span>
        </div>
      ) : (<>
        {eras.map((era, i) => {
          const down = i === 0 && era.counts === 'down'
          const after = eraBeginsAfter(cal, i)
          const previous = eras[i - 1]
          return (
            <div key={i} role="group" aria-label={`Era ${i + 1}`} className="flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
              <Input
                className="h-7 w-28 text-xs"
                value={era.label}
                aria-label={`Era ${i + 1} label`}
                onChange={(e) => { const label = e.target.value; setEra(i, { label }) }}
              />
              {i === 0 ? (<>
                <select
                  className="h-7 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))]"
                  aria-label="Era 1 counts"
                  value={era.counts}
                  onChange={(e) => setEra(0, { counts: e.target.value === 'down' ? 'down' : 'up' })}
                >
                  <option value="up">counts up</option>
                  {/* Down needs somewhere to count to. */}
                  <option value="down" disabled={eras.length < 2}>counts down to the next era</option>
                </select>
                {down && (
                  <label className="flex items-center gap-1.5">
                    its last year is
                    <Input
                      className="h-7 w-16 text-xs" type="number"
                      value={era.first}
                      onChange={(e) => setEra(0, { first: Math.floor(Number(e.target.value) || 0) })}
                    />
                  </label>
                )}
              </>) : (<>
                {previous?.counts === 'down' && i === 1 ? (
                  <span>begins after {previous.first} {previous.label}</span>
                ) : (
                  <label className="flex items-center gap-1.5">
                    begins after
                    <Input
                      className="h-7 w-20 text-xs" type="number"
                      value={after ?? ''}
                      onChange={(e) => { const n = Math.floor(Number(e.target.value) || 0); patch((c) => withEraBeginningAfter(c, i, n)) }}
                    />
                    {previous?.label}
                  </label>
                )}
                <label className="flex items-center gap-1.5">
                  counting up from
                  <Input
                    className="h-7 w-16 text-xs" type="number"
                    value={era.first}
                    onChange={(e) => setEra(i, { first: Math.floor(Number(e.target.value) || 0) })}
                  />
                </label>
              </>)}
              <Button
                size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" aria-label={`Remove era ${i + 1}`}
                onClick={() => patch((c) => {
                  const rest = (c.eras ?? []).filter((_, j) => j !== i)
                  if (rest.length) return { ...c, eras: rest }
                  const { eras: _eras, ...without } = c
                  return without
                })}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )
        })}
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          The story begins in {formatYear(cal, cal.startYear)}. Changing an era changes how years are said, not when anything happens.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => patch(withEraAdded)}>
            <Plus className="h-3.5 w-3.5" /> Add an era
          </Button>
          <button
            onClick={() => patch((c) => { const { eras: _eras, ...rest } = c; return rest })}
            className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" /> Remove the eras
          </button>
        </div>
      </>)}
    </div>
  )
}
