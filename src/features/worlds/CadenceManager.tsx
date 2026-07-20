import { useState } from 'react'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import type { TagCadenceRow } from '@/lib/tagCadence'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

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
}

/**
 * Shared cadence view: a per-chapter presence strip for each tagged entity
 * (plot thread, motif, …) with dangling/dormant warnings, plus inline create
 * and delete. Both the Plot Threads and Motifs dashboard panels render this.
 */
export function CadenceManager<T extends Entity>({
  rows, chapterCount, noun, placeholder, onCreate, onDelete, warningFor,
}: CadenceManagerProps<T>) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

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
            const warn = warningFor(r)
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

                <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]"
                  title={`${r.eventCount} scene${r.eventCount === 1 ? '' : 's'} across ${chapterCount} chapters`}>
                  {r.eventCount} sc
                </span>
                <button
                  onClick={() => onDelete(r.entity.id)}
                  aria-label={`Delete ${noun} ${r.entity.name}`}
                  className="shrink-0 text-[hsl(var(--muted-foreground))] opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
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
    </div>
  )
}
