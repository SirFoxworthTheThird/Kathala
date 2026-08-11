import { useState, useMemo, useEffect, type ElementType, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Map as MapIcon, Users, Network, BookOpen, Globe,
  Package, BarChart2, ShieldAlert, Clock, Layers, Pencil, FileEdit, Spline, PenLine, Sparkle,
  ChevronRight,
} from 'lucide-react'
import type { EventStatus } from '@/types'
import { EVENT_STATUSES, eventStatusConfig } from '@/lib/eventStatus'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useWorld, updateWorld } from '@/db/hooks/useWorlds'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useReadingGate } from '@/db/hooks/useReading'
import { describeReadingPosition } from '@/lib/readingNotice'
import { useRootMapLayers } from '@/db/hooks/useMapLayers'
import { useTimelines, useWorldChapters, useWorldEvents } from '@/db/hooks/useTimeline'
import { useRelationships } from '@/db/hooks/useRelationships'
import { useTimelineRelationships } from '@/db/hooks/useTimelineRelationships'
import { useItems } from '@/db/hooks/useItems'
import { useWorldSnapshots } from '@/db/hooks/useSnapshots'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useLorePages } from '@/db/hooks/useLore'
import { useFactions } from '@/db/hooks/useFactions'
import { Button } from '@/components/ui/button'
import { PortraitImage } from '@/components/PortraitImage'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { OnboardingWizard } from '@/features/onboarding'
import { DashboardSuggestion } from './DashboardSuggestion'
import { CastBalance } from './CastBalance'
import { ThreadCadence } from './ThreadCadence'
import { MotifCadence } from './MotifCadence'
import { WritingProgress } from './WritingProgress'
import { evaluateSuggestions, type WorldSummaryData } from './suggestionRules'
import { relativeTime } from '@/lib/relativeTime'
import { plural } from '@/lib/plural'

// ── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, dim }: { label: string; value: string | number; dim?: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] px-2 py-0.5 text-[11px]',
      dim ? 'text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--foreground))]'
    )}>
      <span className="font-semibold">{value}</span>
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
    </span>
  )
}

// ── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ icon: Icon, children, aside }: { icon: ElementType; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
      <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">{children}</h2>
      {aside}
    </div>
  )
}

// ── Main view ────────────────────────────────────────────────────────────────

export default function WorldDashboardView() {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const { setActiveEventId, setCheckerOpen } = useAppStore()

  const world               = useWorld(worldId ?? null)
  const allCharacters       = useCharacters(worldId ?? null)
  const maps                = useRootMapLayers(worldId ?? null)
  const timelines           = useTimelines(worldId ?? null)
  const chapters            = useWorldChapters(worldId ?? null)
  const allEvents           = useWorldEvents(worldId ?? null)
  const relationships       = useRelationships(worldId ?? null)
  const timelineRelationships = useTimelineRelationships(worldId ?? null)
  const items               = useItems(worldId ?? null)
  const snapshots           = useWorldSnapshots(worldId ?? null)
  const locationMarkers     = useAllLocationMarkers(worldId ?? null)
  const lorePages           = useLorePages(worldId ?? null)
  const factions            = useFactions(worldId ?? null)

  // ── Wizard trigger (loading-aware) ─────────────────────────────────────────
  // Use raw counts so we get `undefined` while IndexedDB is still loading,
  // avoiding a false-positive empty-world flash on worlds that have data.
  const timelineCount = useLiveQuery(
    () => worldId ? db.timelines.where('worldId').equals(worldId).count() : 0,
    [worldId]
  )
  const eventCount = useLiveQuery(
    () => worldId ? db.events.where('worldId').equals(worldId).count() : 0,
    [worldId]
  )
  const wizardReady = timelineCount !== undefined && eventCount !== undefined

  // Latch: keep the wizard mounted until it explicitly exits, even after step 1
  // creates an event (which would clear the trigger condition mid-session).
  const [wizardLatch, setWizardLatch] = useState(false)
  // ...and once it has exited, leave it exited. Without this the latch re-armed
  // itself the moment it was released: "Skip and explore on my own" set it
  // false, the effect below saw the trigger condition still true and set it
  // straight back, so skipping was a no-op for any world without an event —
  // which is every world the wizard appears for.
  const [wizardDismissed, setWizardDismissed] = useState(false)
  useEffect(() => {
    // Only for a world that has not been started. It used to trigger on
    // `eventCount === 0` too, so a writer who built a timeline and chapters on
    // the Timeline screen came back to the dashboard and was asked, at step 1
    // of 4, to name a timeline they had already named.
    if (wizardReady && !wizardLatch && !wizardDismissed && timelineCount === 0) {
      setWizardLatch(true)
    }
  }, [wizardReady, wizardLatch, wizardDismissed, timelineCount])

  // ── Dashboard suggestions ─────────────────────────────────────────────────
  const dismissedKey = worldId ? `plotweave-dismissed-suggestions-${worldId}` : null
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    if (!dismissedKey) return []
    try { return JSON.parse(localStorage.getItem(dismissedKey) ?? '[]') } catch { return [] }
  })

  function dismissSuggestion(id: string) {
    const updated = [...dismissedIds, id]
    setDismissedIds(updated)
    if (dismissedKey) localStorage.setItem(dismissedKey, JSON.stringify(updated))
  }

  // Inline description editing
  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft]     = useState('')

  function startEditDesc() {
    setDescDraft(world?.description ?? '')
    setEditingDesc(true)
  }
  async function saveDesc() {
    if (!worldId) return
    await updateWorld(worldId, { description: descDraft.trim() })
    setEditingDesc(false)
  }

  // Reading mode: the dashboard is a summary of the whole book, so nearly every
  // figure on it is a spoiler. Counts are taken over what the reader has met,
  // and the alive/dead split is dropped entirely — "7 dead" in chapter two
  // tells you the body count of a book you have not finished.
  const gate = useReadingGate(worldId ?? null)
  const characters = gate.filter(allCharacters)

  // Derived stats
  const aliveCount = characters.filter((c) => c.isAlive).length
  const deadCount  = characters.length - aliveCount
  const totalEvents   = allEvents.length
  const totalChapters = chapters.length
  // Events that have at least one snapshot recorded
  const eventsWithSnap = useMemo(() => {
    const eventIds = new Set(snapshots.map((s) => s.eventId))
    return allEvents.filter((e) => eventIds.has(e.id)).length
  }, [snapshots, allEvents])
  const coveragePct = totalEvents > 0 ? Math.round((eventsWithSnap / totalEvents) * 100) : 0

  // 5 most recently updated events. Suppressed for a reader: "recently edited"
  // is an author's ordering, and it surfaces late-book scenes by title.
  const recentEvents = useMemo(() => {
    if (gate.active) return []
    return [...allEvents]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5)
  }, [allEvents, gate.active])

  const chapterById = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters])
  const timelineById = useMemo(() => new Map(timelines.map((t) => [t.id, t])), [timelines])

  const statusCounts = useMemo(() => {
    const counts: Record<EventStatus, number> = { idea: 0, outline: 0, draft: 0, revised: 0, final: 0 }
    for (const ev of allEvents) {
      // An unrecognised status would add a key of its own and turn the count
      // into NaN, which the bar below renders as a width of "NaN%". Anything
      // the app does not know about is counted as a draft.
      const s = ev.status ?? 'draft'
      counts[EVENT_STATUSES.includes(s) ? s : 'draft']++
    }
    return counts
  }, [allEvents])

  // ── Suggestion evaluation ─────────────────────────────────────────────────
  const summaryData: WorldSummaryData = {
    characterCount:        characters.length,
    eventCount:            allEvents.length,
    hasCharacterAtAnyEvent: snapshots.length > 0,
    relationshipCount:     relationships.length,
    mapLayerCount:         maps.length,
    lorePageCount:         lorePages.length,
    factionCount:          factions.length,
  }
  const activeSuggestions = evaluateSuggestions(summaryData, dismissedIds)

  // ── Nav tiles ─────────────────────────────────────────────────────────────
  type Tile = {
    label: string
    icon: ElementType
    count: number | null
    countSuffix?: string
    onClick: () => void
    pills: { label: string; value: number }[]
    description: string
  }
  const tiles: Tile[] = [
    {
      label: 'Timeline',
      icon: BookOpen,
      count: totalChapters,
      onClick: () => navigate('timeline'),
      pills: [
        { label: 'events', value: totalEvents },
        ...(timelines.length > 1 ? [{ label: 'timelines', value: timelines.length }] : []),
        ...(timelineRelationships.length > 0 ? [{ label: 'links', value: timelineRelationships.length }] : []),
      ],
      description: 'chapters',
    },
    {
      label: 'Characters',
      icon: Users,
      count: characters.length,
      onClick: () => navigate('characters'),
      pills: gate.active ? [] : [
        ...(aliveCount > 0 ? [{ label: 'alive', value: aliveCount }] : []),
        ...(deadCount > 0  ? [{ label: 'dead',  value: deadCount  }] : []),
      ],
      description: gate.active ? 'you have met so far' : 'in your cast',
    },
    {
      label: 'Maps',
      icon: MapIcon,
      count: maps.length,
      onClick: () => navigate('maps'),
      pills: locationMarkers.length > 0 ? [{ label: 'markers', value: locationMarkers.length }] : [],
      description: gate.active ? 'maps you have reached' : 'root map layers',
    },
    {
      label: 'Relationships',
      icon: Network,
      count: relationships.length,
      onClick: () => navigate('relationships'),
      pills: [],
      description: gate.active ? 'between characters you have met' : 'character connections',
    },
    {
      label: 'Items',
      icon: Package,
      count: items.length,
      onClick: () => navigate('items'),
      pills: [],
      description: gate.active ? 'you have seen so far' : 'in your catalogue',
    },
    {
      /*
        DASH-2: this was titled "Character Arc" and counted snapshot coverage —
        the name of a screen over a number measuring something else, two
        concepts in one tile. The title names the number now, and the line
        beneath says where pressing it goes. A reader gets the screen without
        the scorecard, so for them the tile is named for the screen and carries
        no number at all.
      */
      label: gate.active ? 'Character Arc' : 'Snapshot coverage',
      icon: BarChart2,
      count: gate.active ? null : coveragePct,
      countSuffix: '%',
      onClick: () => navigate('arc'),
      pills: !gate.active && eventsWithSnap > 0
        ? [{ label: `/ ${totalEvents} events`, value: eventsWithSnap }]
        : [],
      description: gate.active ? 'how the cast changes' : 'opens the Character Arc grid',
    },
    // The continuity checker reports on a draft, and reading mode takes it off
    // the top bar — a tile that opened it would be the one way back in.
    ...(gate.active
      ? []
      : [{
          label: 'Continuity',
          icon: ShieldAlert,
          count: null,
          onClick: () => setCheckerOpen(true),
          pills: [],
          description: 'check for issues',
        } as Tile]),
  ]

  if (!wizardReady) return (
    <div className="p-6 space-y-8 max-w-[100rem]">
      <div className="animate-pulse space-y-3">
        <div className="h-7 w-48 rounded bg-[hsl(var(--muted))]" />
        <div className="h-4 w-72 rounded bg-[hsl(var(--muted))]" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse h-24 rounded-lg bg-[hsl(var(--muted))]" />
        ))}
      </div>
    </div>
  )

  // Wizard replaces the dashboard while active
  if (wizardLatch && worldId) {
    return <OnboardingWizard worldId={worldId} onExit={() => { setWizardDismissed(true); setWizardLatch(false) }} />
  }

  return (
    <div className="p-6 space-y-8 max-w-[100rem]">

      {/* World header */}
      <div className="flex items-start justify-between gap-4">
        {world?.coverImageId && (
          <PortraitImage
            imageId={world.coverImageId}
            // Decorative until it became a control; now it is what names it.
            alt={world.name ? `${world.name} cover` : 'World cover'}
            className="h-16 w-24 shrink-0 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] object-contain"
            fallbackClassName="h-16 w-24 shrink-0 rounded-md border border-[hsl(var(--border))]"
            /*
              DASH-5: `PortraitImage` defaults its placeholder to a person, which
              is right for the portraits it was built for and wrong for a world.
              This slot only renders when a cover is set, so the placeholder is
              reached exactly when the cover is a *linked* image that has stopped
              answering — the world has pictures and is drawn as a stranger. The
              world card next door already falls back to a globe; the same world
              in two places should fall back to the same thing.
            */
            fallbackIcon={Globe}
            zoomable
          />
        )}
        <div className="flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            World
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">
            {world?.name ?? 'Loading…'}
          </h1>

          {editingDesc ? (
            <div className="mt-2 flex flex-col gap-2">
              <textarea
                className="w-full max-w-xl rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none"
                rows={3}
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                placeholder="Describe your world…"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveDesc}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingDesc(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            /*
              The same shape as SET-3 in World settings, fixed the same way: the
              text is the control that opens the editor, rather than a paragraph
              beside a 12px pencil. A reader gets the description as prose, since
              nothing here is theirs to edit.
            */
            gate.active ? (
              world?.description
                ? <p className="mt-1 max-w-xl text-sm text-[hsl(var(--muted-foreground))]">{world.description}</p>
                : null
            ) : (
              <button
                onClick={startEditDesc}
                aria-label={world?.description ? 'Edit world description' : 'Add a world description'}
                className="group mt-1 flex max-w-xl items-start gap-2 rounded border border-transparent px-2 py-1 text-left transition-colors hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/0.4)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
              >
                {world?.description
                  ? <span className="text-sm text-[hsl(var(--muted-foreground))]">{world.description}</span>
                  : <span className="text-sm italic text-[hsl(var(--muted-foreground)/0.5)]">Describe your world…</span>
                }
                <Pencil className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))] transition-colors group-hover:text-[hsl(var(--foreground))]" aria-hidden="true" />
              </button>
            )
          )}
        </div>
      </div>

      {/*
        RD-3: the dashboard is where the Library drops you, and it was the one
        screen in reading mode that never used the words. The mode was
        inferable only from a changed theme and sublabels like "you have met so
        far", and nothing said how to leave. Every roster explains itself; the
        landing screen now does too.
      */}
      {gate.active && (
        <aside
          aria-label="Reading mode"
          className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3"
        >
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">
              Reading mode is on
            </p>
            <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">
              {describeReadingPosition(gate.chapterNumber, gate.hiddenCounts)}{' '}
              Editing is put away while you read.
            </p>
          </div>
          {worldId && (
            <Link
              to={`/worlds/${worldId}/settings`}
              className="shrink-0 rounded-md border border-[hsl(var(--border))] px-2.5 py-1 text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent)/0.4)] hover:text-[hsl(var(--foreground))]"
            >
              Turn it off in settings
            </Link>
          )}
        </aside>
      )}

      {/* Suggestions are prompts to go and build something — "add your first
          character", "draw a map". There is nothing for a reader to act on. */}
      {!gate.active && activeSuggestions.length > 0 && (
        <section aria-live="polite" aria-label="Suggested next steps">
          <div className="flex flex-col gap-2">
            {activeSuggestions.map((rule) => (
              <DashboardSuggestion
                key={rule.id}
                title={rule.title}
                navLabel={rule.navLabel}
                dismissible={rule.dismissible}
                onNavigate={() => navigate(rule.navigateTo)}
                onDismiss={rule.dismissible ? () => dismissSuggestion(rule.id) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/*
        Nav tiles (DASH-4).

        A grid put seven tiles into rows of four and left a hole where the eye
        expects a fourth — and the count is not fixable by adding a tile, since
        reading mode drops Continuity and makes it six. So the row fills itself:
        the basis reproduces the old breakpoints exactly (two, three, four, six
        across) and `flex-1` hands the remainder to whatever is on the last row,
        so a short row is wide rather than gapped.
      */}
      <div data-dash-tiles className="flex flex-wrap gap-3">
        {tiles.map(({ label, icon: Icon, count, countSuffix, onClick, pills, description }) => (
          <button
            key={label}
            onClick={onClick}
            className="flex flex-1 basis-[calc(50%-0.375rem)] flex-col gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 text-left transition-colors hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--accent))] sm:basis-[calc(33.333%-0.5rem)] lg:basis-[calc(25%-0.5625rem)] 2xl:basis-[calc(16.666%-0.625rem)]"
          >
            <div className="flex items-center justify-between">
              <Icon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              {/*
                A tile with no count is an action, not a statistic — Continuity
                opens the checker, Character Arc opens the grid. A bold em-dash
                in the number slot read as a missing or unknown value, which on
                the Continuity tile especially is a different claim from "no
                issues". A chevron says "this goes somewhere" instead.
              */}
              {count !== null ? (
                <span className="text-xl font-bold text-[hsl(var(--foreground))]">
                  {`${count}${countSuffix ?? ''}`}
                </span>
              ) : (
                <ChevronRight className="h-5 w-5 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-[hsl(var(--foreground))]">{label}</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{description}</p>
            </div>
            {pills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {pills.map((p) => (
                  <StatPill key={p.label} value={p.value} label={p.label} dim />
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* "Recent" here means recently *edited*, ordered by updatedAt. That is a
          record of the author's last working session, and it says nothing about
          where the reader is in the book. */}
      {!gate.active && recentEvents.length > 0 && (
        <div>
          {/*
            DASH-3: "Recent Events" never said what recent meant, and across two
            columns the order was anyone's guess. The heading names the ordering
            and each row carries how long ago it was, so the sequence is legible
            from the rows themselves rather than from where they happen to land.
          */}
          <SectionHeading icon={Clock}>Recently edited</SectionHeading>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {recentEvents.map((ev) => {
              const ch = chapterById.get(ev.chapterId)
              const tl = ch ? timelineById.get(ch.timelineId) : null
              return (
                <button
                  key={ev.id}
                  onClick={() => {
                    setActiveEventId(ev.id)
                    navigate('timeline')
                  }}
                  className="flex items-center gap-3 rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-left transition-colors hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--accent))]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
                      {ev.title || <span className="italic opacity-50">Untitled event</span>}
                    </p>
                    <p className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">
                      {tl && timelines.length > 1 ? `${tl.name} · ` : ''}{ch ? `Ch. ${ch.number} — ${ch.title}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums text-[hsl(var(--muted-foreground))]">
                    {relativeTime(ev.updatedAt)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Idea, outline, draft, revised, final — the state of the manuscript,
          which a finished book does not have. */}
      {!gate.active && totalEvents > 0 && (
        <div>
          <SectionHeading
            icon={FileEdit}
            aside={<span className="text-xs text-[hsl(var(--muted-foreground))]">{plural(totalEvents, 'event')}</span>}
          >
            Scene Status
          </SectionHeading>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full">
            {EVENT_STATUSES.map((s) => {
              const count = statusCounts[s]
              if (count === 0) return null
              return (
                <div
                  key={s}
                  style={{ width: `${(count / totalEvents) * 100}%`, background: eventStatusConfig(s).color }}
                  title={`${eventStatusConfig(s).label}: ${count}`}
                />
              )
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            {EVENT_STATUSES.map((s) => {
              const count = statusCounts[s]
              if (count === 0) return null
              return (
                <div key={s} className="flex items-center gap-1 text-[11px]">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: eventStatusConfig(s).color }} />
                  <span className="text-[hsl(var(--muted-foreground))]">{eventStatusConfig(s).label}</span>
                  <span className="font-semibold text-[hsl(var(--foreground))]">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Word counts, a writing streak and a burndown against a deadline — the
          author's productivity, which is nobody else's business. */}
      {!gate.active && totalEvents > 0 && worldId && (
        <div>
          <SectionHeading icon={PenLine}>Writing Progress</SectionHeading>
          <WritingProgress worldId={worldId} wordTarget={world?.wordTarget} targetDate={world?.targetDate} />
        </div>
      )}

      {/* Cast balance answers "who am I neglecting?" — a craft diagnostic about
          the draft, and one that weighs a character's whole run in the book. */}
      {!gate.active && characters.length > 0 && totalChapters > 0 && (
        <div>
          <SectionHeading icon={Users}>Cast Balance</SectionHeading>
          <CastBalance worldId={worldId ?? ''} characters={characters} chapters={chapters} events={allEvents} />
        </div>
      )}

      {/* Plot threads and motifs are pacing analysis — how often a subplot
          surfaces across the book, and which threads dangle. That is a
          question about the draft, not about the story, and the thread names
          themselves ("Voldemort's Return") are among the sharpest spoilers in
          the world. Both step aside for a reader. */}
      {!gate.active && chapters.length > 0 && (
        <div>
          <SectionHeading icon={Spline}>Plot Threads</SectionHeading>
          <ThreadCadence worldId={worldId ?? ''} chapters={chapters} events={allEvents} />
        </div>
      )}

      {/* Motifs — recurring theme/symbol cadence */}
      {!gate.active && chapters.length > 0 && (
        <div>
          <SectionHeading icon={Sparkle}>Motifs &amp; Themes</SectionHeading>
          <MotifCadence worldId={worldId ?? ''} chapters={chapters} events={allEvents} />
        </div>
      )}

      {/* Timeline relationships — only shown when links exist */}
      {timelineRelationships.length > 0 && (
        <div>
          <SectionHeading icon={Layers}>Timeline Links</SectionHeading>
          <div className="flex flex-wrap gap-2">
            {timelineRelationships.map((rel) => {
              const src = timelineById.get(rel.sourceTimelineId)
              const tgt = timelineById.get(rel.targetTimelineId)
              return (
                <div
                  key={rel.id}
                  className="flex items-center gap-1.5 rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs"
                >
                  <span className="font-medium">{src?.name ?? '?'}</span>
                  <span className="text-[hsl(var(--muted-foreground))]">→</span>
                  <span className="font-medium">{tgt?.name ?? '?'}</span>
                  <span className="ml-1 rounded bg-[hsl(var(--accent))] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
                    {rel.type.replace(/_/g, ' ')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
