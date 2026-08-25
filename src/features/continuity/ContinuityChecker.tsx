import { useMemo, useState, useRef, useEffect } from 'react'
import { groupIssuesByKind, FIX_ALL_LABELS } from '@/lib/continuity/issueKinds'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { X, ShieldCheck, ShieldAlert, AlertTriangle, Lightbulb, Users, Package, Network, Shield, ChevronRight, EyeOff, Eye, Check, PenLine, Spline, MapPin } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store'
import { useWorldChapters, useWorldEvents, updateEvent } from '@/db/hooks/useTimeline'
import { useWorld } from '@/db/hooks/useWorlds'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useRelationships } from '@/db/hooks/useRelationships'
import { useItems } from '@/db/hooks/useItems'
import { useWorldSnapshots, upsertSnapshot, moveCharacterToScene } from '@/db/hooks/useSnapshots'
import { useCrossTimelineArtifacts } from '@/db/hooks/useTimelineRelationships'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useMapLayers } from '@/db/hooks/useMapLayers'
import { useTravelModes } from '@/db/hooks/useTravelModes'
import { useWorldMovements } from '@/db/hooks/useMovements'
import { useFactions, useFactionMemberships, useFactionRelationships } from '@/db/hooks/useFactions'
import { usePlotThreads, updatePlotThread } from '@/db/hooks/usePlotThreads'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useContinuitySuppressions, toggleContinuitySuppression, setContinuitySuppressionNote } from '@/db/hooks/useContinuitySuppressions'
import { cn } from '@/lib/utils'
import { MODAL_BACKDROP } from '@/components/ui/dialog'
import { useKnowledgeFacts, useKnowledgeReveals } from '@/db/hooks/useKnowledge'
import { useWorldSceneTexts } from '@/db/hooks/useManuscript'

// Issue computation lives in src/lib/continuity/computeIssues.ts (pure, unit-tested).
import { computeContinuityIssues, type Issue } from '@/lib/continuity/computeIssues'


// ── helpers ───────────────────────────────────────────────────────────────────

function IssueRow({
  issue,
  focused,
  suppressed,
  suppressNote,
  onNavigate,
  onSuppress,
  onFix,
}: {
  issue: Issue
  focused: boolean
  suppressed: boolean
  suppressNote: string
  onNavigate: (issue: Issue) => void
  onSuppress: (issue: Issue, note: string) => void
  onFix: (issue: Issue) => void
}) {
  const [justifyMode, setJustifyMode] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSuppressClick() {
    if (suppressed) {
      onSuppress(issue, '')
    } else {
      setJustifyMode(true)
      setNoteInput('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  function confirmSuppress() {
    onSuppress(issue, noteInput.trim())
    setJustifyMode(false)
    setNoteInput('')
  }

  function cancelJustify() {
    setJustifyMode(false)
    setNoteInput('')
  }

  return (
    <div className={cn(
      'rounded border text-xs transition-colors',
      suppressed
        ? 'border-[hsl(var(--border))] bg-transparent opacity-40'
        : issue.severity === 'error'
          ? 'border-red-500/30 bg-red-500/10'
          : issue.severity === 'note'
            ? 'border-[hsl(var(--border))] bg-transparent'
            : 'border-amber-500/30 bg-amber-500/10',
      focused && !suppressed && 'ring-1 ring-[hsl(var(--ring))]',
    )}>
      <div className="flex items-start gap-3 px-3 py-2.5">
        {/*
          N4: an observation does not get the warning triangle. Twelve "long run
          of one POV" and nineteen dangling subplots on a finished Dumas novel,
          drawn exactly like "this object is in two places at once", is what
          teaches a writer to skim the list — and the one that mattered was row 1
          of fifty.
        */}
        {issue.severity === 'note' ? (
          <Lightbulb className={cn('mt-0.5 h-3.5 w-3.5 shrink-0',
            suppressed ? 'text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--muted-foreground))]')} />
        ) : (
          <AlertTriangle className={cn(
            'mt-0.5 h-3.5 w-3.5 shrink-0',
            suppressed ? 'text-[hsl(var(--muted-foreground))]' : issue.severity === 'error' ? 'text-red-400' : 'text-amber-400'
          )} />
        )}
        <div className="min-w-0 flex-1">
          <p className={cn(
            'font-medium',
            suppressed || issue.severity === 'note'
              ? 'text-[hsl(var(--muted-foreground))]'
              : issue.severity === 'error' ? 'text-red-300' : 'text-amber-300'
          )}>{issue.message}</p>
          {issue.detail && <p className="mt-0.5 text-[hsl(var(--muted-foreground))]">{issue.detail}</p>}
          {issue.fix && !suppressed && (
            <button
              onClick={() => onFix(issue)}
              className="mt-1.5 rounded border border-[hsl(var(--border))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--foreground))] hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--accent))] transition-colors"
            >
              {issue.fix.label}
            </button>
          )}
          {suppressed && suppressNote && (
            <p className="mt-1 italic text-[hsl(var(--muted-foreground))]">"{suppressNote}"</p>
          )}
        </div>
        <button
          onClick={handleSuppressClick}
          aria-label={suppressed ? 'Un-suppress this issue' : 'Suppress this issue'}
          title={suppressed ? 'Un-suppress' : 'Suppress'}
          className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          {suppressed ? <Eye className="h-3.5 w-3.5" aria-hidden="true" /> : <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
        {issue.navigatePath && !suppressed && (
          <button
            onClick={() => onNavigate(issue)}
            aria-label="Go to chapter"
            title="Go to chapter"
            className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {justifyMode && (
        <div className="flex items-center gap-2 border-t border-[hsl(var(--border))] px-3 py-2">
          <input
            ref={inputRef}
            type="text"
            className="flex-1 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            placeholder="Reason for suppressing (optional)…"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); confirmSuppress() }
              if (e.key === 'Escape') { e.preventDefault(); cancelJustify() }
            }}
          />
          <button
            onClick={confirmSuppress}
            className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-green-400 transition-colors"
            title="Confirm suppress"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={cancelJustify}
            className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            title="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

function CategorySection({ title, icon: Icon, issues, focusedId, suppressedIds, suppressedNotes, showSuppressed, onNavigate, onSuppress, onFix, onFixAll }: {
  title: string
  icon: React.ElementType
  issues: Issue[]
  /** Which row the keyboard is on, by id — see the note on `focusedId` below. */
  focusedId: string | null
  suppressedIds: Set<string>
  suppressedNotes: Record<string, string>
  showSuppressed: boolean
  onNavigate: (issue: Issue) => void
  onSuppress: (issue: Issue, note: string) => void
  onFix: (issue: Issue) => void
  onFixAll: (issues: Issue[]) => void
}) {
  const visible = issues.filter((i) => showSuppressed || !suppressedIds.has(i.id))
  if (visible.length === 0) return null

  // CC-3: a category was the only grouping there was, so "Items 79" was one
  // heading over a single repeated fault with the real findings buried inside
  // it. Grouping by kind puts a name and a count on each run, and orders errors
  // first, so a category opens on its most serious fault.
  const groups = groupIssuesByKind(visible)
  // With one kind there is nothing to triage between, and a heading repeating
  // the category would be noise.
  const showHeadings = groups.length > 1

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{title}</span>
        <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">{visible.length}</span>
      </div>
      {groups.map((group) => (
        <div key={group.kind} className={showHeadings ? 'mb-2.5' : undefined}>
          {showHeadings && (
            <div className="mb-1 flex items-center gap-1.5 pl-0.5">
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  group.severity === 'error' ? 'bg-red-400'
                    : group.severity === 'note' ? 'bg-[hsl(var(--muted-foreground))]' : 'bg-amber-400',
                )}
                aria-hidden="true"
              />
              <span className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                {group.label}
              </span>
              <span className="text-[11px] tabular-nums text-[hsl(var(--muted-foreground)/0.7)]">
                {group.issues.length}
              </span>
            </div>
          )}
          {/*
            A run of the same fixable fault gets one control for the run, at two
            or more — at one there is already a button on the row itself.

            The `suppressedIds` check matters only while **Show suppressed** is
            on: with it off, `visible` above has already dropped those rows. But
            that is exactly when a batch could do the wrong thing, because the
            suppressed row is on screen and inside the group, and suppressing is
            the writer saying they know. A mutation removing this filter
            survived until the test drove the toggle.
          */}
          {(() => {
            const batch = group.issues.filter((i) => i.fix && !suppressedIds.has(i.id))
            const label = FIX_ALL_LABELS[group.kind]
            if (!label || batch.length < 2) return null
            return (
              <button
                onClick={() => onFixAll(batch)}
                className="mb-1.5 rounded border border-[hsl(var(--border))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--foreground))] transition-colors hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--accent))]"
              >
                {label} {batch.length}
              </button>
            )
          })()}
          <div className="space-y-1.5">
            {group.issues.map((issue) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                focused={focusedId === issue.id}
                suppressed={suppressedIds.has(issue.id)}
                suppressNote={suppressedNotes[issue.id] ?? ''}
                onNavigate={onNavigate}
                onSuppress={onSuppress}
                onFix={onFix}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── main ─────────────────────────────────────────────────────────────────────

export function ContinuityChecker() {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const { checkerOpen, setCheckerOpen, setActiveEventId } = useAppStore()
  const { suppressedIds, suppressedNotes } = useContinuitySuppressions(worldId ?? null)
  const [showSuppressed, setShowSuppressed] = useState(false)
  // Focus is tracked by issue id rather than by position. It used to be an
  // index into one flat list while the rows were rendered from another, with
  // `baseIdx` arithmetic bridging the two — which only held while the two
  // orders agreed, and grouping by kind (CC-3) makes them disagree.
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useFocusTrap(containerRef, checkerOpen)

  const chapters    = useWorldChapters(worldId ?? null)
  const allEvents   = useWorldEvents(worldId ?? null)
  const characters  = useCharacters(worldId ?? null)
  const rels        = useRelationships(worldId ?? null)
  const items       = useItems(worldId ?? null)
  const snapshots   = useWorldSnapshots(worldId ?? null)
  const knowledgeFacts   = useKnowledgeFacts(worldId ?? null)
  const knowledgeReveals = useKnowledgeReveals(worldId ?? null)
  const sceneTexts       = useWorldSceneTexts(worldId ?? null)
  const allMarkers  = useAllLocationMarkers(worldId ?? null)
  const allLayers   = useMapLayers(worldId ?? null)
  const travelModes = useTravelModes(worldId ?? null)
  const allMovements = useWorldMovements(worldId ?? null)
  const artifacts    = useCrossTimelineArtifacts(worldId ?? null)
  const allRelSnaps = useLiveQuery(
    () => worldId ? db.relationshipSnapshots.where('worldId').equals(worldId).toArray() : [],
    [worldId], []
  )
  const allItemPlacements = useLiveQuery(
    () => worldId ? db.itemPlacements.where('worldId').equals(worldId).toArray() : [],
    [worldId], []
  )
  const allLocationSnapshots = useLiveQuery(
    () => worldId ? db.locationSnapshots.where('worldId').equals(worldId).toArray() : [],
    [worldId], []
  )
  const allMapRoutes = useLiveQuery(
    () => worldId ? db.mapRoutes.where('worldId').equals(worldId).toArray() : [],
    [worldId], []
  )
  const allMapRegions = useLiveQuery(
    () => worldId ? db.mapRegions.where('worldId').equals(worldId).toArray() : [],
    [worldId], []
  )
  const allRegionSnapshots = useLiveQuery(
    () => worldId ? db.mapRegionSnapshots.where('worldId').equals(worldId).toArray() : [],
    [worldId], []
  )
  const plotThreads       = usePlotThreads(worldId ?? null)
  const allFactions       = useFactions(worldId ?? null)
  const allMemberships    = useFactionMemberships(worldId ?? null)
  const allFactionRels    = useFactionRelationships(worldId ?? null)
  const world             = useWorld(worldId ?? null)
  const allItemSnapshots  = useLiveQuery(
    () => worldId ? db.itemSnapshots.where('worldId').equals(worldId).toArray() : [],
    [worldId], []
  )

  const issues = useMemo(() => computeContinuityIssues({
    worldId, world, chapters, allEvents, characters, rels, items, snapshots,
    knowledgeFacts, knowledgeReveals, sceneTexts, allRelSnaps, allItemPlacements,
    allLocationSnapshots, allMarkers, allLayers, travelModes, allMovements,
    artifacts, allMapRoutes, allMapRegions, allRegionSnapshots, allFactions,
    allMemberships, allFactionRels, allItemSnapshots, plotThreads,
  }), [chapters, allEvents, characters, rels, items, snapshots, knowledgeFacts, knowledgeReveals, sceneTexts, allRelSnaps, allItemPlacements, allLocationSnapshots, allMarkers, allLayers, travelModes, allMovements, artifacts, allMapRoutes, allMapRegions, allRegionSnapshots, allFactions, allMemberships, allFactionRels, worldId, world, allItemSnapshots, plotThreads])

  // Focus modal on open so keyboard navigation works immediately
  useEffect(() => {
    if (checkerOpen) {
      setFocusedId(null)
      setTimeout(() => containerRef.current?.focus(), 0)
    }
  }, [checkerOpen])

  /*
    Escape, independent of where focus happens to be.

    X-11 recorded this panel as having gained "the same handler" as the others.
    It had not: closing ran off the container's React `onKeyDown`, which only
    fires once focus is *inside* the panel — and focus is handed over by the
    `setTimeout(…, 0)` above. Press Escape before that timeout runs and the key
    went nowhere. It failed roughly one run in eight under a loaded suite, which
    is exactly what a race looks like from the outside, and it took tightening
    the test's locator to see it as a real failure rather than a flake.

    `defaultPrevented` is the guard for the inline "reason for suppressing"
    field, which handles Escape itself to cancel the note. That decision is the
    innermost one, so it wins and the panel stays open.
  */
  useEffect(() => {
    if (!checkerOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      setCheckerOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [checkerOpen, setCheckerOpen])

  const suppressedSet = suppressedIds

  // The rows the arrow keys walk, in the order they are drawn: category by
  // category, and within each, grouped by kind exactly as `CategorySection`
  // does. Derived from the same `groupIssuesByKind` call the rendering uses, so
  // focus cannot walk off in an order nothing on screen is in.
  const navigableIssues = useMemo(() => {
    const byCategory: Issue['category'][] =
      ['character', 'item', 'relationship', 'faction', 'pov', 'prose', 'thread', 'world']
    return byCategory.flatMap((category) =>
      groupIssuesByKind(issues.filter((i) => i.category === category && !suppressedSet.has(i.id)))
        .flatMap((g) => g.issues)
        .filter((i) => i.navigatePath))
  }, [issues, suppressedSet])

  function handleNavigate(issue: Issue) {
    if (!issue.navigatePath || !issue.eventId) return
    setActiveEventId(issue.eventId)
    navigate(issue.navigatePath)
    setCheckerOpen(false)
  }

  async function applyFix(issue: Issue) {
    const fix = issue.fix
    if (!fix || !worldId) return
    switch (fix.kind) {
      case 'travelDays':
        await updateEvent(fix.eventId, { travelDays: fix.setTravelDays })
        return
      case 'initialSnapshot':
        // Alive, nowhere in particular, carrying nothing — the record that says
        // "they exist from here". `upsertSnapshot` refuses to duplicate an
        // identical earlier state, so this cannot add a no-op row.
        await upsertSnapshot({
          worldId,
          characterId: fix.characterId,
          eventId: fix.eventId,
          isAlive: true,
          currentLocationMarkerId: null,
          currentMapLayerId: null,
          inventoryItemIds: [],
          inventoryNotes: '',
          statusNotes: '',
          travelModeId: null,
        })
        return
      case 'clearPov':
        // Nothing is discarded: the field already pointed at a record that is
        // not there, which is the whole of the finding.
        await updateEvent(fix.eventId, { povCharacterId: null })
        return
      case 'addMention': {
        /*
          A mention, not a cast entry.

          This warning is "named in the prose", and the button used to answer it
          by putting the character *in the scene*. Taken seventeen times on a
          1,489-word draft it produced a two-hander with a cast of four — a
          woman who was across the city, a man who had already left, and a dead
          one — while leaving out the character actually in the room, because
          the prose called her "she". Silencing the warnings also created four
          fresh "no state recorded" prompts for people who are not there.

          `mentionedCharacterIds` is true by construction: the name is in the
          text. `proseContinuity` already counts it as acknowledgement, so the
          warning clears for the right reason. Being in the room is the larger
          claim and stays a deliberate act on the scene card, which the detail
          text now says.
        */
        const ev = await db.events.get(fix.eventId)
        if (!ev) return
        const mentioned = ev.mentionedCharacterIds ?? []
        if (mentioned.includes(fix.characterId) || ev.involvedCharacterIds.includes(fix.characterId)) return
        await updateEvent(fix.eventId, {
          mentionedCharacterIds: [...mentioned, fix.characterId],
        })
        return
      }
      case 'resolveThread': {
        /*
          Where the subplot lands, which is a fact about the book — not a mute
          button. The scene is the thread's own last beat and is named in the
          label, so the writer agreed to this exact assertion rather than to
          "make the warning go away".
        */
        await updatePlotThread(fix.threadId, { resolvedEventId: fix.eventId })
        return
      }
      case 'moveHere': {
        // Writes the one field the finding is about, at the one moment it is
        // about, and carries the rest of the state forward from the last record
        // at or before this scene. See `moveCharacterToScene`, which is where
        // that carry-forward lives and is tested.
        await moveCharacterToScene(
          { worldId, characterId: fix.characterId, eventId: fix.eventId, markerId: fix.markerId },
          allEvents,
          chapters,
        )
        return
      }
    }
  }

  function handleFix(issue: Issue) { void applyFix(issue) }

  /**
   * The ensemble case the review was actually about: eight characters in one
   * scene is eight warnings, and clearing them one at a time is the repetition
   * it names. Applied in sequence rather than in parallel because each
   * `upsertSnapshot` reads the character's existing rows to decide whether a
   * new one is needed.
   */
  function handleFixAll(batch: Issue[]) {
    void (async () => { for (const issue of batch) await applyFix(issue) })()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setCheckerOpen(false); return }
    if (navigableIssues.length === 0) return
    const at = navigableIssues.findIndex((i) => i.id === focusedId)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedId(navigableIssues[Math.min(at + 1, navigableIssues.length - 1)].id)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      // `at` is -1 before anything is focused, so this lands on the first row
      // rather than staying nowhere.
      setFocusedId(navigableIssues[Math.max(at - 1, 0)].id)
    } else if (e.key === 'Enter' && at >= 0) {
      e.preventDefault()
      handleNavigate(navigableIssues[at])
    }
  }

  if (!checkerOpen) return null

  const errors   = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')
  // Counted apart, so "50 warnings" on a finished novel stops being the headline
  // when 35 of them were observations about how the book is written.
  const notes    = issues.filter((i) => i.severity === 'note')
  const activeCount = issues.filter((i) => !suppressedSet.has(i.id)).length
  const suppressedCount = suppressedIds.size

  // Per-category visible issues (respects showSuppressed)
  const charIssues    = issues.filter((i) => i.category === 'character')
  const itemIssues    = issues.filter((i) => i.category === 'item')
  const relIssues     = issues.filter((i) => i.category === 'relationship')
  const factionIssues = issues.filter((i) => i.category === 'faction')
  const povIssues     = issues.filter((i) => i.category === 'pov')
  const proseIssues   = issues.filter((i) => i.category === 'prose')
  const threadIssues  = issues.filter((i) => i.category === 'thread')
  const worldIssues   = issues.filter((i) => i.category === 'world')



  return (
    <div
      className="fixed inset-0 z-[3000] flex items-start justify-center pt-[8vh]"
      onClick={() => setCheckerOpen(false)}
    >
      <div className={cn('absolute inset-0', MODAL_BACKDROP)} />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Continuity Checker"
        tabIndex={0}
        className="relative z-10 flex w-full max-w-xl flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl outline-none"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-5 py-3.5">
          {activeCount === 0
            ? <ShieldCheck className="h-4 w-4 text-green-400" />
            : <ShieldAlert className="h-4 w-4 text-amber-400" />
          }
          <span className="text-sm font-semibold">Continuity Checker</span>
          {issues.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              {errors.length > 0 && (
                <span className="rounded bg-red-500/20 px-2 py-0.5 text-red-400">{errors.length} error{errors.length !== 1 ? 's' : ''}</span>
              )}
              {notes.length > 0 && (
                <span className="rounded bg-[hsl(var(--muted))] px-2 py-0.5 text-[hsl(var(--muted-foreground))]">{notes.length} observation{notes.length !== 1 ? 's' : ''}</span>
              )}
              {warnings.length > 0 && (
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-400">{warnings.length} warning{warnings.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          )}
          <button
            aria-label="Close Continuity Checker"
            className="ml-auto text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            onClick={() => setCheckerOpen(false)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-3">
          {activeCount === 0 && !showSuppressed ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <ShieldCheck className="h-10 w-10 text-green-400" />
              <p className="text-sm font-medium text-[hsl(var(--foreground))]">No issues found</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                No continuity errors detected across {characters.length} character{characters.length !== 1 ? 's' : ''}, {items.length} item{items.length !== 1 ? 's' : ''}, {rels.length} relationship{rels.length !== 1 ? 's' : ''}, {allFactions.length} faction{allFactions.length !== 1 ? 's' : ''}, and POV assignments.
              </p>
            </div>
          ) : (
            <>
              <CategorySection title="Characters" icon={Users} issues={charIssues}
                focusedId={focusedId}
                suppressedIds={suppressedSet} suppressedNotes={suppressedNotes} showSuppressed={showSuppressed}
                onNavigate={handleNavigate} onFix={handleFix} onFixAll={handleFixAll} onSuppress={(i, note) => { toggleContinuitySuppression(worldId ?? '', i.id); if (note) setContinuitySuppressionNote(worldId ?? '', i.id, note) }} />
              <CategorySection title="Items" icon={Package} issues={itemIssues}
                focusedId={focusedId}
                suppressedIds={suppressedSet} suppressedNotes={suppressedNotes} showSuppressed={showSuppressed}
                onNavigate={handleNavigate} onFix={handleFix} onFixAll={handleFixAll} onSuppress={(i, note) => { toggleContinuitySuppression(worldId ?? '', i.id); if (note) setContinuitySuppressionNote(worldId ?? '', i.id, note) }} />
              <CategorySection title="Relationships" icon={Network} issues={relIssues}
                focusedId={focusedId}
                suppressedIds={suppressedSet} suppressedNotes={suppressedNotes} showSuppressed={showSuppressed}
                onNavigate={handleNavigate} onFix={handleFix} onFixAll={handleFixAll} onSuppress={(i, note) => { toggleContinuitySuppression(worldId ?? '', i.id); if (note) setContinuitySuppressionNote(worldId ?? '', i.id, note) }} />
              <CategorySection title="Factions" icon={Shield} issues={factionIssues}
                focusedId={focusedId}
                suppressedIds={suppressedSet} suppressedNotes={suppressedNotes} showSuppressed={showSuppressed}
                onNavigate={handleNavigate} onFix={handleFix} onFixAll={handleFixAll} onSuppress={(i, note) => { toggleContinuitySuppression(worldId ?? '', i.id); if (note) setContinuitySuppressionNote(worldId ?? '', i.id, note) }} />
              <CategorySection title="POV" icon={Eye} issues={povIssues}
                focusedId={focusedId}
                suppressedIds={suppressedSet} suppressedNotes={suppressedNotes} showSuppressed={showSuppressed}
                onNavigate={handleNavigate} onFix={handleFix} onFixAll={handleFixAll} onSuppress={(i, note) => { toggleContinuitySuppression(worldId ?? '', i.id); if (note) setContinuitySuppressionNote(worldId ?? '', i.id, note) }} />
              <CategorySection title="Prose vs. record" icon={PenLine} issues={proseIssues}
                focusedId={focusedId}
                suppressedIds={suppressedSet} suppressedNotes={suppressedNotes} showSuppressed={showSuppressed}
                onNavigate={handleNavigate} onFix={handleFix} onFixAll={handleFixAll} onSuppress={(i, note) => { toggleContinuitySuppression(worldId ?? '', i.id); if (note) setContinuitySuppressionNote(worldId ?? '', i.id, note) }} />
              <CategorySection title="Plot threads" icon={Spline} issues={threadIssues}
                focusedId={focusedId}
                suppressedIds={suppressedSet} suppressedNotes={suppressedNotes} showSuppressed={showSuppressed}
                onNavigate={handleNavigate} onFix={handleFix} onFixAll={handleFixAll} onSuppress={(i, note) => { toggleContinuitySuppression(worldId ?? '', i.id); if (note) setContinuitySuppressionNote(worldId ?? '', i.id, note) }} />
              {/*
                Places and the clock. Every other heading names something a
                finding is *about* — a character, an item, a subplot — and these
                two are about neither: a razed town standing again, and a scene
                dated before the one in front of it. They belong to the world.
              */}
              <CategorySection title="Places & time" icon={MapPin} issues={worldIssues}
                focusedId={focusedId}
                suppressedIds={suppressedSet} suppressedNotes={suppressedNotes} showSuppressed={showSuppressed}
                onNavigate={handleNavigate} onFix={handleFix} onFixAll={handleFixAll} onSuppress={(i, note) => { toggleContinuitySuppression(worldId ?? '', i.id); if (note) setContinuitySuppressionNote(worldId ?? '', i.id, note) }} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-[hsl(var(--border))] px-5 py-2">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
            ↑↓ navigate · Enter go to scene
          </span>
          {suppressedCount > 0 && (
            <button
              onClick={() => setShowSuppressed((v) => !v)}
              className="ml-auto flex items-center gap-1.5 text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              {showSuppressed ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {showSuppressed ? 'Hide' : 'Show'} {suppressedCount} suppressed
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
