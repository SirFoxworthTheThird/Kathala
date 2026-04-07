import { useMemo } from 'react'
import { X, ShieldCheck, ShieldAlert, AlertTriangle, Users, Package, Network, ChevronRight } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store'
import { useWorldChapters, useWorldEvents } from '@/db/hooks/useTimeline'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useRelationships } from '@/db/hooks/useRelationships'
import { useItems } from '@/db/hooks/useItems'
import { useWorldSnapshots } from '@/db/hooks/useSnapshots'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { cn } from '@/lib/utils'
import type { CharacterSnapshot, ItemPlacement } from '@/types'

// ── types ─────────────────────────────────────────────────────────────────────

type IssueSeverity = 'error' | 'warning'

interface Issue {
  id: string
  severity: IssueSeverity
  category: 'character' | 'item' | 'relationship'
  message: string
  detail?: string
  navigatePath?: string
  eventId?: string
}

// ── helpers ───────────────────────────────────────────────────────────────────

function IssueRow({ issue, onNavigate }: { issue: Issue; onNavigate: (issue: Issue) => void }) {
  const Icon = issue.severity === 'error' ? AlertTriangle : AlertTriangle
  return (
    <div className={cn(
      'flex items-start gap-3 rounded border px-3 py-2.5 text-xs',
      issue.severity === 'error'
        ? 'border-red-500/30 bg-red-500/10'
        : 'border-amber-500/30 bg-amber-500/10'
    )}>
      <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', issue.severity === 'error' ? 'text-red-400' : 'text-amber-400')} />
      <div className="min-w-0 flex-1">
        <p className={cn('font-medium', issue.severity === 'error' ? 'text-red-300' : 'text-amber-300')}>{issue.message}</p>
        {issue.detail && <p className="mt-0.5 text-[hsl(var(--muted-foreground))]">{issue.detail}</p>}
      </div>
      {issue.navigatePath && (
        <button
          onClick={() => onNavigate(issue)}
          className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          title="Go to chapter"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

function CategorySection({ title, icon: Icon, issues, onNavigate }: {
  title: string
  icon: React.ElementType
  issues: Issue[]
  onNavigate: (issue: Issue) => void
}) {
  if (issues.length === 0) return null
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{title}</span>
        <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">{issues.length}</span>
      </div>
      <div className="space-y-1.5">
        {issues.map((issue) => <IssueRow key={issue.id} issue={issue} onNavigate={onNavigate} />)}
      </div>
    </div>
  )
}

// ── main ─────────────────────────────────────────────────────────────────────

export function ContinuityChecker() {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const { checkerOpen, setCheckerOpen, setActiveEventId } = useAppStore()

  const chapters   = useWorldChapters(worldId ?? null)
  const allEvents  = useWorldEvents(worldId ?? null)
  const characters = useCharacters(worldId ?? null)
  const rels       = useRelationships(worldId ?? null)
  const items      = useItems(worldId ?? null)
  const snapshots  = useWorldSnapshots(worldId ?? null)
  const allRelSnaps = useLiveQuery(
    () => worldId ? db.relationshipSnapshots.where('worldId').equals(worldId).toArray() : [],
    [worldId], []
  )
  const allItemPlacements = useLiveQuery(
    () => worldId ? db.itemPlacements.where('worldId').equals(worldId).toArray() : [],
    [worldId], []
  )

  const issues = useMemo(() => {
    const out: Issue[] = []

    const chapById  = new Map(chapters.map((c) => [c.id, c]))
    const charById  = new Map(characters.map((c) => [c.id, c]))
    const itemById  = new Map(items.map((i) => [i.id, i]))
    const eventById = new Map(allEvents.map((e) => [e.id, e]))

    // Global event order: chapter.number * 10_000 + event.sortOrder
    const chapNumById = new Map(chapters.map((c) => [c.id, c.number]))
    function eventOrder(eventId: string): number {
      const ev = eventById.get(eventId)
      if (!ev) return -1
      return (chapNumById.get(ev.chapterId) ?? 0) * 10_000 + ev.sortOrder
    }

    // ── Character checks ────────────────────────────────────────────────────

    // Group snapshots by character
    const snapsByChar = new Map<string, CharacterSnapshot[]>()
    for (const snap of snapshots) {
      if (!snapsByChar.has(snap.characterId)) snapsByChar.set(snap.characterId, [])
      snapsByChar.get(snap.characterId)!.push(snap)
    }

    for (const [charId, charSnaps] of snapsByChar) {
      const char = charById.get(charId)
      if (!char) continue

      // Find the earliest "dead" snapshot
      const deathSnap = charSnaps
        .filter((s) => !s.isAlive)
        .sort((a, b) => eventOrder(a.eventId) - eventOrder(b.eventId))[0]

      if (!deathSnap) continue

      const deathOrder = eventOrder(deathSnap.eventId)
      const deathChapNum = chapNumById.get(eventById.get(deathSnap.eventId)?.chapterId ?? '') ?? 0

      // Any alive snapshot AFTER the death event
      const aliveAfterDeath = charSnaps.filter((s) => {
        if (s.isAlive === false) return false
        return eventOrder(s.eventId) > deathOrder
      })

      for (const snap of aliveAfterDeath) {
        const ev = eventById.get(snap.eventId)
        const ch = ev ? chapById.get(ev.chapterId) : undefined
        out.push({
          id: `dead-then-alive-${charId}-${snap.eventId}`,
          severity: 'error',
          category: 'character',
          message: `${char.name} is alive in Ch. ${ch?.number ?? '?'} after dying in Ch. ${deathChapNum}`,
          detail: `Death recorded in Ch. ${deathChapNum} — ${chapById.get(eventById.get(deathSnap.eventId)?.chapterId ?? '')?.title ?? ''}`,
          navigatePath: `/worlds/${worldId}/timeline/${snap.eventId}`,
          eventId: snap.eventId,
        })
      }

      // Snapshot referencing a deleted event
      for (const snap of charSnaps) {
        if (!eventById.has(snap.eventId)) {
          out.push({
            id: `orphan-snap-${snap.id}`,
            severity: 'warning',
            category: 'character',
            message: `${char.name} has a snapshot for a deleted event`,
            detail: `Snapshot ID ${snap.id} — event no longer exists`,
          })
        }
      }
    }

    // ── Item checks ─────────────────────────────────────────────────────────

    // Group item placements by eventId
    const placementsByEvent = new Map<string, ItemPlacement[]>()
    for (const p of (allItemPlacements ?? [])) {
      if (!placementsByEvent.has(p.eventId)) placementsByEvent.set(p.eventId, [])
      placementsByEvent.get(p.eventId)!.push(p)
    }

    // Group snapshots by eventId to check inventory duplication
    const snapsByEvent = new Map<string, CharacterSnapshot[]>()
    for (const snap of snapshots) {
      if (!snapsByEvent.has(snap.eventId)) snapsByEvent.set(snap.eventId, [])
      snapsByEvent.get(snap.eventId)!.push(snap)
    }

    for (const [evId, evSnaps] of snapsByEvent) {
      const ev = eventById.get(evId)
      const ch = ev ? chapById.get(ev.chapterId) : undefined
      if (!ch) continue

      // Build a count of each item across all inventories in this event
      const itemOwnerCount = new Map<string, string[]>()
      for (const snap of evSnaps) {
        for (const itemId of snap.inventoryItemIds) {
          if (!itemOwnerCount.has(itemId)) itemOwnerCount.set(itemId, [])
          itemOwnerCount.get(itemId)!.push(snap.characterId)
        }
      }

      // Also count items placed at locations
      const evPlacements = placementsByEvent.get(evId) ?? []
      for (const p of evPlacements) {
        if (!itemOwnerCount.has(p.itemId)) itemOwnerCount.set(p.itemId, [])
        itemOwnerCount.get(p.itemId)!.push(`location:${p.locationMarkerId}`)
      }

      for (const [itemId, owners] of itemOwnerCount) {
        if (owners.length > 1) {
          const item = itemById.get(itemId)
          const ownerNames = owners.map((o) => {
            if (o.startsWith('location:')) return 'a location'
            return charById.get(o)?.name ?? 'unknown'
          })
          out.push({
            id: `dup-item-${itemId}-${evId}`,
            severity: 'error',
            category: 'item',
            message: `"${item?.name ?? itemId}" appears in multiple places in Ch. ${ch.number}`,
            detail: `Held by: ${ownerNames.join(', ')}`,
            navigatePath: `/worlds/${worldId}/timeline/${evId}`,
            eventId: evId,
          })
        }
      }
    }

    // ── Relationship checks ──────────────────────────────────────────────────

    for (const rel of rels) {
      if (!rel.startEventId) continue
      const startOrder = eventOrder(rel.startEventId)
      const startChapNum = chapNumById.get(eventById.get(rel.startEventId)?.chapterId ?? '') ?? 0

      // Any snapshot for an event BEFORE the relationship started
      const earlySnaps = (allRelSnaps ?? []).filter((rs) => {
        if (rs.relationshipId !== rel.id) return false
        return eventOrder(rs.eventId) < startOrder
      })

      for (const rs of earlySnaps) {
        const rsEv = eventById.get(rs.eventId)
        const rsCh = rsEv ? chapById.get(rsEv.chapterId) : undefined
        const charA = charById.get(rel.characterAId)
        const charB = charById.get(rel.characterBId)
        out.push({
          id: `rel-before-start-${rs.id}`,
          severity: 'warning',
          category: 'relationship',
          message: `Relationship snapshot exists before it started`,
          detail: `${charA?.name ?? '?'} ↔ ${charB?.name ?? '?'} — snapshot in Ch. ${rsCh?.number ?? '?'} but relationship starts in Ch. ${startChapNum}`,
          navigatePath: `/worlds/${worldId}/timeline/${rs.eventId}`,
          eventId: rs.eventId,
        })
      }
    }

    return out
  }, [chapters, allEvents, characters, rels, items, snapshots, allRelSnaps, allItemPlacements, worldId])

  function handleNavigate(issue: Issue) {
    if (!issue.navigatePath || !issue.eventId) return
    setActiveEventId(issue.eventId)
    navigate(issue.navigatePath)
    setCheckerOpen(false)
  }

  if (!checkerOpen) return null

  const errors   = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')
  const charIssues = issues.filter((i) => i.category === 'character')
  const itemIssues = issues.filter((i) => i.category === 'item')
  const relIssues  = issues.filter((i) => i.category === 'relationship')

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-start justify-center pt-[8vh]"
      onClick={() => setCheckerOpen(false)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative z-10 flex w-full max-w-xl flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-5 py-3.5">
          {issues.length === 0
            ? <ShieldCheck className="h-4 w-4 text-green-400" />
            : <ShieldAlert className="h-4 w-4 text-amber-400" />
          }
          <span className="text-sm font-semibold">Continuity Checker</span>
          {issues.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              {errors.length > 0 && (
                <span className="rounded bg-red-500/20 px-2 py-0.5 text-red-400">{errors.length} error{errors.length !== 1 ? 's' : ''}</span>
              )}
              {warnings.length > 0 && (
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-400">{warnings.length} warning{warnings.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          )}
          <button
            className="ml-auto text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            onClick={() => setCheckerOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-3">
          {issues.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <ShieldCheck className="h-10 w-10 text-green-400" />
              <p className="text-sm font-medium text-[hsl(var(--foreground))]">No issues found</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                No continuity errors detected across {characters.length} characters, {items.length} items, and {rels.length} relationships.
              </p>
            </div>
          ) : (
            <>
              <CategorySection title="Characters" icon={Users} issues={charIssues} onNavigate={handleNavigate} />
              <CategorySection title="Items" icon={Package} issues={itemIssues} onNavigate={handleNavigate} />
              <CategorySection title="Relationships" icon={Network} issues={relIssues} onNavigate={handleNavigate} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[hsl(var(--border))] px-5 py-2 text-[10px] text-[hsl(var(--muted-foreground))]">
          Checks: character deaths · duplicate item ownership · relationship timeline order
        </div>
      </div>
    </div>
  )
}
