import { useParams } from 'react-router-dom'
import { Heart, Skull, MapPin, Minus } from 'lucide-react'
import { useTimelines, useWorldChapters } from '@/db/hooks/useTimeline'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useWorldSnapshots } from '@/db/hooks/useSnapshots'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/EmptyState'
import { BookOpen } from 'lucide-react'

export default function CharacterArcView() {
  const { worldId } = useParams<{ worldId: string }>()
  const { activeEventId, setActiveEventId } = useAppStore()

  const timelines  = useTimelines(worldId ?? null)
  const chapters   = useWorldChapters(worldId ?? null)
  const characters = useCharacters(worldId ?? null)
  const snapshots  = useWorldSnapshots(worldId ?? null)
  const markers    = useAllLocationMarkers(worldId ?? null)

  // Sort chapters by timeline order then chapter number
  const timelineOrder = new Map(timelines.map((tl, i) => [tl.id, i]))
  const sortedChapters = [...chapters].sort((a, b) => {
    const tlDiff = (timelineOrder.get(a.timelineId) ?? 0) - (timelineOrder.get(b.timelineId) ?? 0)
    return tlDiff !== 0 ? tlDiff : a.number - b.number
  })

  const markerById = new Map(markers.map((m) => [m.id, m]))

  // Build lookup: snapByCharAndChap[characterId][eventId]
  const snapMap = new Map<string, Map<string, typeof snapshots[0]>>()
  for (const snap of snapshots) {
    if (!snapMap.has(snap.characterId)) snapMap.set(snap.characterId, new Map())
    snapMap.get(snap.characterId)!.set(snap.eventId, snap)
  }

  if (characters.length === 0 || sortedChapters.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Nothing to show"
        description="Add characters and chapters to see the arc view."
        className="h-full"
      />
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5">
        <span className="text-sm font-semibold">Character Arc</span>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">{characters.length} characters · {sortedChapters.length} chapters</span>
        {activeEventId && (
          <button
            className="ml-auto text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] underline"
            onClick={() => setActiveEventId(null)}
          >
            Clear chapter filter
          </button>
        )}
      </div>

      {/* Scrollable table */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
          <thead className="sticky top-0 z-10 bg-[hsl(var(--card))]">
            <tr>
              {/* Sticky name column header */}
              <th className="sticky left-0 z-20 min-w-[160px] max-w-[160px] border-b border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))]">
                Character
              </th>
              {sortedChapters.map((ch) => {
                const isActive = ch.id === activeEventId
                return (
                  <th
                    key={ch.id}
                    className={cn(
                      'min-w-[110px] max-w-[110px] cursor-pointer border-b border-r border-[hsl(var(--border))] px-2 py-2 text-center font-medium transition-colors',
                      isActive
                        ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                        : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]'
                    )}
                    onClick={() => setActiveEventId(isActive ? null : ch.id)}
                    title={`Ch. ${ch.number} — ${ch.title}`}
                  >
                    <div className="truncate font-semibold">Ch. {ch.number}</div>
                    <div className="truncate text-[10px] opacity-75">{ch.title}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {characters.map((char, rowIdx) => {
              const charSnaps = snapMap.get(char.id)
              return (
                <tr
                  key={char.id}
                  className={cn(
                    rowIdx % 2 === 0
                      ? 'bg-[hsl(var(--background))]'
                      : 'bg-[hsl(var(--card))]'
                  )}
                >
                  {/* Sticky character name */}
                  <td className="sticky left-0 z-10 min-w-[160px] max-w-[160px] border-b border-r border-[hsl(var(--border))] bg-inherit px-3 py-2 font-medium">
                    <span className="block truncate">{char.name}</span>
                  </td>

                  {sortedChapters.map((ch) => {
                    const snap = charSnaps?.get(ch.id)
                    const isActive = ch.id === activeEventId

                    if (!snap) {
                      return (
                        <td
                          key={ch.id}
                          className={cn(
                            'min-w-[110px] max-w-[110px] border-b border-r border-[hsl(var(--border))] px-2 py-1.5 text-center',
                            isActive && 'bg-[hsl(var(--accent)/0.15)]'
                          )}
                        >
                          <Minus className="mx-auto h-3 w-3 text-[hsl(var(--border))]" />
                        </td>
                      )
                    }

                    const location = snap.currentLocationMarkerId
                      ? markerById.get(snap.currentLocationMarkerId)
                      : null

                    return (
                      <td
                        key={ch.id}
                        className={cn(
                          'min-w-[110px] max-w-[110px] border-b border-r border-[hsl(var(--border))] px-2 py-1.5',
                          isActive && 'bg-[hsl(var(--accent)/0.15)]',
                          !snap.isAlive && 'opacity-50'
                        )}
                      >
                        <div className="flex items-center gap-1">
                          {snap.isAlive
                            ? <Heart className="h-2.5 w-2.5 shrink-0 text-green-400" />
                            : <Skull className="h-2.5 w-2.5 shrink-0 text-red-400" />
                          }
                          <span className={cn(
                            'truncate',
                            snap.isAlive ? 'text-[hsl(var(--foreground))]' : 'line-through text-[hsl(var(--muted-foreground))]'
                          )}>
                            {snap.isAlive ? 'Alive' : 'Dead'}
                          </span>
                        </div>
                        {location && (
                          <div className="mt-0.5 flex items-center gap-1 text-[hsl(var(--muted-foreground))]">
                            <MapPin className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate text-[10px]">{location.name}</span>
                          </div>
                        )}
                        {snap.statusNotes && (
                          <p className="mt-0.5 truncate text-[10px] italic text-[hsl(var(--muted-foreground))]" title={snap.statusNotes}>
                            {snap.statusNotes}
                          </p>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
        <div className="flex items-center gap-1"><Heart className="h-2.5 w-2.5 text-green-400" /> Alive</div>
        <div className="flex items-center gap-1"><Skull className="h-2.5 w-2.5 text-red-400" /> Dead</div>
        <div className="flex items-center gap-1"><Minus className="h-2.5 w-2.5 text-[hsl(var(--border))]" /> No snapshot</div>
        <div className="ml-auto">Click a chapter column to set it as the active chapter cursor</div>
      </div>
    </div>
  )
}
