import { useMemo, useState } from 'react'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import type { Chapter, WorldEvent } from '@/types'
import { usePlotThreads, createPlotThread, deletePlotThread } from '@/db/hooks/usePlotThreads'
import { computeThreadCadence, type ThreadCadence as ThreadRow } from '@/lib/plotThreads'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const THREAD_COLORS = ['#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#3b82f6', '#ec4899', '#14b8a6', '#f97316']

/**
 * Plot-thread cadence: each subplot's beats across the chapters, so dangling or
 * long-dormant threads stand out. Threads are created and removed here; events
 * are tagged with them on the event card.
 */
export function ThreadCadence({ worldId, chapters, events }: {
  worldId: string
  chapters: Chapter[]
  events: WorldEvent[]
}) {
  const threads = usePlotThreads(worldId)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const { rows, chapterCount } = useMemo(
    () => computeThreadCadence({ threads, events, chapters }),
    [threads, events, chapters]
  )

  async function create() {
    if (!name.trim()) return
    const color = THREAD_COLORS[threads.length % THREAD_COLORS.length]
    await createPlotThread({ worldId, name: name.trim(), color })
    setName('')
    setCreating(false)
  }

  function danglingNote(r: ThreadRow): string | null {
    if (r.eventCount === 0) return 'no scenes tagged yet'
    if (r.trailingGap >= 3) return `dangling — last advanced Ch. ${r.lastChapterNumber}, quiet ${r.trailingGap} chapters`
    if (r.longestDormancy >= 3) return `goes quiet for ${r.longestDormancy} chapters mid-story`
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => {
            const warn = danglingNote(r)
            return (
              <div
                key={r.thread.id}
                className={cn(
                  'group flex items-center gap-3 rounded-md border bg-[hsl(var(--card))] px-3 py-2',
                  warn ? 'border-amber-500/40' : 'border-[hsl(var(--border))]',
                )}
              >
                <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: r.thread.color }} />
                <span className="w-28 shrink-0 truncate text-sm font-medium text-[hsl(var(--foreground))]">{r.thread.name}</span>

                {/* Per-chapter beat strip */}
                <div className="flex flex-1 items-center gap-px overflow-hidden" aria-hidden="true">
                  {r.presenceByChapter.map((beat, i) => (
                    <span
                      key={i}
                      className="h-3 min-w-[2px] flex-1 rounded-[1px]"
                      style={{ background: beat ? r.thread.color : 'hsl(var(--muted))' }}
                    />
                  ))}
                </div>

                <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]"
                  title={`${r.eventCount} scene${r.eventCount === 1 ? '' : 's'} across ${chapterCount} chapters`}>
                  {r.eventCount} sc
                </span>
                <button
                  onClick={() => deletePlotThread(r.thread.id)}
                  aria-label={`Delete thread ${r.thread.name}`}
                  className="shrink-0 text-[hsl(var(--muted-foreground))] opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  title="Delete thread"
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
            placeholder="Thread name (e.g. The Rebellion)…"
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
          <Plus className="h-3.5 w-3.5" /> New thread
        </Button>
      )}
    </div>
  )
}
