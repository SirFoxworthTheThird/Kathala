import { X, BookOpen, Users, Network, Package, Scroll, MapPin, Heart, Skull, ChevronRight, BookMarked } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '@/store'
import { useChapter, useEvent, useEvents } from '@/db/hooks/useTimeline'
import { useBestSnapshots } from '@/db/hooks/useSnapshots'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useRelationships } from '@/db/hooks/useRelationships'
import { useBestRelationshipSnapshots } from '@/db/hooks/useRelationshipSnapshots'
import { useItems } from '@/db/hooks/useItems'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useLorePages } from '@/db/hooks/useLore'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { cn } from '@/lib/utils'

function Section({ title, icon: Icon, count, children }: {
  title: string
  icon: React.ElementType
  count?: number
  children: React.ReactNode
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{title}</span>
        {count !== undefined && (
          <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">{count}</span>
        )}
      </div>
      {children}
    </div>
  )
}

export function WritersBriefPanel() {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const { briefOpen, setBriefOpen, activeEventId } = useAppStore()

  const activeEvent = useEvent(activeEventId)
  const chapter    = useChapter(activeEvent?.chapterId ?? null)
  const events     = useEvents(activeEvent?.chapterId ?? null)
  const snapshots  = useBestSnapshots(worldId ?? null, activeEventId)
  const characters = useCharacters(worldId ?? null)
  const rels       = useRelationships(worldId ?? null)
  const relSnaps   = useBestRelationshipSnapshots(worldId ?? null, activeEventId)
  const items      = useItems(worldId ?? null)
  const markers    = useAllLocationMarkers(worldId ?? null)
  const allLorePages = useLorePages(worldId ?? null)
  const itemPlacements = useLiveQuery(
    () => activeEventId ? db.itemPlacements.where('eventId').equals(activeEventId).toArray() : [],
    [activeEventId],
    []
  )

  if (!briefOpen) return null

  const charById  = new Map(characters.map((c) => [c.id, c]))
  const itemById  = new Map(items.map((i) => [i.id, i]))
  const markerById = new Map(markers.map((m) => [m.id, m]))

  // Characters present this chapter (have a snapshot)
  const presentChars = snapshots
    .map((s) => ({ snap: s, char: charById.get(s.characterId) }))
    .filter((x): x is { snap: typeof snapshots[0]; char: NonNullable<ReturnType<typeof charById.get>> } => !!x.char)
    .sort((a, b) => a.char.name.localeCompare(b.char.name))

  // Relationships with a snapshot this chapter
  const relSnapsWithNames = relSnaps
    .map((rs) => {
      const rel = rels.find((r) => r.id === rs.relationshipId)
      if (!rel) return null
      const charA = charById.get(rel.characterAId)
      const charB = charById.get(rel.characterBId)
      if (!charA || !charB) return null
      return { rs, rel, charA, charB }
    })
    .filter(Boolean) as NonNullable<{ rs: typeof relSnaps[0]; rel: typeof rels[0]; charA: NonNullable<ReturnType<typeof charById.get>>; charB: NonNullable<ReturnType<typeof charById.get>> }>[]

  // Items in play this chapter
  const placedItems = itemPlacements
    .map((p) => ({ placement: p, item: itemById.get(p.itemId), location: markerById.get(p.locationMarkerId) }))
    .filter((x) => !!x.item)

  // Lore: pages linked to present characters OR revealed at this event
  const presentCharIds = new Set(snapshots.map((s) => s.characterId))
  const relevantLore = allLorePages.filter((p) => {
    const linkedToPresent = (p.linkedEntityIds ?? []).some((id) => presentCharIds.has(id))
    const revealedNow = p.visibleFromEventId === activeEventId
    return linkedToPresent || revealedNow
  })

  const sentimentColor: Record<string, string> = {
    positive: 'text-green-400',
    neutral:  'text-[hsl(var(--muted-foreground))]',
    negative: 'text-red-400',
    complex:  'text-yellow-400',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[3000] bg-black/30"
        onClick={() => setBriefOpen(false)}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-[3001] flex h-screen w-80 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-4 py-3">
          <BookOpen className="h-4 w-4 text-[hsl(var(--accent-foreground))]" />
          <span className="text-sm font-semibold">Writer's Brief</span>
          <button
            className="ml-auto text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            onClick={() => setBriefOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-4 py-3">
          {!activeEventId ? (
            <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
              Select an event from the timeline bar to see the brief.
            </p>
          ) : !chapter ? (
            <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
          ) : (
            <>
              {/* Chapter + active event header */}
              <div className="mb-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5">
                <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Chapter {chapter.number}</p>
                <p className="text-sm font-bold text-[hsl(var(--foreground))]">{chapter.title}</p>
                {chapter.synopsis && (
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{chapter.synopsis}</p>
                )}
                {activeEvent?.title && (
                  <div className="mt-2 border-t border-[hsl(var(--border))] pt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Active Event</p>
                    <p className="text-xs font-medium text-[hsl(var(--foreground))]">{activeEvent.title}</p>
                    {activeEvent.description && (
                      <p className="mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))] leading-relaxed">{activeEvent.description}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Events */}
              <Section title="Events" icon={Scroll} count={events.length}>
                {events.length === 0 ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">No events in this chapter yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {[...events].sort((a, b) => a.sortOrder - b.sortOrder).map((ev) => {
                      const isActive = ev.id === activeEventId
                      return (
                        <li
                          key={ev.id}
                          className={cn(
                            'flex items-start gap-2 rounded px-1.5 py-1 text-xs',
                            isActive
                              ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))] font-medium'
                              : 'text-[hsl(var(--muted-foreground))]'
                          )}
                        >
                          <ChevronRight className={cn('mt-0.5 h-3 w-3 shrink-0', isActive ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]')} />
                          <span>{ev.title}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Section>

              {/* Characters present */}
              <Section title="Characters" icon={Users} count={presentChars.length}>
                {presentChars.length === 0 ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {characters.length === 0
                      ? 'No characters created yet.'
                      : 'No character states recorded for this event.'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {presentChars.map(({ snap, char }) => {
                      const location = snap.currentLocationMarkerId ? markerById.get(snap.currentLocationMarkerId) : null
                      const inventoryItems = snap.inventoryItemIds
                        .map((id) => itemById.get(id))
                        .filter(Boolean)
                      return (
                        <div key={char.id} className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-2 text-xs">
                          <div className="flex items-center gap-1.5 font-medium">
                            {snap.isAlive
                              ? <Heart className="h-3 w-3 text-green-400" />
                              : <Skull className="h-3 w-3 text-red-400" />
                            }
                            <span className={cn(!snap.isAlive && 'line-through text-[hsl(var(--muted-foreground))]')}>{char.name}</span>
                          </div>
                          {location && (
                            <div className="mt-1 flex items-center gap-1 text-[hsl(var(--muted-foreground))]">
                              <MapPin className="h-2.5 w-2.5" />
                              <span>{location.name}</span>
                            </div>
                          )}
                          {snap.statusNotes && (
                            <p className="mt-1 text-[hsl(var(--muted-foreground))] italic leading-relaxed">{snap.statusNotes}</p>
                          )}
                          {inventoryItems.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {inventoryItems.map((item) => (
                                <span key={item!.id} className="rounded bg-[hsl(var(--accent)/0.4)] px-1.5 py-0.5 text-[10px]">{item!.name}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Section>

              {/* Relationships */}
              {relSnapsWithNames.length > 0 && (
                <Section title="Relationships" icon={Network} count={relSnapsWithNames.length}>
                  <div className="space-y-1.5">
                    {relSnapsWithNames.map(({ rs, charA, charB }) => (
                      <div key={rs.id} className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-medium">{charA.name} ↔ {charB.name}</span>
                          {!rs.isActive && (
                            <span className="text-[10px] text-red-400">ended</span>
                          )}
                        </div>
                        <p className={cn('text-[11px]', sentimentColor[rs.sentiment])}>
                          {rs.label} · {rs.sentiment} · {rs.strength}
                        </p>
                        {rs.description && (
                          <p className="mt-0.5 text-[hsl(var(--muted-foreground))] leading-relaxed">{rs.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Items in play */}
              {placedItems.length > 0 && (
                <Section title="Items in play" icon={Package} count={placedItems.length}>
                  <div className="space-y-1">
                    {placedItems.map(({ placement, item, location }) => (
                      <div key={placement.id} className="flex items-center gap-2 text-xs">
                        <Package className="h-3 w-3 shrink-0 text-amber-400" />
                        <span className="font-medium">{item!.name}</span>
                        {location && <span className="text-[hsl(var(--muted-foreground))]">@ {location.name}</span>}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Relevant lore */}
              {relevantLore.length > 0 && (
                <Section title="Lore" icon={BookMarked} count={relevantLore.length}>
                  <div className="space-y-1.5">
                    {relevantLore.map((page) => {
                      const preview = page.body.slice(0, 80).replace(/[#*`_>\-]/g, '').trim()
                      const isNew = page.visibleFromEventId === activeEventId
                      return (
                        <button
                          key={page.id}
                          onClick={() => { navigate(`/worlds/${worldId}/lore/${page.id}`); setBriefOpen(false) }}
                          className="group w-full rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-2 text-left hover:border-[hsl(var(--ring)/0.4)] transition-colors"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="flex-1 truncate text-xs font-medium text-[hsl(var(--foreground))]">{page.title}</span>
                            {isNew && (
                              <span className="shrink-0 rounded bg-indigo-500/20 px-1 py-0.5 text-[9px] font-semibold text-indigo-400">NEW</span>
                            )}
                          </div>
                          {preview && (
                            <p className="mt-0.5 line-clamp-1 text-[10px] text-[hsl(var(--muted-foreground))]">{preview}</p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
