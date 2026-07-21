import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ListChecks, AlertTriangle, X, ArrowRight } from 'lucide-react'
import { useWorldEvents, useWorldChapters, updateEvent } from '@/db/hooks/useTimeline'
import { BEAT_TEMPLATES, beatTemplateById, beatActColor } from '@/lib/storyBeats'
import { buildBeatSheet } from '@/lib/structureBoard'
import { useAppStore } from '@/store'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'

export default function StructureView() {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const { setActiveEventId } = useAppStore()

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
          description="The structure board maps your events onto a story template (Three-Act, Save the Cat, Hero's Journey). Add chapters and events on the Timeline, then tag their structural beats."
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
        <select
          value={templateId}
          onChange={(e) => chooseTemplate(e.target.value)}
          aria-label="Structure template"
          className="h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        >
          {BEAT_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <ol className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {sheet.slots.map((slot) => {
            const tint = beatActColor(slot.beat.act)
            return (
              <li
                key={slot.beat.id}
                className={`flex items-center gap-3 rounded-md border bg-[hsl(var(--card))] px-3 py-2 ${
                  slot.outOfOrder ? 'border-amber-500/50' : 'border-[hsl(var(--border))]'
                }`}
                style={{ borderLeft: `3px solid ${tint}` }}
              >
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
                  <select
                    value=""
                    aria-label={`Assign a scene to ${slot.beat.label}`}
                    onChange={(e) => { if (e.target.value) updateEvent(e.target.value, { structureBeat: slot.beat.id }) }}
                    className="h-7 w-40 shrink-0 rounded border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1.5 text-xs text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  >
                    <option value="">+ Assign a scene…</option>
                    {orderedEvents.map(({ e, label }) => (
                      <option key={e.id} value={e.id}>{label}</option>
                    ))}
                  </select>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
