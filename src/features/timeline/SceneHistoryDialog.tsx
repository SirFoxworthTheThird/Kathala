import { useMemo, useState } from 'react'
import { History, RotateCcw, Trash2, FileText, GitCompare } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useSceneRevisions, restoreSceneRevision, deleteSceneRevision } from '@/db/hooks/useSceneRevisions'
import { diffWords, diffStats, splitEdges } from '@/lib/textDiff'
import { relativeTime } from '@/lib/relativeTime'
import { plural } from '@/lib/plural'

interface SceneHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  /** The scene's current prose, to diff a past version against. */
  currentText: string
}

/** Wrapped so the clock read stays out of render bodies (react-hooks/purity). */
function nowMs(): number {
  return Date.now()
}


export function SceneHistoryDialog({ open, onOpenChange, eventId, currentText }: SceneHistoryDialogProps) {
  const revisions = useSceneRevisions(open ? eventId : null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'text' | 'diff'>('diff')
  const [confirmRestore, setConfirmRestore] = useState(false)

  const now = nowMs()
  const selected = revisions.find((r) => r.id === selectedId) ?? revisions[0] ?? null
  const diff = useMemo(
    () => (selected ? diffWords(selected.text, currentText) : []),
    [selected, currentText]
  )
  const stats = useMemo(() => diffStats(diff), [diff])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-[hsl(var(--accent-foreground))]" />
            <h2 className="text-sm font-semibold">Scene history</h2>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {revisions.length} saved {revisions.length === 1 ? 'version' : 'versions'}
            </span>
          </div>

          {revisions.length === 0 ? (
            <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No earlier versions yet. Past drafts are saved automatically as you revise this scene.
            </p>
          ) : (
            <div className="flex gap-4" style={{ height: '60vh' }}>
              {/* Version list */}
              <div className="w-44 shrink-0 space-y-1 overflow-y-auto pr-1">
                {revisions.map((r) => {
                  const isSel = selected?.id === r.id
                  return (
                    <div
                      key={r.id}
                      className={`group flex items-center gap-1 rounded-md border px-2 py-1.5 text-left transition-colors ${
                        isSel
                          ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))]'
                          : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--accent)/0.4)]'
                      }`}
                    >
                      <button className="min-w-0 flex-1 text-left" onClick={() => setSelectedId(r.id)}>
                        <p className="text-xs font-medium text-[hsl(var(--foreground))]">{relativeTime(r.createdAt, now)}</p>
                        <p className="text-[10px] tabular-nums text-[hsl(var(--muted-foreground))]">{plural(r.wordCount, 'word')}</p>
                      </button>
                      <button
                        onClick={() => deleteSceneRevision(r.id)}
                        aria-label="Delete this version"
                        title="Delete this version"
                        className="shrink-0 text-[hsl(var(--muted-foreground))] opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Preview */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex rounded-md border border-[hsl(var(--border))] p-0.5">
                    <button
                      onClick={() => setMode('diff')}
                      className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] ${mode === 'diff' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}
                    >
                      <GitCompare className="h-3 w-3" /> Diff vs current
                    </button>
                    <button
                      onClick={() => setMode('text')}
                      className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] ${mode === 'text' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}
                    >
                      <FileText className="h-3 w-3" /> This version
                    </button>
                  </div>
                  {mode === 'diff' && (
                    <span className="text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">
                      <span className="text-emerald-400">+{stats.added}</span>{' '}
                      <span className="text-red-400">−{stats.removed}</span> words to reach current
                    </span>
                  )}
                  <Button size="sm" className="ml-auto gap-1.5" onClick={() => setConfirmRestore(true)} disabled={!selected}>
                    <RotateCcw className="h-3.5 w-3.5" /> Restore
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {mode === 'text'
                    ? selected?.text
                    : diff.map((tok, i) => {
                        if (tok.op === 'equal') return <span key={i}>{tok.text}</span>
                        // A deletion is very often followed immediately by the
                        // insertion replacing it, with no whitespace between —
                        // "years, and it showed." then "years." ran together as
                        // one unreadable string. The padding and margin give the
                        // two blocks their own edges; splitEdges keeps the
                        // highlight off the surrounding spaces so they stay
                        // tight around the words that changed.
                        const { lead, core, trail } = splitEdges(tok.text)
                        const tone = tok.op === 'add'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-red-500/20 text-red-300 line-through'
                        return (
                          <span key={i}>
                            {lead}
                            {core && <span className={`mx-0.5 rounded px-1 ${tone}`}>{core}</span>}
                            {trail}
                          </span>
                        )
                      })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmRestore}
        onOpenChange={setConfirmRestore}
        title="Restore this version?"
        description="The current prose will be saved as a new version first, so you can undo this."
        confirmLabel="Restore"
        destructive={false}
        onConfirm={async () => {
          if (selected) await restoreSceneRevision(selected.id)
          setConfirmRestore(false)
          onOpenChange(false)
        }}
      />
    </>
  )
}
