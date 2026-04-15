import { useState, useRef, useCallback } from 'react'
import { toPng } from 'html-to-image'
import { useParams } from 'react-router-dom'
import { Heart, Skull, MapPin, Minus, Search, Download, X } from 'lucide-react'
import { useTimelines, useWorldChapters, useWorldEvents } from '@/db/hooks/useTimeline'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useWorldSnapshots } from '@/db/hooks/useSnapshots'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/EmptyState'
import { BookOpen } from 'lucide-react'
import type { Character } from '@/types'

// ── Colour helpers ────────────────────────────────────────────────────────────

/** Deterministic hue from character id — used as fallback when no explicit color set */
function idToHue(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return h % 360
}

function charColor(char: Character): string {
  return char.color ?? `hsl(${idToHue(char.id)}, 60%, 55%)`
}

// ── Inventory sparkline (pure SVG, no library) ────────────────────────────────

function InventorySparkline({ counts }: { counts: number[] }) {
  if (counts.length < 2) return null
  const max = Math.max(...counts, 1)
  const W = 48, H = 16, pad = 1
  const points = counts.map((v, i) => {
    const x = pad + (i / (counts.length - 1)) * (W - pad * 2)
    const y = H - pad - ((v / max) * (H - pad * 2))
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg width={W} height={H} className="block opacity-60" aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CharacterArcView() {
  const { worldId } = useParams<{ worldId: string }>()
  const { activeEventId, setActiveEventId } = useAppStore()
  const [viewMode, setViewMode]             = useState<'chapter' | 'event'>('chapter')
  const [filterText, setFilterText]         = useState('')
  const [expandedKey, setExpandedKey]       = useState<string | null>(null) // `${charId}:${colId}`
  const [selectedTimelineId, setSelectedTimelineId] = useState<string | null>(null) // null = all
  const tableRef = useRef<HTMLDivElement>(null)

  const timelines  = useTimelines(worldId ?? null)
  const chapters   = useWorldChapters(worldId ?? null)
  const allEvents  = useWorldEvents(worldId ?? null)
  const characters = useCharacters(worldId ?? null)
  const snapshots  = useWorldSnapshots(worldId ?? null)
  const markers    = useAllLocationMarkers(worldId ?? null)

  // Sort chapters by timeline order then chapter number
  const timelineOrder  = new Map(timelines.map((tl, i) => [tl.id, i]))
  const allSortedChapters = [...chapters].sort((a, b) => {
    const tlDiff = (timelineOrder.get(a.timelineId) ?? 0) - (timelineOrder.get(b.timelineId) ?? 0)
    return tlDiff !== 0 ? tlDiff : a.number - b.number
  })

  const chapterById = new Map(chapters.map((c) => [c.id, c]))
  const markerById  = new Map(markers.map((m) => [m.id, m]))

  // Derive active chapter from active event
  const activeEvent     = allEvents.find((e) => e.id === activeEventId) ?? null
  const activeChapterId = activeEvent?.chapterId ?? null

  // All events sorted by (timeline order → chapter number → sortOrder)
  const allSortedEvents = [...allEvents].sort((a, b) => {
    const chA = chapterById.get(a.chapterId)
    const chB = chapterById.get(b.chapterId)
    const tlDiff = (timelineOrder.get(chA?.timelineId ?? '') ?? 0) - (timelineOrder.get(chB?.timelineId ?? '') ?? 0)
    if (tlDiff !== 0) return tlDiff
    const chDiff = (chA?.number ?? 0) - (chB?.number ?? 0)
    return chDiff !== 0 ? chDiff : a.sortOrder - b.sortOrder
  })

  // Apply timeline filter to columns (chapters / events shown)
  const sortedChapters = selectedTimelineId
    ? allSortedChapters.filter((ch) => ch.timelineId === selectedTimelineId)
    : allSortedChapters
  const sortedEvents = selectedTimelineId
    ? allSortedEvents.filter((ev) => chapterById.get(ev.chapterId)?.timelineId === selectedTimelineId)
    : allSortedEvents

  // Map chapter → last / first event ID (from ALL events, for click-to-activate)
  const lastEventByChapter  = new Map<string, string>()
  const firstEventByChapter = new Map<string, string>()
  for (const ev of allEvents) {
    const curLast  = lastEventByChapter.get(ev.chapterId)
    const curFirst = firstEventByChapter.get(ev.chapterId)
    const curLastEv  = curLast  ? allEvents.find((e) => e.id === curLast)  : undefined
    const curFirstEv = curFirst ? allEvents.find((e) => e.id === curFirst) : undefined
    if (!curLastEv  || ev.sortOrder > curLastEv.sortOrder)  lastEventByChapter.set(ev.chapterId, ev.id)
    if (!curFirstEv || ev.sortOrder < curFirstEv.sortOrder) firstEventByChapter.set(ev.chapterId, ev.id)
  }

  // ── Snapshot inheritance ────────────────────────────────────────────────────
  // Position map: eventId → index in allSortedEvents (cross-timeline ordering).
  // We use allSortedEvents (not the filtered view) so inheritance is correct even
  // when a snapshot lives on a timeline that's currently hidden.
  const eventPosition = new Map(allSortedEvents.map((ev, i) => [ev.id, i]))

  // Per-character: sorted array of { pos, snap } — built once, reused per cell.
  type SnapEntry = { pos: number; snap: typeof snapshots[0] }
  const sortedSnapsByChar = new Map<string, SnapEntry[]>()
  for (const snap of snapshots) {
    const pos = eventPosition.get(snap.eventId)
    if (pos === undefined) continue
    if (!sortedSnapsByChar.has(snap.characterId)) sortedSnapsByChar.set(snap.characterId, [])
    sortedSnapsByChar.get(snap.characterId)!.push({ pos, snap })
  }
  for (const arr of sortedSnapsByChar.values()) arr.sort((a, b) => a.pos - b.pos)

  /** Best inherited snapshot at or before the given event position. */
  function getBestSnap(charId: string, targetPos: number) {
    const arr = sortedSnapsByChar.get(charId)
    if (!arr) return undefined
    let best: typeof snapshots[0] | undefined
    for (const { pos, snap } of arr) {
      if (pos <= targetPos) best = snap
      else break
    }
    return best
  }

  // Inventory count sparkline — uses inheritance across ALL events for the full shape
  const sparklineData = new Map<string, number[]>()
  for (const char of characters) {
    sparklineData.set(char.id, allSortedEvents.map((ev) => {
      const pos = eventPosition.get(ev.id) ?? 0
      return getBestSnap(char.id, pos)?.inventoryItemIds.length ?? 0
    }))
  }

  // Filtered character list
  const q = filterText.trim().toLowerCase()
  const displayedChars = q
    ? characters.filter((c) => c.name.toLowerCase().includes(q))
    : characters

  const multiTimeline = timelines.length > 1

  // Export to PNG
  const handleExport = useCallback(async () => {
    const el = tableRef.current
    if (!el) return
    const prevOverflow = el.style.overflow
    el.style.overflow = 'visible'
    try {
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        width: el.scrollWidth,
        height: el.scrollHeight,
      })
      const link = document.createElement('a')
      link.download = 'character-arc.png'
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('PNG export failed:', err)
      alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      el.style.overflow = prevOverflow
    }
  }, [])

  if (characters.length === 0) {
    return (
      <EmptyState icon={BookOpen} title="Nothing to show" description="Add characters to get started." className="h-full" />
    )
  }
  if (sortedChapters.length === 0) {
    return (
      <EmptyState icon={BookOpen} title="Nothing to show" description="Add chapters to your timeline to see the arc." className="h-full" />
    )
  }
  if (snapshots.length === 0) {
    return (
      <EmptyState icon={BookOpen} title="No snapshots yet" description="Select an event and save character state to start tracking the arc." className="h-full" />
    )
  }

  const colWidth = viewMode === 'event' ? 100 : 110

  // Build timeline header spans: [{timeline, colSpan}] for the header row
  const timelineSpans = (() => {
    const cols = viewMode === 'chapter' ? sortedChapters : sortedEvents
    const spans: Array<{ id: string; name: string; colSpan: number }> = []
    for (const col of cols) {
      const tlId   = viewMode === 'chapter'
        ? (col as typeof sortedChapters[0]).timelineId
        : (chapterById.get((col as typeof sortedEvents[0]).chapterId)?.timelineId ?? '')
      const tlName = timelines.find((t) => t.id === tlId)?.name ?? tlId
      if (spans.length && spans[spans.length - 1].id === tlId) {
        spans[spans.length - 1].colSpan++
      } else {
        spans.push({ id: tlId, name: tlName, colSpan: 1 })
      }
    }
    return spans
  })()

  function toggleExpand(charId: string, colId: string) {
    const key = `${charId}:${colId}`
    setExpandedKey((prev) => (prev === key ? null : key))
  }

  function SnapCell({ snap, isActive, charId, colId }: {
    snap: typeof snapshots[0] | undefined
    isActive: boolean
    charId: string
    colId: string
  }) {
    const key = `${charId}:${colId}`
    const isExpanded = expandedKey === key

    if (!snap) {
      return (
        <td
          style={{ minWidth: colWidth, maxWidth: colWidth }}
          className={cn(
            'border-b border-r border-[hsl(var(--border))] px-2 py-1.5 text-center',
            isActive && 'bg-[hsl(var(--accent)/0.15)]'
          )}
        >
          <Minus className="mx-auto h-3 w-3 text-[hsl(var(--border))]" />
        </td>
      )
    }

    const location = snap.currentLocationMarkerId ? markerById.get(snap.currentLocationMarkerId) : null
    const hasNotes = !!snap.statusNotes

    return (
      <td
        style={{ minWidth: colWidth, maxWidth: colWidth }}
        className={cn(
          'border-b border-r border-[hsl(var(--border))] px-2 py-1.5',
          isActive && 'bg-[hsl(var(--accent)/0.15)]',
          !snap.isAlive && 'opacity-50',
          hasNotes && 'cursor-pointer hover:bg-[hsl(var(--accent)/0.08)]'
        )}
        onClick={() => hasNotes && toggleExpand(charId, colId)}
        title={hasNotes && !isExpanded ? snap.statusNotes : undefined}
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
          <p className={cn(
            'mt-0.5 text-[10px] italic text-[hsl(var(--muted-foreground))]',
            isExpanded ? 'whitespace-pre-wrap break-words' : 'truncate'
          )}>
            {snap.statusNotes}
          </p>
        )}
      </td>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5">
        <span className="text-sm font-semibold">Character Arc</span>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {displayedChars.length}{q ? `/${characters.length}` : ''} chars ·{' '}
          {viewMode === 'chapter' ? `${sortedChapters.length} ch` : `${sortedEvents.length} ev`}
        </span>

        {/* View toggle */}
        <div className="ml-1 flex rounded-md border border-[hsl(var(--border))] overflow-hidden text-xs">
          <button
            className={cn(
              'px-2.5 py-1 transition-colors',
              viewMode === 'chapter'
                ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]'
            )}
            onClick={() => setViewMode('chapter')}
          >
            Chapters
          </button>
          <button
            className={cn(
              'px-2.5 py-1 border-l border-[hsl(var(--border))] transition-colors',
              viewMode === 'event'
                ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]'
            )}
            onClick={() => setViewMode('event')}
          >
            Events
          </button>
        </div>

        {/* Timeline filter pills — only shown when world has multiple timelines */}
        {multiTimeline && (
          <div className="ml-1 flex items-center gap-1">
            <button
              className={cn(
                'rounded px-2 py-0.5 text-xs transition-colors border',
                selectedTimelineId === null
                  ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                  : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]'
              )}
              onClick={() => setSelectedTimelineId(null)}
            >
              All
            </button>
            {timelines.map((tl) => (
              <button
                key={tl.id}
                className={cn(
                  'rounded px-2 py-0.5 text-xs transition-colors border',
                  selectedTimelineId === tl.id
                    ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                    : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]'
                )}
                onClick={() => setSelectedTimelineId(tl.id)}
              >
                {tl.name}
              </button>
            ))}
          </div>
        )}

        {/* Character filter */}
        <div className="relative ml-1 flex items-center">
          <Search className="pointer-events-none absolute left-2 h-3 w-3 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter characters…"
            className="h-7 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] pl-6 pr-6 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
          {filterText && (
            <button
              className="absolute right-1.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              onClick={() => setFilterText('')}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {activeEventId && (
            <button
              className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] underline"
              onClick={() => setActiveEventId(null)}
            >
              Clear filter
            </button>
          )}
          <button
            onClick={handleExport}
            className="flex items-center gap-1 rounded-md border border-[hsl(var(--border))] px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent)/0.4)] transition-colors"
            title="Export arc as PNG"
          >
            <Download className="h-3 w-3" />
            PNG
          </button>
        </div>
      </div>

      {/* Scrollable table */}
      <div ref={tableRef} className="flex-1 overflow-auto">
        <table className="border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
          <thead className="sticky top-0 z-10 bg-[hsl(var(--card))]">
            {/* Timeline header row — only rendered when multiple timelines exist */}
            {multiTimeline && (
              <tr>
                <th className="sticky left-0 z-20 min-w-[180px] max-w-[180px] border-b border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]" />
                {timelineSpans.map((span) => (
                  <th
                    key={span.id}
                    colSpan={span.colSpan}
                    className="border-b border-r border-[hsl(var(--border))] bg-[hsl(var(--accent)/0.12)] px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]"
                  >
                    {span.name}
                  </th>
                ))}
              </tr>
            )}
            <tr>
              <th className="sticky left-0 z-20 min-w-[180px] max-w-[180px] border-b border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))]">
                Character
              </th>

              {viewMode === 'chapter' && sortedChapters.map((ch) => {
                const isActive = ch.id === activeChapterId
                return (
                  <th
                    key={ch.id}
                    style={{ minWidth: colWidth, maxWidth: colWidth }}
                    className={cn(
                      'cursor-pointer border-b border-r border-[hsl(var(--border))] px-2 py-2 text-center font-medium transition-colors',
                      isActive
                        ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                        : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]'
                    )}
                    onClick={() => {
                      if (isActive) { setActiveEventId(null); return }
                      const firstEv = firstEventByChapter.get(ch.id)
                      if (firstEv) setActiveEventId(firstEv)
                    }}
                    title={`Ch. ${ch.number} — ${ch.title}`}
                  >
                    <div className="truncate font-semibold">Ch. {ch.number}</div>
                    <div className="truncate text-[10px] opacity-75">{ch.title}</div>
                  </th>
                )
              })}

              {viewMode === 'event' && sortedEvents.map((ev) => {
                const ch = chapterById.get(ev.chapterId)
                const isActive = ev.id === activeEventId
                return (
                  <th
                    key={ev.id}
                    style={{ minWidth: colWidth, maxWidth: colWidth }}
                    className={cn(
                      'cursor-pointer border-b border-r border-[hsl(var(--border))] px-2 py-2 text-center font-medium transition-colors',
                      isActive
                        ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                        : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]'
                    )}
                    onClick={() => setActiveEventId(isActive ? null : ev.id)}
                    title={`Ch. ${ch?.number ?? '?'} — ${ev.title}`}
                  >
                    <div className="truncate text-[10px] opacity-60">Ch. {ch?.number ?? '?'}</div>
                    <div className="truncate font-semibold">{ev.title || <span className="italic opacity-50">untitled</span>}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {displayedChars.map((char, rowIdx) => {
              const color     = charColor(char)
              const sparkline = sparklineData.get(char.id) ?? []

              return (
                <tr
                  key={char.id}
                  className={cn(
                    rowIdx % 2 === 0 ? 'bg-[hsl(var(--background))]' : 'bg-[hsl(var(--card))]'
                  )}
                >
                  {/* Name cell — left colour border + sparkline */}
                  <td
                    className="sticky left-0 z-10 min-w-[180px] max-w-[180px] border-b border-r border-[hsl(var(--border))] bg-inherit px-3 py-2"
                    style={{ borderLeft: `3px solid ${color}` }}
                  >
                    <span className="block truncate font-medium">{char.name}</span>
                    <div className="mt-1 text-[hsl(var(--muted-foreground))]">
                      <InventorySparkline counts={sparkline} />
                    </div>
                  </td>

                  {viewMode === 'chapter' && sortedChapters.map((ch) => {
                    const lastEvId = lastEventByChapter.get(ch.id)
                    const targetPos = lastEvId !== undefined ? (eventPosition.get(lastEvId) ?? -1) : -1
                    const snap = targetPos >= 0 ? getBestSnap(char.id, targetPos) : undefined
                    return <SnapCell key={ch.id} colId={ch.id} charId={char.id} snap={snap} isActive={ch.id === activeChapterId} />
                  })}

                  {viewMode === 'event' && sortedEvents.map((ev) => {
                    const targetPos = eventPosition.get(ev.id) ?? -1
                    const snap = targetPos >= 0 ? getBestSnap(char.id, targetPos) : undefined
                    return <SnapCell key={ev.id} colId={ev.id} charId={char.id} snap={snap} isActive={ev.id === activeEventId} />
                  })}
                </tr>
              )
            })}
            {displayedChars.length === 0 && (
              <tr>
                <td colSpan={99} className="py-8 text-center text-xs text-[hsl(var(--muted-foreground))] italic">
                  No characters match "{filterText}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
        <div className="flex items-center gap-1"><Heart className="h-2.5 w-2.5 text-green-400" /> Alive</div>
        <div className="flex items-center gap-1"><Skull className="h-2.5 w-2.5 text-red-400" /> Dead</div>
        <div className="flex items-center gap-1"><Minus className="h-2.5 w-2.5 text-[hsl(var(--border))]" /> No snapshot</div>
        <div className="ml-auto">Click a column to set cursor · Click a notes cell to expand</div>
      </div>
    </div>
  )
}
