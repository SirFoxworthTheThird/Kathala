import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, History, CircleDashed } from 'lucide-react'
import { useWorld, updateWorld } from '@/db/hooks/useWorlds'
import { useWorldEvents, useWorldChapters, useTimelines, updateEvent } from '@/db/hooks/useTimeline'
import { buildCalendarMonths, type CalendarEvent } from '@/lib/calendarView'
import { dateToDayNumber, defaultCalendar } from '@/lib/calendar'
import { useAppStore } from '@/store'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { plural } from '@/lib/plural'

export default function CalendarView() {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const { activeEventId, setActiveEventId } = useAppStore()

  const world    = useWorld(worldId ?? null)
  const events   = useWorldEvents(worldId ?? null)
  const chapters = useWorldChapters(worldId ?? null)
  const timelines = useTimelines(worldId ?? null)
  const calendar = world?.calendar ?? null

  const [dragId, setDragId] = useState<string | null>(null)
  const [overCell, setOverCell] = useState<string | null>(null)

  const months = useMemo(
    () => (calendar ? buildCalendarMonths({ events, chapters, calendar, timelines }) : []),
    [calendar, events, chapters, timelines]
  )

  // HB-5: the page read authoritative while mostly reflecting missing data —
  // every scene with nothing said about its timing stacks on the day the last
  // one landed on, which for a fresh world is the first day of the year. The
  // count is of scenes actually drawn here, so it matches what is on screen.
  const provisionalCount = useMemo(
    () => months.reduce(
      (n, m) => n + [...m.eventsByDay.values()].flat().filter((e) => e.provisional).length,
      0,
    ),
    [months]
  )

  function openEvent(ev: CalendarEvent) {
    const full = events.find((e) => e.id === ev.id)
    setActiveEventId(ev.id)
    navigate(`/worlds/${worldId}/timeline${full ? `/${full.chapterId}` : ''}`)
  }

  async function dropOnDay(year: number, month: number, day: number) {
    setOverCell(null)
    const id = dragId
    setDragId(null)
    if (!id || !calendar) return
    // The calendar shows the global clock; an inWorldTime pin is a day on the
    // event's own timeline, so subtract that timeline's offset.
    const ev = events.find((e) => e.id === id)
    const offset = timelines.find((t) => t.id === ev?.timelineId)?.dayOffset ?? 0
    await updateEvent(id, { inWorldTime: dateToDayNumber(calendar, { year, month, day }) - offset })
  }

  if (!calendar) {
    return (
      <div className="p-6">
        {/*
          CAL-2 filed this as "the nav item is present when the feature cannot
          work" and asked for the item to be hidden. Hiding it hides the
          feature — nothing else in the app mentions that a calendar exists.
          What made the visit a dead end was the way out: *enable a calendar in
          world settings*, and a button landing at the top of an eleven-section
          page with the calendar somewhere down it. The screen does the thing
          instead, and settings remains one click away for tuning it.
        */}
        <EmptyState
          icon={CalendarDays}
          title="No calendar yet"
          description="The calendar view lays your events out by in-world date, and turns day counts into dates across the app. Start from a standard twelve-month year — you can rename the months, change their lengths and set the starting year afterwards."
          action={(
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                size="sm"
                className="gap-2"
                onClick={() => worldId && updateWorld(worldId, { calendar: defaultCalendar() })}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Enable calendar
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate(`/worlds/${worldId}/settings`)}>
                Set it up in World settings
              </Button>
            </div>
          )}
        />
      </div>
    )
  }

  const suffix = calendar.yearSuffix ? ` ${calendar.yearSuffix}` : ''

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[hsl(var(--border))] px-6 py-3">
        <h1 className="text-lg font-semibold text-[hsl(var(--foreground))]">Calendar</h1>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Events by in-world date. Drag an event to a day to pin it there.
        </p>
        {provisionalCount > 0 && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-500">
            <CircleDashed className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>
              {plural(provisionalCount, 'scene has', 'scenes have')} no timing yet — shown dashed,
              on the day the scene before them landed on. Set <em>Elapsed Time</em> on a scene,
              or drag it onto a day here.
            </span>
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {months.length === 0 ? (
          <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No dated events yet. Add events (with travel days or an in-world date) to see them here.
          </p>
        ) : (
          <div className="mx-auto flex max-w-4xl flex-col gap-6">
            {months.map((m) => (
              <div key={m.key} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
                <h2 className="mb-2 text-sm font-semibold text-[hsl(var(--foreground))]">
                  {m.monthName} <span className="text-[hsl(var(--muted-foreground))]">{m.year}{suffix}</span>
                </h2>
                {/*
                  A stretch of days outside the months is not a month, and a
                  seven-column grid holding one cell reads as a broken one. It
                  gets a column per day instead, and a lone day drops its number
                  entirely — "Midyear's Day" is the whole of that date, which is
                  what `formatInWorldDate` prints for it too.
                */}
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `repeat(${m.intercalary ? Math.min(m.days, 7) : 7}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: m.days }, (_, i) => i + 1).map((day) => {
                    const cellKey = `${m.key}-${day}`
                    const dayEvents = m.eventsByDay.get(day) ?? []
                    const isOver = overCell === cellKey
                    const bare = m.intercalary && m.days === 1
                    return (
                      <div
                        key={day}
                        aria-label={bare
                          ? `${m.monthName}, ${m.year}${suffix}`
                          : `${m.monthName} ${day}, ${m.year}${suffix}`}
                        onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverCell(cellKey) } }}
                        onDragLeave={() => setOverCell((c) => (c === cellKey ? null : c))}
                        onDrop={(e) => { e.preventDefault(); dropOnDay(m.year, m.month, day) }}
                        className={`flex min-h-[3.5rem] flex-col rounded border p-1 transition-colors ${
                          isOver
                            ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent)/0.4)]'
                            : dayEvents.length
                              ? 'border-[hsl(var(--border))] bg-[hsl(var(--background))]'
                              : 'border-transparent bg-[hsl(var(--muted)/0.25)]'
                        }`}
                      >
                        {!bare && (
                          <span className={`text-[10px] tabular-nums ${dayEvents.length ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
                            {day}
                          </span>
                        )}
                        <div className="mt-0.5 flex flex-col gap-0.5">
                          {dayEvents.map((ev) => {
                            const isActive = ev.id === activeEventId
                            return (
                              <button
                                key={ev.id}
                                draggable
                                onDragStart={() => setDragId(ev.id)}
                                onDragEnd={() => { setDragId(null); setOverCell(null) }}
                                onClick={() => openEvent(ev)}
                                title={[
                                  ev.title,
                                  ev.isFlashback ? '(flashback)' : null,
                                  ev.provisional ? '— no timing set; this date is derived, not chosen' : null,
                                ].filter(Boolean).join(' ')}
                                className={`flex items-center gap-0.5 truncate rounded px-1 py-0.5 text-left text-[10px] transition-colors ${
                                  isActive
                                    ? 'bg-[hsl(var(--ring))] text-white'
                                    : 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent)/0.7)]'
                                } ${ev.provisional && !isActive ? 'border border-dashed border-amber-500/60' : ''} ${dragId === ev.id ? 'opacity-40' : ''}`}
                              >
                                {ev.isFlashback && <History className="h-2.5 w-2.5 shrink-0 opacity-70" aria-hidden="true" />}
                                {ev.provisional && (
                                  <CircleDashed className="h-2.5 w-2.5 shrink-0 opacity-70" aria-hidden="true" />
                                )}
                                <span className="truncate">{ev.title || 'Untitled'}</span>
                                {/* The dash and the glyph are both visual; a
                                    screen reader gets the distinction here. */}
                                {ev.provisional && <span className="sr-only">, no timing set</span>}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
