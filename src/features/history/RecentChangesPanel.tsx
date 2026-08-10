import { useEffect, useState } from 'react'
import { Undo2, X, History } from 'lucide-react'
import { describeOperation } from '@/lib/operations'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { useUndo } from './useUndo'
import { relativeTime } from '@/lib/relativeTime'


/**
 * Recent changes, newest first, with undo on the top entry.
 *
 * This is the primary home for undo rather than the toast: most journalled
 * operations are ordinary edits, whose results are already on screen and which
 * nobody wants interrupted by a notification. Reaching for undo on one of those
 * is deliberate, so it belongs somewhere the user goes — and on a phone, where
 * there is no keyboard shortcut, this is the only place it can live.
 *
 * Only the newest entry is undoable: the journal is a stack, and taking back
 * something from the middle would leave the later operations resting on a state
 * that never existed.
 */
export function RecentChangesPanel({ worldId }: { worldId: string | null }) {
  const open = useAppStore((s) => s.historyOpen)
  const setOpen = useAppStore((s) => s.setHistoryOpen)
  // Only subscribe while open — the panel is mounted for the whole session, and
  // an idle live query would re-read the journal on every write.
  const { stack, undo, canUndo } = useUndo(open ? worldId : null)
  // Sampled once per open rather than read during render, so the relative times
  // don't shift on unrelated re-renders.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (open) setNow(Date.now())
  }, [open, stack.length])

  // Escape closes this the way it closes the Writer's Brief and the Continuity
  // Checker, which open from the same toolbar cluster. Without it the key that
  // works on every neighbouring panel silently did nothing here.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, setOpen])

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-[2400] bg-black/40 lg:bg-transparent"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        className="fixed inset-y-0 right-0 z-[2500] flex w-full max-w-sm flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Recent changes"
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[hsl(var(--border))] px-3">
          <History className="h-4 w-4 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
          <h2 className="flex-1 text-sm font-semibold text-[hsl(var(--foreground))]">Recent changes</h2>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close recent changes"
            className="pw-tap rounded-md p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {stack.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No changes to undo yet. Importing a world or generating with AI starts a
              fresh history, so this list will be empty straight afterwards.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {stack.map((op, i) => (
                <li
                  key={op.id}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-2',
                    i === 0 ? 'bg-[hsl(var(--accent))]' : 'opacity-70',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[hsl(var(--foreground))]">
                      {describeOperation(op)}
                    </p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      {relativeTime(op.createdAt, now)}
                    </p>
                  </div>
                  {i === 0 && (
                    <button
                      onClick={() => { void undo() }}
                      disabled={!canUndo}
                      className="pw-tap flex shrink-0 items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-2 py-1 text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--background))] transition-colors"
                    >
                      <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Undo
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
