import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Plus, Trash2, AlertTriangle, Link2 } from 'lucide-react'
import type { Chapter, WorldEvent } from '@/types'
import type { TagCadenceRow } from '@/lib/tagCadence'
import { AttachScenesDialog, type TagField } from './AttachScenesDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { plural } from '@/lib/plural'

interface Entity { id: string; name: string; color: string }

interface CadenceManagerProps<T extends Entity> {
  rows: TagCadenceRow<T>[]
  chapterCount: number
  /** Verb for the create button and placeholder, e.g. "thread" or "motif". */
  noun: string
  placeholder: string
  onCreate: (name: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  /** Warning copy for a dangling / dormant row, or null when it's healthy. */
  warningFor: (row: TagCadenceRow<T>) => string | null
  /**
   * What this row has already been answered with, and how to take it back —
   * a subplot the writer has said resolves somewhere. Motifs have no such
   * notion, so the panel that has one supplies it and the other does not.
   */
  settledFor?: (row: TagCadenceRow<T>) => { label: string; onClear: () => void | Promise<void> } | null
  /** Which list on a scene carries this entity, for the attach dialog (HB-8). */
  field: TagField
  chapters: Chapter[]
  events: WorldEvent[]
}

/**
 * Shared cadence view: a per-chapter presence strip for each tagged entity
 * (plot thread, motif, …) with dangling/dormant warnings, plus inline create
 * and delete. Both the Plot Threads and Motifs dashboard panels render this.
 */
export function CadenceManager<T extends Entity>({
  rows, chapterCount, noun, placeholder, onCreate, onDelete, warningFor, settledFor, field, chapters, events,
}: CadenceManagerProps<T>) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [attaching, setAttaching] = useState<T | null>(null)
  /*
    HB-2d: this delete used to fire on the click. Reaching it needed a hover,
    which is not a gesture a phone has — and now that these controls are drawn
    permanently and are tappable there, an unconfirmed destructive action would
    be one stray tap from removing a thread or motif and every scene's link to
    it. Confirmed like every other delete in the app.
  */
  const [confirming, setConfirming] = useState<T | null>(null)

  async function create() {
    if (!name.trim()) return
    await onCreate(name.trim())
    setName('')
    setCreating(false)
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => {
            const settled = settledFor?.(r) ?? null
            // An answered row is not a warning row: it has been dealt with.
            const warn = settled ? null : warningFor(r)
            return (
              <div
                key={r.entity.id}
                className={cn(
                  'group flex items-center gap-3 rounded-md border bg-[hsl(var(--card))] px-3 py-2',
                  warn ? 'border-amber-500/40' : 'border-[hsl(var(--border))]',
                )}
              >
                <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: r.entity.color }} />
                <span className="w-28 shrink-0 truncate text-sm font-medium text-[hsl(var(--foreground))]">{r.entity.name}</span>

                {/* Per-chapter beat strip */}
                <div className="flex flex-1 items-center gap-px overflow-hidden" aria-hidden="true">
                  {r.presenceByChapter.map((beat, i) => (
                    <span
                      key={i}
                      className="h-3 min-w-[2px] flex-1 rounded-[1px]"
                      style={{ background: beat ? r.entity.color : 'hsl(var(--muted))' }}
                    />
                  ))}
                </div>

                {settled && (
                  <span className="flex shrink-0 items-center gap-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                    {settled.label}
                    <button
                      onClick={() => { void settled.onClear() }}
                      className="pw-tap rounded px-1 underline decoration-dotted hover:text-[hsl(var(--foreground))]"
                    >
                      reopen
                    </button>
                  </span>
                )}
                <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]"
                  title={`${r.eventCount} scene${r.eventCount === 1 ? '' : 's'} across ${plural(chapterCount, 'chapter')}`}>
                  {r.eventCount} sc
                </span>
                {/*
                  HB-2a / LORE-1: `opacity-0` with pointer events still live
                  hit-tests to itself, so on a touch device — where there is no
                  hover and the resting state is the only state — a tap on an
                  apparently blank row fires this. It keeps the hover reveal and
                  gains a focus reveal, but cannot be activated while invisible.
                */}
                {/*
                  HB-8: the row said "no scenes tagged yet" and offered nothing
                  to do about it, so the feature read as unfinished the moment
                  it was created. Always present, for two reasons: a control
                  that answers "this looks unfinished" cannot itself be hidden
                  until hover, and on a touch device there is no hover to find
                  it with. It is also deliberately **not** `pointer-events-none`
                  the way the delete beside it is (HB-2a) — that gate costs a
                  deliberate hover, which is right for deleting and wrong for
                  everything else. Attaching a second scene is the same act as
                  the first, so it does not appear only on an empty row.
                */}
                <button
                  onClick={() => setAttaching(r.entity)}
                  aria-label={`Attach scenes to ${noun} ${r.entity.name}`}
                  className="shrink-0 text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
                  title={`Attach scenes to this ${noun}`}
                >
                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setConfirming(r.entity)}
                  aria-label={`Delete ${noun} ${r.entity.name}`}
                  className="shrink-0 text-[hsl(var(--muted-foreground))] opacity-0 pointer-events-none transition-opacity hover:text-red-400 group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
                  title={`Delete ${noun}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                {warn && (
                  <span className="hidden lg:flex w-56 shrink-0 items-center justify-end gap-1 text-[10px] text-amber-500">
                    <AlertTriangle className="h-2.5 w-2.5" /> {warn}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {creating ? (
        <div className="flex items-center gap-2">
          <Input
            className="h-8 w-56 text-sm"
            placeholder={placeholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') create()
              if (e.key === 'Escape') { setCreating(false); setName('') }
            }}
            autoFocus
          />
          <Button size="sm" onClick={create} disabled={!name.trim()}>Add</Button>
          <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setName('') }}>Cancel</Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="gap-1.5 self-start" onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5" /> New {noun}
        </Button>
      )}

      {attaching && (
        <AttachScenesDialog
          open
          onOpenChange={(o) => { if (!o) setAttaching(null) }}
          entityId={attaching.id}
          entityName={attaching.name}
          noun={noun}
          field={field}
          chapters={chapters}
          events={events}
        />
      )}

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(o) => { if (!o) setConfirming(null) }}
        title={`Delete ${noun}?`}
        description={`Delete "${confirming?.name ?? ''}"? Scenes tagged with it keep their prose; only the ${noun} and its links go.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (confirming) await onDelete(confirming.id)
          setConfirming(null)
        }}
      />
    </div>
  )
}
