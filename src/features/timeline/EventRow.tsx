import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Trash2, ArrowUp, ArrowDown, MapPin, ExternalLink, Eye } from 'lucide-react'
import type { WorldEvent } from '@/types'
import { eventStatusConfig } from '@/lib/eventStatus'
import { charColor } from '@/lib/characterColor'
import { deleteEvent } from '@/db/hooks/useTimeline'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useAppStore } from '@/store'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { useReadAhead } from '@/components/useReadAhead'
import { Button } from '@/components/ui/button'
import { Menu, MenuItem } from '@/components/ui/menu'
import { PortraitImage } from '@/components/PortraitImage'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { cn } from '@/lib/utils'

interface EventRowProps {
  event: WorldEvent
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  /**
   * Said instead of "Move earlier"/"Move later" when the move leaves the
   * chapter, so a scene does not silently jump somewhere else (**F12**).
   */
  moveUpHint?: string
  moveDownHint?: string
  /** All event IDs in this chapter in order, for shift-click range selection */
  chapterEventIds: string[]
  /** This scene's chapter number, for the read-ahead guard on the cursor. */
  chapterNumber: number
}

export function EventRow({
  event, isFirst, isLast, onMoveUp, onMoveDown, moveUpHint, moveDownHint, chapterEventIds,
  chapterNumber,
}: EventRowProps) {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const gate = useGate()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { selectedEventIds, toggleEventSelected, selectEventRange, setLastSelectedEventId, lastSelectedEventId, activeEventId, setActiveEventId } = useAppStore()
  const { guardJump, readAheadDialog } = useReadAhead()
  const isHere = activeEventId === event.id
  const isSelected = selectedEventIds.has(event.id)
  const anySelected = selectedEventIds.size > 0

  const characters = useCharacters(event.worldId)
  const locationMarkers = useAllLocationMarkers(event.worldId)

  const involvedChars = characters.filter((c) => event.involvedCharacterIds.includes(c.id))
  const location = locationMarkers.find((m) => m.id === event.locationMarkerId) ?? null
  const povChar = characters.find((c) => c.id === event.povCharacterId) ?? null

  const hasMeta = involvedChars.length > 0 || location !== null || event.tags.length > 0
  /** What to call this scene in a control's name; untitled scenes have one too. */
  const sceneName = event.title || 'this untitled scene'

  function handleCheckboxClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (e.shiftKey && lastSelectedEventId && lastSelectedEventId !== event.id) {
      const fromIdx = chapterEventIds.indexOf(lastSelectedEventId)
      const toIdx = chapterEventIds.indexOf(event.id)
      if (fromIdx !== -1 && toIdx !== -1) {
        const [lo, hi] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx]
        selectEventRange(chapterEventIds.slice(lo, hi + 1))
        setLastSelectedEventId(event.id)
        return
      }
    }
    toggleEventSelected(event.id)
    setLastSelectedEventId(event.id)
  }

  return (
    <div className={cn('flex gap-0 group', isSelected && 'opacity-100')}>
      {/* Left gutter — checkbox or timeline dot */}
      <div className="flex w-6 shrink-0 flex-col items-center">
        {!gate.active && (
          <div
            className={cn(
              'pw-tap-row mt-2.5 shrink-0 flex items-center justify-center cursor-pointer',
              anySelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              'transition-opacity'
            )}
            onClick={handleCheckboxClick}
          >
            {/* Named but not pointer-gated — see the note in `ChapterRow`.
                `pw-tap-row` (HB-2c) gives it a 24x36 hit area on touch: the box
                itself is 12px, in a list whose rows are 40px apart. */}
            <input
              type="checkbox"
              aria-label={`Select scene ${event.title || 'Untitled'}`}
              checked={isSelected}
              onChange={() => {}} // controlled via onClick
              className="h-3 w-3 cursor-pointer accent-[hsl(var(--ring))]"
            />
          </div>
        )}
        <div className="flex-1 w-px bg-[hsl(var(--border))]" />
      </div>

      {/* Row body */}
      <div className={cn(
        'mb-1.5 flex-1 min-w-0 rounded-md border bg-[hsl(var(--background))] transition-colors',
        isSelected ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent)/0.3)]' : 'border-[hsl(var(--border))]'
      )}>
        {/* Header */}
        <div className="flex items-center gap-1 px-2 py-1.5">
          <button
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded
              ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
              : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />}
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: eventStatusConfig(event.status).color }}
              title={eventStatusConfig(event.status).label}
              aria-hidden="true"
            />
            {povChar && (
              <span
                className="inline-flex items-center gap-0.5 shrink-0"
                title={`POV: ${povChar.name}`}
                aria-label={`POV: ${povChar.name}`}
              >
                <Eye className="h-2.5 w-2.5" style={{ color: charColor(povChar) }} />
              </span>
            )}
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

          {/*
            WRUN-6: named after the scene they act on, not just "move up".
            Three of these per row and nine rows on an open chapter made 27
            controls announced as nothing but "button" — the largest block of
            nameless controls left in the app, and invisible to both existing
            sweeps: `buttonNames` builds a world with no scenes, and
            `controlNames` visits the Timeline with every chapter collapsed.
          */}
          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 hover:text-[hsl(var(--foreground))]"
            aria-label={moveUpHint ? `${moveUpHint}: ${sceneName}` : `Move ${sceneName} earlier`}
            title={moveUpHint ?? `Move ${sceneName} earlier`}
            disabled={isFirst} onClick={(e) => { e.stopPropagation(); onMoveUp() }}>
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 hover:text-[hsl(var(--foreground))]"
            aria-label={moveDownHint ? `${moveDownHint}: ${sceneName}` : `Move ${sceneName} later`}
            title={moveDownHint ?? `Move ${sceneName} later`}
            disabled={isLast} onClick={(e) => { e.stopPropagation(); onMoveDown() }}>
            <ArrowDown className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0"
            onClick={(e) => { e.stopPropagation(); navigate(`/worlds/${worldId}/timeline/${event.chapterId}`) }}
            aria-label={`Open the chapter holding ${sceneName}`}
            title="Open in chapter detail">
            <ExternalLink className="h-3 w-3" />
          </Button>
          {/*
            **TL-3's fifth site.** That review moved delete behind a menu on the
            chapter row, the scene card, the character header and the lore card,
            and missed this one — the Timeline's own scene row, where the bin
            sat at x=1378 with *open the chapter* at x=1354, both 20x20. Two
            writer runs filed the same sentence, because the guide says flatly
            that "nothing destructive sits in the row beside the everyday
            controls, so there is no trash icon to catch a stray click on the
            way to *open* or *move earlier*".

            Gated like the chapter row's: deleting a scene is the author's, and
            a reader borrowing the book has no business being offered it.
          */}
          {!gate.active && (
            <Menu label={`More actions for ${sceneName}`} triggerClassName="h-5 w-5">
              <MenuItem
                icon={Trash2}
                label="Delete scene"
                danger
                onClick={() => setConfirmOpen(true)}
              />
            </Menu>
          )}
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title={`Delete "${event.title || 'this scene'}"?`}
            onConfirm={() => deleteEvent(event.id)}
          />
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

            <div className="flex flex-wrap items-center gap-1.5 self-start mt-0.5">
              {/*
                W-4: the Timeline could not put the cursor on a scene.

                The guide said *"click a scene to move the time cursor to that
                exact moment"*, and a click expands the row — a writer lost
                twenty minutes assuming they were clicking the wrong pixel,
                because the time cursor is what the whole app is built around
                and its main screen would not set it. The only per-scene control
                anywhere was a 22×24px tick in the bottom bar, 24 of them across
                1,100px.

                The click still expands, deliberately: browsing the timeline
                must not drag a global cursor around as a side effect. This is
                the explicit act, named as the chapter row above already names
                it, and it carries the same read-ahead guard — the chapter row's
                own comment records a jump that skipped the question and took
                *Monte Cristo* from 6 characters met to 41.
              */}
              <Button
                size="sm"
                variant={isHere ? 'secondary' : 'outline'}
                className="gap-1.5 text-xs"
                disabled={isHere}
                onClick={() => guardJump(chapterNumber, () => setActiveEventId(event.id))}
                title={isHere
                  ? 'The time cursor is on this scene'
                  : gate.active
                    ? `Mark ${sceneName} as where you have read up to`
                    : `Move the time cursor to ${sceneName}`}
              >
                <Eye className="h-3 w-3" />
                {isHere
                  ? (gate.active ? 'Reading here' : 'Viewing')
                  : (gate.active ? 'Read to here' : 'View from here')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => navigate(`/worlds/${worldId}/timeline/${event.chapterId}`)}
              >
                <ExternalLink className="h-3 w-3" /> Edit in chapter detail
              </Button>
            </div>
            {readAheadDialog}
          </div>
        )}
      </div>
    </div>
  )
}
