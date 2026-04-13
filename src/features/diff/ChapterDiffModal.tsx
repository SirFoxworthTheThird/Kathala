import { useState, useMemo } from 'react'
import { X, Users, Network, Package, ArrowRight, MapPin, Heart, Skull } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useAppStore } from '@/store'
import { useWorldChapters, useWorldEvents } from '@/db/hooks/useTimeline'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useRelationships } from '@/db/hooks/useRelationships'
import { useItems } from '@/db/hooks/useItems'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { cn } from '@/lib/utils'
import type { CharacterSnapshot, RelationshipSnapshot } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────────

function arrEqual(a: string[], b: string[]) {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join()
}

// ── sub-components ────────────────────────────────────────────────────────────

function DiffTag({ label, kind }: { label: string; kind: 'added' | 'removed' | 'changed' | 'same' }) {
  return (
    <span className={cn(
      'rounded px-1.5 py-0.5 text-[10px] font-medium',
      kind === 'added'   && 'bg-green-500/20 text-green-400',
      kind === 'removed' && 'bg-red-500/20 text-red-400',
      kind === 'changed' && 'bg-amber-500/20 text-amber-400',
      kind === 'same'    && 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
    )}>{label}</span>
  )
}

function SectionHeader({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-4">
      <Icon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
      <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{title}</span>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export function ChapterDiffModal() {
  const { worldId } = useParams<{ worldId: string }>()
  const { diffOpen, setDiffOpen, activeEventId } = useAppStore()
  const [compareChapterId, setCompareChapterId] = useState<string>('')

  const chapters   = useWorldChapters(worldId ?? null)
  const allEvents  = useWorldEvents(worldId ?? null)
  const characters = useCharacters(worldId ?? null)
  const rels       = useRelationships(worldId ?? null)
  const items      = useItems(worldId ?? null)
  const markers    = useAllLocationMarkers(worldId ?? null)

  const chapById   = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters])

  // Derive active chapter from active event
  const activeEvent   = useMemo(() => allEvents.find((e) => e.id === activeEventId) ?? null, [allEvents, activeEventId])
  const activeChapter = activeEvent ? chapById.get(activeEvent.chapterId) ?? null : null

  // Map each chapter to its last event (by sortOrder) — that's the "final state" we diff
  const lastEventByChapter = useMemo(() => {
    const map = new Map<string, string>()
    for (const ev of allEvents) {
      const cur = map.get(ev.chapterId)
      if (cur === undefined) {
        map.set(ev.chapterId, ev.id)
      } else {
        const curEv = allEvents.find((e) => e.id === cur)
        if (curEv && ev.sortOrder > curEv.sortOrder) map.set(ev.chapterId, ev.id)
      }
    }
    return map
  }, [allEvents])

  const eventIdA = activeChapter ? (lastEventByChapter.get(activeChapter.id) ?? null) : null
  const eventIdB = compareChapterId ? (lastEventByChapter.get(compareChapterId) ?? null) : null

  // Snapshots for both chapters (using last-event-of-chapter)
  const snapsA = useLiveQuery(
    () => eventIdA ? db.characterSnapshots.where('eventId').equals(eventIdA).toArray() : [],
    [eventIdA], []
  )
  const snapsB = useLiveQuery(
    () => eventIdB ? db.characterSnapshots.where('eventId').equals(eventIdB).toArray() : [],
    [eventIdB], []
  )
  const relSnapsA = useLiveQuery(
    () => eventIdA ? db.relationshipSnapshots.where('eventId').equals(eventIdA).toArray() : [],
    [eventIdA], []
  )
  const relSnapsB = useLiveQuery(
    () => eventIdB ? db.relationshipSnapshots.where('eventId').equals(eventIdB).toArray() : [],
    [eventIdB], []
  )
  const itemPlacementsA = useLiveQuery(
    () => eventIdA ? db.itemPlacements.where('eventId').equals(eventIdA).toArray() : [],
    [eventIdA], []
  )
  const itemPlacementsB = useLiveQuery(
    () => eventIdB ? db.itemPlacements.where('eventId').equals(eventIdB).toArray() : [],
    [eventIdB], []
  )

  const charById   = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])
  const markerById = useMemo(() => new Map(markers.map((m) => [m.id, m])), [markers])
  const itemById   = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const chapterA = activeChapter
  const chapterB = chapById.get(compareChapterId)

  // ── character diffs ────────────────────────────────────────────────────────

  const charDiffs = useMemo(() => {
    if (!snapsA || !snapsB) return []
    const snapAById = new Map(snapsA.map((s: CharacterSnapshot) => [s.characterId, s]))
    const snapBById = new Map(snapsB.map((s: CharacterSnapshot) => [s.characterId, s]))
    const allCharIds = new Set([...snapAById.keys(), ...snapBById.keys()])

    return Array.from(allCharIds).map((cid) => {
      const a = snapAById.get(cid)
      const b = snapBById.get(cid)
      const char = charById.get(cid)
      const locA = a?.currentLocationMarkerId ? markerById.get(a.currentLocationMarkerId)?.name ?? '?' : '—'
      const locB = b?.currentLocationMarkerId ? markerById.get(b.currentLocationMarkerId)?.name ?? '?' : '—'
      const changes: { field: string; from: string; to: string }[] = []
      if (a && b) {
        if (a.isAlive !== b.isAlive) changes.push({ field: 'status', from: a.isAlive ? 'alive' : 'dead', to: b.isAlive ? 'alive' : 'dead' })
        if (a.currentLocationMarkerId !== b.currentLocationMarkerId) changes.push({ field: 'location', from: locA, to: locB })
        if (!arrEqual(a.inventoryItemIds, b.inventoryItemIds)) {
          const added   = b.inventoryItemIds.filter((id) => !a.inventoryItemIds.includes(id)).map((id) => itemById.get(id)?.name ?? id)
          const removed = a.inventoryItemIds.filter((id) => !b.inventoryItemIds.includes(id)).map((id) => itemById.get(id)?.name ?? id)
          if (added.length)   changes.push({ field: 'gained',  from: '', to: added.join(', ') })
          if (removed.length) changes.push({ field: 'lost',    from: removed.join(', '), to: '' })
        }
        if (a.statusNotes !== b.statusNotes) changes.push({ field: 'notes', from: a.statusNotes || '—', to: b.statusNotes || '—' })
      }
      return { cid, char, a, b, changes, locA, locB }
    }).sort((a, b) => (a.char?.name ?? '').localeCompare(b.char?.name ?? ''))
  }, [snapsA, snapsB, charById, markerById, itemById])

  // ── relationship diffs ─────────────────────────────────────────────────────

  const relDiffs = useMemo(() => {
    if (!relSnapsA || !relSnapsB) return []
    const relSnapAById = new Map(relSnapsA.map((s: RelationshipSnapshot) => [s.relationshipId, s]))
    const relSnapBById = new Map(relSnapsB.map((s: RelationshipSnapshot) => [s.relationshipId, s]))
    const allRelIds = new Set([...relSnapAById.keys(), ...relSnapBById.keys()])

    return Array.from(allRelIds).map((rid) => {
      const a = relSnapAById.get(rid)
      const b = relSnapBById.get(rid)
      const rel = rels.find((r) => r.id === rid)
      const charA = rel ? charById.get(rel.characterAId) : undefined
      const charB = rel ? charById.get(rel.characterBId) : undefined
      const changes: { field: string; from: string; to: string }[] = []
      if (a && b) {
        if (a.sentiment !== b.sentiment) changes.push({ field: 'sentiment', from: a.sentiment, to: b.sentiment })
        if (a.strength !== b.strength)   changes.push({ field: 'strength',  from: a.strength,  to: b.strength })
        if (a.isActive !== b.isActive)   changes.push({ field: 'active',    from: String(a.isActive), to: String(b.isActive) })
        if (a.label !== b.label)         changes.push({ field: 'label',     from: a.label, to: b.label })
      }
      return { rid, rel, charA, charB, a, b, changes }
    }).filter((d) => d.changes.length > 0 || !d.a || !d.b)
  }, [relSnapsA, relSnapsB, rels, charById])

  // ── item placement diffs ───────────────────────────────────────────────────

  const itemDiffs = useMemo(() => {
    if (!itemPlacementsA || !itemPlacementsB) return []
    const placeAByItem = new Map(itemPlacementsA.map((p) => [p.itemId, p]))
    const placeBByItem = new Map(itemPlacementsB.map((p) => [p.itemId, p]))
    const allItemIds = new Set([...placeAByItem.keys(), ...placeBByItem.keys()])
    const diffs: { itemId: string; name: string; from: string; to: string; kind: 'added' | 'removed' | 'changed' }[] = []

    for (const iid of allItemIds) {
      const a = placeAByItem.get(iid)
      const b = placeBByItem.get(iid)
      const name = itemById.get(iid)?.name ?? iid
      const locA = a ? (markerById.get(a.locationMarkerId)?.name ?? '?') : '—'
      const locB = b ? (markerById.get(b.locationMarkerId)?.name ?? '?') : '—'
      if (!a) diffs.push({ itemId: iid, name, from: '—', to: locB, kind: 'added' })
      else if (!b) diffs.push({ itemId: iid, name, from: locA, to: '—', kind: 'removed' })
      else if (a.locationMarkerId !== b.locationMarkerId) diffs.push({ itemId: iid, name, from: locA, to: locB, kind: 'changed' })
    }
    return diffs
  }, [itemPlacementsA, itemPlacementsB, itemById, markerById])

  if (!diffOpen) return null

  const otherChapters = chapters.filter((c) => c.id !== activeChapter?.id).sort((a, b) => a.number - b.number)

  const totalChanges = charDiffs.filter((d) => d.changes.length > 0 || !d.a || !d.b).length
    + relDiffs.length
    + itemDiffs.length

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-start justify-center pt-[8vh]"
      onClick={() => setDiffOpen(false)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative z-10 flex w-full max-w-2xl flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-5 py-3.5">
          <span className="text-sm font-semibold">Chapter Diff</span>
          <button
            className="ml-auto text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            onClick={() => setDiffOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Chapter selectors */}
        <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] px-5 py-3">
          <div className="flex-1 rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-sm">
            {chapterA
              ? <><span className="text-[hsl(var(--muted-foreground))] text-xs">Base: </span>Ch. {chapterA.number} — {chapterA.title}</>
              : <span className="text-[hsl(var(--muted-foreground))] text-sm">No chapter selected</span>
            }
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
          <select
            className="flex-1 rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-sm text-[hsl(var(--foreground))] outline-none"
            value={compareChapterId}
            onChange={(e) => setCompareChapterId(e.target.value)}
          >
            <option value="">Compare with…</option>
            {otherChapters.map((c) => (
              <option key={c.id} value={c.id}>Ch. {c.number} — {c.title}</option>
            ))}
          </select>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-2">
          {!activeChapter ? (
            <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Select a chapter from the timeline bar first.</p>
          ) : !compareChapterId ? (
            <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Choose a chapter to compare against.</p>
          ) : totalChanges === 0 ? (
            <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">No recorded differences between these chapters.</p>
          ) : (
            <>
              {/* Characters */}
              {charDiffs.some((d) => d.changes.length > 0 || !d.a || !d.b) && (
                <>
                  <SectionHeader title="Characters" icon={Users} />
                  <div className="space-y-2">
                    {charDiffs.map(({ cid, char, a, b, changes }) => {
                      if (changes.length === 0 && a && b) return null
                      const charName = char?.name ?? cid
                      return (
                        <div key={cid} className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-semibold">{charName}</span>
                            {!a && <DiffTag label="new" kind="added" />}
                            {!b && <DiffTag label="removed" kind="removed" />}
                          </div>
                          {changes.map(({ field, from, to }) => (
                            <div key={field} className="flex items-center gap-1.5 text-[hsl(var(--muted-foreground))]">
                              <span className="w-16 shrink-0 capitalize text-[10px]">{field}</span>
                              {field === 'status' ? (
                                <>
                                  {from === 'alive' ? <Heart className="h-3 w-3 text-green-400" /> : <Skull className="h-3 w-3 text-red-400" />}
                                  <span>{from}</span>
                                  <ArrowRight className="h-3 w-3" />
                                  {to === 'alive' ? <Heart className="h-3 w-3 text-green-400" /> : <Skull className="h-3 w-3 text-red-400" />}
                                  <span>{to}</span>
                                </>
                              ) : field === 'location' ? (
                                <>
                                  <MapPin className="h-3 w-3" />
                                  <span>{from}</span>
                                  <ArrowRight className="h-3 w-3" />
                                  <MapPin className="h-3 w-3 text-green-400" />
                                  <span className="text-green-400">{to}</span>
                                </>
                              ) : field === 'gained' ? (
                                <span className="text-green-400">+ {to}</span>
                              ) : field === 'lost' ? (
                                <span className="text-red-400">− {from}</span>
                              ) : (
                                <>
                                  <span className="truncate max-w-[120px]">{from}</span>
                                  <ArrowRight className="h-3 w-3 shrink-0" />
                                  <span className="truncate max-w-[120px] text-amber-400">{to}</span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Relationships */}
              {relDiffs.length > 0 && (
                <>
                  <SectionHeader title="Relationships" icon={Network} />
                  <div className="space-y-2">
                    {relDiffs.map(({ rid, charA, charB, a, b, changes }) => (
                      <div key={rid} className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{charA?.name ?? '?'} ↔ {charB?.name ?? '?'}</span>
                          {!a && <DiffTag label="new" kind="added" />}
                          {!b && <DiffTag label="removed" kind="removed" />}
                        </div>
                        {changes.map(({ field, from, to }) => (
                          <div key={field} className="flex items-center gap-1.5 text-[hsl(var(--muted-foreground))]">
                            <span className="w-16 shrink-0 capitalize text-[10px]">{field}</span>
                            <span>{from}</span>
                            <ArrowRight className="h-3 w-3 shrink-0" />
                            <span className="text-amber-400">{to}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Item placements */}
              {itemDiffs.length > 0 && (
                <>
                  <SectionHeader title="Item Locations" icon={Package} />
                  <div className="space-y-1.5">
                    {itemDiffs.map(({ itemId, name, from, to, kind }) => (
                      <div key={itemId} className="flex items-center gap-2 text-xs">
                        <Package className="h-3 w-3 shrink-0 text-amber-400" />
                        <span className="font-medium">{name}</span>
                        <span className="text-[hsl(var(--muted-foreground))]">{from}</span>
                        <ArrowRight className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                        <DiffTag
                          label={to === '—' ? 'removed' : to}
                          kind={kind}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {compareChapterId && totalChanges > 0 && (
          <div className="border-t border-[hsl(var(--border))] px-5 py-2 text-xs text-[hsl(var(--muted-foreground))]">
            {totalChanges} change{totalChanges !== 1 ? 's' : ''} between Ch. {chapterA?.number} and Ch. {chapterB?.number}
          </div>
        )}
      </div>
    </div>
  )
}
