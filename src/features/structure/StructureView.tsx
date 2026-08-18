import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ListChecks, AlertTriangle, X, ArrowRight } from 'lucide-react'
import { useWorldEvents, useWorldChapters, updateEvent } from '@/db/hooks/useTimeline'
import { BEAT_TEMPLATES, beatTemplateById, beatActColor } from '@/lib/storyBeats'
import { buildBeatSheet, CONVENTIONAL_ACT_SHARE } from '@/lib/structureBoard'
import type { StructureProportion } from '@/lib/structureBoard'
import { useAppStore } from '@/store'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/**
 * Shows how the book's chapters actually divide between the acts, against the
 * conventional quarter–half–quarter. A beat sheet exists to answer "does Act 2
 * sag?", and a list of equal-height rows cannot.
 */
function ActRuler({ proportion }: { proportion: StructureProportion }) {
  const { spans, chapterCount, reason } = proportion

  if (!spans) {
    return (
      <div className="mb-4 rounded-md border border-dashed border-[hsl(var(--border))] px-3 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">
        {reason === 'out-of-order'
          ? 'Act 3 opens before Act 2, so the acts can’t be measured yet — check the beats flagged below.'
          : 'Place a beat in Act 2 and one in Act 3 to see how your chapters divide between the acts.'}
      </div>
    )
  }

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-baseline gap-2">
        <h2 className="text-xs font-medium text-[hsl(var(--foreground))]">How the book divides</h2>
        <span className="text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">
          {chapterCount} {chapterCount === 1 ? 'chapter' : 'chapters'}
        </span>
      </div>

      <div className="relative flex h-7 overflow-hidden rounded-md border border-[hsl(var(--border))]">
        {spans.map((span) => {
          const tint = beatActColor(span.act)
          return (
            <div
              key={span.act}
              data-act={span.act}
              data-share={span.share.toFixed(4)}
              style={{ width: `${span.share * 100}%`, background: `${tint}59`, color: tint }}
              className="flex items-center justify-center overflow-hidden border-r border-[hsl(var(--background))] text-[10px] font-medium whitespace-nowrap last:border-r-0"
            >
              {span.share >= 0.07 && `Act ${span.act}`}
            </div>
          )
        })}
        {/* The conventional shape, for comparison only — nothing warns when a book departs from it. */}
        {[CONVENTIONAL_ACT_SHARE[0], CONVENTIONAL_ACT_SHARE[0] + CONVENTIONAL_ACT_SHARE[1]].map((at) => (
          <span
            key={at}
            aria-hidden="true"
            style={{ left: `${at * 100}%` }}
            className="pointer-events-none absolute top-0 h-full border-l border-dashed border-[hsl(var(--foreground)/0.35)]"
          />
        ))}
      </div>

      <p className="mt-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
        {spans.map((span, i) => (
          <span key={span.act}>
            {i > 0 && ' · '}
            <span style={{ color: beatActColor(span.act) }}>Act {span.act}</span>{' '}
            {span.chapterCount === 0
              ? 'no chapters of its own'
              : `Ch. ${span.startChapter}${span.chapterCount > 1 ? `–${span.endChapter}` : ''} (${Math.round(span.share * 100)}%)`}
          </span>
        ))}
        <span className="ml-1 opacity-70">— dashes mark the conventional 25 / 50 / 25.</span>
      </p>
    </div>
  )
}

export default function StructureView() {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const { activeEventId, setActiveEventId } = useAppStore()

  const events = useWorldEvents(worldId ?? null)
  const chapters = useWorldChapters(worldId ?? null)

  const tplKey = `plotweave-structure-template-${worldId}`
  const [templateId, setTemplateId] = useState<string>(() => localStorage.getItem(tplKey) || 'three-act')
  function chooseTemplate(id: string) {
    setTemplateId(id)
    localStorage.setItem(tplKey, id)
  }
  const template = beatTemplateById(templateId) ?? BEAT_TEMPLATES[0]

  const sheet = useMemo(
    () => buildBeatSheet({ template, events, chapters }),
    [template, events, chapters]
  )

  // Events in narrative order, for the assign picker.
  const orderedEvents = useMemo(() => {
    const chNum = new Map(chapters.map((c) => [c.id, c.number]))
    return [...events].sort((a, b) =>
      (chNum.get(a.chapterId) ?? 0) - (chNum.get(b.chapterId) ?? 0) || a.sortOrder - b.sortOrder
    ).map((e) => ({ e, label: `Ch. ${chNum.get(e.chapterId) ?? '—'} · ${e.title || 'Untitled'}` }))
  }, [events, chapters])

  function openEvent(eventId: string, chapterId: string) {
    setActiveEventId(eventId)
    navigate(`/worlds/${worldId}/timeline/${chapterId}`)
  }

  if (chapters.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={ListChecks}
          title="No chapters yet"
          description="The structure board maps your scenes onto a story template (Three-Act, Save the Cat, Hero's Journey). Add chapters and scenes on the Timeline, then tag their structural beats."
          action={<Button size="sm" variant="outline" onClick={() => navigate(`/worlds/${worldId}/timeline`)}>Go to Timeline</Button>}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-[hsl(var(--border))] px-6 py-3">
        <div className="mr-auto">
          <h1 className="text-lg font-semibold text-[hsl(var(--foreground))]">Structure</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{template.blurb}</p>
        </div>
        <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
          {sheet.filled} / {sheet.total} beats placed
        </span>
        {/*
          ST-3: both controls on this screen were native selects, where the app
          uses its own Select in 66 places across 19 files against 14 native
          ones. Both are converted rather than only the switcher the finding
          names — leaving one of two on the same screen would trade a
          product-wide inconsistency for one you can see in a single glance.
        */}
        <Select value={templateId} onValueChange={chooseTemplate}>
          <SelectTrigger className="h-8 w-auto gap-2 text-xs" aria-label="Structure template">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BEAT_TEMPLATES.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-5xl">
          <ActRuler proportion={sheet.proportion} />
        </div>
        <ol className="mx-auto flex max-w-5xl flex-col gap-1.5">
          {sheet.slots.map((slot) => {
            const tint = beatActColor(slot.beat.act)
            return (
              // W-1: the beat holding the scene the cursor is on is marked, so
              // the chapter bar changes something here rather than sitting under
              // a board that ignores it.
              <li
                key={slot.beat.id}
                aria-current={slot.event && slot.event.id === activeEventId ? 'true' : undefined}
                className={`flex items-center gap-3 rounded-md border bg-[hsl(var(--card))] px-3 py-2 ${
                  slot.event && slot.event.id === activeEventId
                    ? 'border-[hsl(var(--ring))] ring-1 ring-[hsl(var(--ring))]'
                    : slot.outOfOrder ? 'border-amber-500/50' : 'border-[hsl(var(--border))]'
                }`}
                style={{ borderLeft: `3px solid ${tint}` }}
              >
                {/* ST-2: the slack used to pool here, beside the hint, because
                    this was `flex-1` against a position track pinned at 112px.
                    Both flex now, so the middle goes to the track instead of to
                    empty space. A `max-w` on this column was tried as well and
                    dropped: at 1600px each side settles at 406px, under any cap
                    worth setting, so it changed nothing. */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[hsl(var(--foreground))]">{slot.beat.label}</span>
                    <span className="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide" style={{ background: `${tint}22`, color: tint }}>
                      Act {slot.beat.act}
                    </span>
                    {slot.outOfOrder && (
                      <span className="flex items-center gap-0.5 text-[10px] text-amber-400" title="This beat's scene falls earlier than a later beat's — check the order.">
                        <AlertTriangle className="h-2.5 w-2.5" /> out of order
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{slot.beat.hint}</p>
                </div>

                {/* Where the beat falls along the book. Stacked down the list these
                    read as a profile: beats bunched at the right edge are beats
                    crammed into the last chapter. */}
                <div
                  data-beat-track
                  className="hidden min-w-[7rem] flex-1 sm:block"
                  title={
                    slot.narrativeFraction === null
                      ? 'Not placed'
                      : `Ch. ${slot.chapterNumber} of ${sheet.proportion.chapterCount} — ${Math.round(slot.narrativeFraction * 100)}% through`
                  }
                >
                  <div className="relative h-1 rounded-full bg-[hsl(var(--muted))]">
                    {slot.narrativeFraction !== null && (
                      <span
                        data-beat-position={slot.beat.id}
                        data-fraction={slot.narrativeFraction.toFixed(4)}
                        style={{ left: `${slot.narrativeFraction * 100}%`, background: tint }}
                        className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      />
                    )}
                  </div>
                </div>

                {slot.event ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEvent(slot.event!.id, slot.event!.chapterId)}
                      className="group flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-left text-xs transition-colors hover:border-[hsl(var(--ring)/0.5)]"
                      title="Open this scene"
                    >
                      <span className="max-w-[14rem] truncate font-medium text-[hsl(var(--foreground))]">{slot.event.title || 'Untitled'}</span>
                      <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">Ch. {slot.chapterNumber}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => updateEvent(slot.event!.id, { structureBeat: null })}
                      aria-label={`Clear ${slot.beat.label}`}
                      title="Unassign this beat"
                      className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <Select
                    value=""
                    onValueChange={(v) => { if (v) updateEvent(v, { structureBeat: slot.beat.id }) }}
                  >
                    <SelectTrigger
                      aria-label={`Assign a scene to ${slot.beat.label}`}
                      className="h-7 w-40 shrink-0 border-dashed text-xs text-[hsl(var(--muted-foreground))]"
                    >
                      <SelectValue placeholder="+ Assign a scene…" />
                    </SelectTrigger>
                    <SelectContent>
                      {orderedEvents.map(({ e, label }) => (
                        <SelectItem key={e.id} value={e.id}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
