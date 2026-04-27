import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useWorldEvents, useWorldChapters } from '@/db/hooks/useTimeline'
import { upsertSnapshot } from '@/db/hooks/useSnapshots'

interface StepPlaceProps {
  worldId: string
  characterId: string | null
  createdEventId: string | null
  onComplete: () => void
  onSkip: () => void
}

export function StepPlace({ worldId, characterId, createdEventId, onComplete, onSkip }: StepPlaceProps) {
  const events   = useWorldEvents(worldId)
  const chapters = useWorldChapters(worldId)
  const [selectedEventId, setSelectedEventId] = useState<string>(createdEventId ?? '')
  const [loading, setLoading] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => { headingRef.current?.focus() }, [])

  // Pre-select the event created in step 1 when events load
  useEffect(() => {
    if (!selectedEventId && createdEventId) setSelectedEventId(createdEventId)
  }, [createdEventId, selectedEventId])

  const noEvents = events.length === 0

  // Build display labels: "Chapter 1 — Event title"
  const chapterById = new Map(chapters.map((c) => [c.id, c]))
  const eventOptions = [...events].sort((a, b) => {
    const ca = chapterById.get(a.chapterId)
    const cb = chapterById.get(b.chapterId)
    const numA = (ca?.number ?? 0) * 10_000 + a.sortOrder
    const numB = (cb?.number ?? 0) * 10_000 + b.sortOrder
    return numA - numB
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!characterId || !selectedEventId) { onSkip(); return }
    setLoading(true)
    try {
      await upsertSnapshot({
        worldId,
        characterId,
        eventId: selectedEventId,
        isAlive: true,
        currentLocationMarkerId: null,
        currentMapLayerId: null,
        inventoryItemIds: [],
        inventoryNotes: '',
        statusNotes: '',
        travelModeId: null,
      })
      onComplete()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold text-[hsl(var(--foreground))] focus-visible:outline-none"
        >
          Where does their story begin?
        </h2>
        <p className="mt-1.5 text-sm text-[hsl(var(--muted-foreground))]">
          Pick the moment when we first meet them. You can change this any time.
        </p>
      </div>

      {noEvents ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          No moments yet — you can place your character later in the Timeline.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wizard-place-event" className="text-sm">
            Starting moment
          </Label>
          <Select
            value={selectedEventId || undefined}
            onValueChange={setSelectedEventId}
          >
            <SelectTrigger id="wizard-place-event" className="max-w-md">
              <SelectValue placeholder="Choose a moment…" />
            </SelectTrigger>
            <SelectContent>
              {eventOptions.map((ev) => {
                const ch = chapterById.get(ev.chapterId)
                // Single string child — Radix SelectValue requires this to
                // display the selection in the trigger correctly.
                const label = ch
                  ? `Ch. ${ch.number} — ${ev.title || 'Untitled event'}`
                  : (ev.title || 'Untitled event')
                return (
                  <SelectItem key={ev.id} value={ev.id}>
                    {label}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col items-start gap-2">
        <Button type="submit" disabled={loading || (!noEvents && !selectedEventId)} aria-busy={loading}>
          {loading ? 'Placing…' : noEvents ? 'Continue' : 'Place them here'}
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] rounded"
        >
          Skip for now →
        </button>
      </div>
    </form>
  )
}
