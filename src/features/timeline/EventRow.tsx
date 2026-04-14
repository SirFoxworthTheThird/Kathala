import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Trash2, ArrowUp, ArrowDown, MapPin, ExternalLink } from 'lucide-react'
import type { WorldEvent } from '@/types'
import { deleteEvent } from '@/db/hooks/useTimeline'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { Button } from '@/components/ui/button'
import { PortraitImage } from '@/components/PortraitImage'

interface EventRowProps {
  event: WorldEvent
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}

export function EventRow({ event, isFirst, isLast, onMoveUp, onMoveDown }: EventRowProps) {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)

  const characters = useCharacters(event.worldId)
  const locationMarkers = useAllLocationMarkers(event.worldId)

  const involvedChars = characters.filter((c) => event.involvedCharacterIds.includes(c.id))
  const location = locationMarkers.find((m) => m.id === event.locationMarkerId) ?? null

  const hasMeta = involvedChars.length > 0 || location !== null || event.tags.length > 0

  return (
    <div className="flex gap-0">
      {/* Left gutter — timeline connector */}
      <div className="flex w-6 shrink-0 flex-col items-center">
        <div className="mt-3.5 h-2 w-2 rounded-full bg-[hsl(var(--muted-foreground))] opacity-40 shrink-0" />
        <div className="flex-1 w-px bg-[hsl(var(--border))]" />
      </div>

      {/* Row body */}
      <div className="mb-1.5 flex-1 min-w-0 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
        {/* Header */}
        <div className="flex items-center gap-1 px-2 py-1.5">
          <button
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded
              ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
              : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />}
            <span className="text-xs font-medium text-[hsl(var(--foreground))] truncate">{event.title}</span>
          </button>

          {/* Meta chips (collapsed only, when not expanded) */}
          {!expanded && hasMeta && (
            <div className="hidden sm:flex items-center gap-1 shrink-0 overflow-hidden max-w-[40%]">
              {involvedChars.slice(0, 2).map((c) => (
                <PortraitImage
                  key={c.id}
                  imageId={c.portraitImageId}
                  alt={c.name}
                  className="h-4 w-4 rounded-full object-cover"
                  fallbackClassName="h-4 w-4 rounded-full opacity-60"
                />
              ))}
              {involvedChars.length > 2 && (
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">+{involvedChars.length - 2}</span>
              )}
              {location && (
                <span className="flex items-center gap-0.5 text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">
                  <MapPin className="h-2.5 w-2.5" />{location.name}
                </span>
              )}
              {event.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="rounded-full bg-[hsl(var(--accent))] px-1.5 py-px text-[10px] shrink-0">#{tag}</span>
              ))}
            </div>
          )}

          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 hover:text-[hsl(var(--foreground))]"
            disabled={isFirst} onClick={(e) => { e.stopPropagation(); onMoveUp() }}>
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 hover:text-[hsl(var(--foreground))]"
            disabled={isLast} onClick={(e) => { e.stopPropagation(); onMoveDown() }}>
            <ArrowDown className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0"
            onClick={(e) => { e.stopPropagation(); navigate(`/worlds/${worldId}/timeline/${event.chapterId}`) }}
            title="Open in chapter detail">
            <ExternalLink className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 hover:text-red-400"
            onClick={(e) => { e.stopPropagation(); if (confirm(`Delete event "${event.title}"?`)) deleteEvent(event.id) }}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="border-t border-[hsl(var(--border))] px-3 py-2.5 flex flex-col gap-2">
            {/* Description */}
            {event.description ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] whitespace-pre-wrap leading-relaxed">{event.description}</p>
            ) : (
              <p className="text-xs italic text-[hsl(var(--muted-foreground))]">No description.</p>
            )}

            {/* Meta row */}
            {hasMeta && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[hsl(var(--border))]">
                {involvedChars.map((c) => (
                  <div key={c.id} className="flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] pl-0.5 pr-2 py-0.5">
                    <PortraitImage
                      imageId={c.portraitImageId}
                      className="h-4 w-4 rounded-full object-cover"
                      fallbackClassName="h-4 w-4 rounded-full"
                    />
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{c.name}</span>
                  </div>
                ))}
                {location && (
                  <div className="flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] px-2 py-0.5">
                    <MapPin className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{location.name}</span>
                  </div>
                )}
                {event.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-[hsl(var(--accent))] px-2 py-0.5 text-[10px]">#{tag}</span>
                ))}
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs self-start mt-0.5"
              onClick={() => navigate(`/worlds/${worldId}/timeline/${event.chapterId}`)}
            >
              <ExternalLink className="h-3 w-3" /> Edit in chapter detail
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
