import { useMemo } from 'react'
import { X } from 'lucide-react'
import { useCharacterSnapshots } from '@/db/hooks/useSnapshots'
import { useAppStore } from '@/store'
import type { Character, LocationMarker } from '@/types'
import type { WorldEvent, Chapter } from '@/types'

interface FilmStripStop {
  eventId: string
  chapterNumber: number
  chapterTitle: string
  locationName: string
  markerId: string
  isCurrentEvent: boolean
}

export function CharacterFilmStrip({
  character,
  allMarkers,
  orderedEvents,
  chapters,
  activeEventId,
  onClose,
}: {
  character: Character
  allMarkers: LocationMarker[]
  orderedEvents: WorldEvent[]
  chapters: Chapter[]
  activeEventId: string | null
  onClose: () => void
}) {
  const { setActiveEventId } = useAppStore()
  const snapshots = useCharacterSnapshots(character.id)

  const stops = useMemo<FilmStripStop[]>(() => {
    if (snapshots.length === 0 || orderedEvents.length === 0) return []

    const chapterById = new Map(chapters.map((c) => [c.id, c]))

    // For each event that has a snapshot with a location, pick the best
    // (highest-order event in sequence). We want one entry per distinct
    // location run — deduplicate consecutive same-location stays.
    const snapByEvent = new Map(snapshots.map((s) => [s.eventId, s]))

    const stops: FilmStripStop[] = []
    let lastMarkerId: string | null = null

    for (const event of orderedEvents) {
      const snap = snapByEvent.get(event.id)
      if (!snap?.currentLocationMarkerId) continue
      if (snap.currentLocationMarkerId === lastMarkerId) continue
      const marker = allMarkers.find((m) => m.id === snap.currentLocationMarkerId)
      if (!marker) continue
      const chapter = chapterById.get(event.chapterId)
      if (!chapter) continue
      stops.push({
        eventId: event.id,
        chapterNumber: chapter.number,
        chapterTitle: chapter.title,
        locationName: marker.name,
        markerId: marker.id,
        isCurrentEvent: event.id === activeEventId,
      })
      lastMarkerId = snap.currentLocationMarkerId
    }
    return stops
  }, [snapshots, orderedEvents, chapters, allMarkers, activeEventId])

  if (stops.length === 0) return null

  return (
    <div className="absolute bottom-0 inset-x-0 z-[550] border-t border-[hsl(var(--border))] bg-[hsl(var(--card)/0.95)] backdrop-blur-sm">
      <div className="flex items-center gap-2 px-3 py-1.5">
        {/* Label */}
        <div className="shrink-0 flex items-center gap-1.5">
          <div
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ background: character.color ?? '#888' }}
          />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            {character.name}
          </span>
        </div>

        {/* Scrollable stop list */}
        <div className="flex flex-1 items-center gap-0 overflow-x-auto">
          {stops.map((stop, idx) => (
            <div key={stop.eventId} className="flex items-center shrink-0">
              {idx > 0 && (
                <div className="h-px w-6 shrink-0 bg-[hsl(var(--border))]" />
              )}
              <button
                onClick={() => setActiveEventId(stop.eventId)}
                title={`Ch.${stop.chapterNumber} — ${stop.chapterTitle}`}
                className={`flex flex-col items-center rounded px-2 py-1 transition-colors ${
                  stop.isCurrentEvent
                    ? 'bg-[hsl(var(--ring)/0.15)] text-[hsl(var(--foreground))]'
                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                }`}
              >
                <span
                  className={`mb-0.5 h-2 w-2 rounded-full shrink-0 ${stop.isCurrentEvent ? 'ring-2 ring-offset-1 ring-[hsl(var(--ring))]' : ''}`}
                  style={{ background: stop.isCurrentEvent ? (character.color ?? '#888') : 'hsl(var(--border))' }}
                />
                <span className="text-[9px] font-medium leading-tight whitespace-nowrap">
                  {stop.locationName}
                </span>
                <span className="text-[8px] leading-tight text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                  Ch.{stop.chapterNumber}
                </span>
              </button>
            </div>
          ))}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
