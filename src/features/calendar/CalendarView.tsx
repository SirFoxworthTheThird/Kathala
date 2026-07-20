import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, History } from 'lucide-react'
import { useWorld } from '@/db/hooks/useWorlds'
import { useWorldEvents, useWorldChapters, updateEvent } from '@/db/hooks/useTimeline'
import { buildCalendarMonths, type CalendarEvent } from '@/lib/calendarView'
import { dateToDayNumber } from '@/lib/calendar'
import { useAppStore } from '@/store'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'

export default function CalendarView() {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const { activeEventId, setActiveEventId } = useAppStore()

  const world    = useWorld(worldId ?? null)
  const events   = useWorldEvents(worldId ?? null)
  const chapters = useWorldChapters(worldId ?? null)
  const calendar = world?.calendar ?? null

  const [dragId, setDragId] = useState<string | null>(null)
  const [overCell, setOverCell] = useState<string | null>(null)

  const months = useMemo(
    () => (calendar ? buildCalendarMonths({ events, chapters, calendar }) : []),
    [calendar, events, chapters]
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
    await updateEvent(id, { inWorldTime: dateToDayNumber(calendar, { year, month, day }) })
  }

  if (!calendar) {
    return (
      <div className="p-6">
        <EmptyState
          icon={CalendarDays}
          title="No calendar yet"
          description="The calendar view lays your events out by in-world date. Enable a calendar in world settings to use it."
          action={(
            <Button size="sm" variant="outline" onClick={() => navigate(`/worlds/${worldId}/settings`)}>
              Open World settings
            </Button>
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
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: m.days }, (_, i) => i + 1).map((day) => {
                    const cellKey = `${m.key}-${day}`
                    const dayEvents = m.eventsByDay.get(day) ?? []
                    const isOver = overCell === cellKey
                    return (
                      <div
                        key={day}
                        aria-label={`${m.monthName} ${day}, ${m.year}${suffix}`}
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
                        <span className={`text-[10px] tabular-nums ${dayEvents.length ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
                          {day}
                        </span>
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
                                title={ev.isFlashback ? `${ev.title} (flashback)` : ev.title}
                                className={`flex items-center gap-0.5 truncate rounded px-1 py-0.5 text-left text-[10px] transition-colors ${
                                  isActive
                                    ? 'bg-[hsl(var(--ring))] text-white'
                                    : 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent)/0.7)]'
                                } ${dragId === ev.id ? 'opacity-40' : ''}`}
                              >
                                {ev.isFlashback && <History className="h-2.5 w-2.5 shrink-0 opacity-70" aria-hidden="true" />}
                                <span className="truncate">{ev.title || 'Untitled'}</span>
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
