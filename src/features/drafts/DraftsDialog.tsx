import { useEffect, useMemo, useState } from 'react'
import { GitCompare, RotateCcw, Save, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ProseDiff } from '@/components/ProseDiff'
import { cn } from '@/lib/utils'
import { plural } from '@/lib/plural'
import { diffStats, diffWords } from '@/lib/textDiff'
import { compareDrafts, type DraftBook, type DraftComparison, type SceneChange } from '@/lib/bookDraft'
import { currentBook, deleteBookDraft, openBookDraft, restoreSceneFromDraft, saveBookDraft, useBookDrafts } from '@/db/hooks/useBookDrafts'

/*
  Named drafts of the book (editorial-plan.md, R3). A draft is saved under a
  name — "Draft 2, sent to Ana" — and compared with the book as it is now, or
  with another draft: the scenes that changed, each opened in the same diff as
  a scene's History, and a scene's prose put back as the draft had it.
*/

const NOW = 'now'

export function DraftsDialog({ worldId, open, onOpenChange }: { worldId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const drafts = useBookDrafts(open ? worldId : null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [fromId, setFromId] = useState<string | null>(null)
  const [toId, setToId] = useState<string>(NOW)
  const [deleting, setDeleting] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    try { await saveBookDraft(worldId, name) } finally { setSaving(false) }
    setName('')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setFromId(null) }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Drafts of the book</DialogTitle>
        </DialogHeader>

        {fromId ? (
          <Comparison worldId={worldId} drafts={drafts} fromId={fromId} toId={toId} onFrom={setFromId} onTo={setToId} onBack={() => setFromId(null)} />
        ) : (
          <div className="space-y-4 text-sm">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              A draft keeps the whole book — every scene&rsquo;s prose, the scenes and the chapters — as it is now, so you can see what has changed since. Kept on this device.
            </p>
            <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void save() }}>
              <Field label="Name this draft" className="flex-1 gap-1">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Draft 2, sent to Ana" className="h-9" />
              </Field>
              <Button type="submit" className="gap-1.5" disabled={saving}>
                <Save className="h-4 w-4" aria-hidden="true" /> {saving ? 'Saving…' : 'Save a draft'}
              </Button>
            </form>

            {drafts.length === 0 ? (
              <p className="py-6 text-center text-xs text-[hsl(var(--muted-foreground))]">No drafts yet. Save one before you send the book to someone, and you can see what changed when it comes back.</p>
            ) : (
              <ul aria-label="Drafts" className="space-y-1.5">
                {drafts.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{d.name}</p>
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                        {new Date(d.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · {plural(d.words, 'word')} · {plural(d.scenes, 'scene')}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => { setFromId(d.id); setToId(NOW) }}>
                      <GitCompare className="h-3.5 w-3.5" aria-hidden="true" /> Compare with now
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Delete “${d.name}”`} onClick={() => setDeleting(d.id)}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => { if (!o) setDeleting(null) }}
        title="Delete this draft?"
        description="The draft is removed from this device. The book itself is not changed."
        confirmLabel="Delete"
        onConfirm={async () => { if (deleting) await deleteBookDraft(deleting); setDeleting(null) }}
      />
    </Dialog>
  )
}

function Comparison({ worldId, drafts, fromId, toId, onFrom, onTo, onBack }: {
  worldId: string
  drafts: ReturnType<typeof useBookDrafts>
  fromId: string
  toId: string
  onFrom: (id: string) => void
  onTo: (id: string) => void
  onBack: () => void
}) {
  const [books, setBooks] = useState<{ before: DraftBook; after: DraftBook } | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<SceneChange | null>(null)
  /** Read the book again: after a scene is restored, "now" has changed. */
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let live = true
    const from = drafts.find((d) => d.id === fromId)
    const to = drafts.find((d) => d.id === toId)
    if (!from || (toId !== NOW && !to)) return
    void (async () => {
      try {
        const [before, after] = await Promise.all([openBookDraft(from), to ? openBookDraft(to) : currentBook(worldId)])
        if (live) { setBooks({ before, after }); setError('') }
      } catch {
        if (live) setError('This draft could not be read.')
      }
    })()
    return () => { live = false }
  }, [worldId, drafts, fromId, toId, nonce])

  const comparison: DraftComparison | null = useMemo(() => (books ? compareDrafts(books.before, books.after) : null), [books])
  const titleIn = (book: DraftBook | undefined, id: string) => book?.chapters.flatMap((c) => c.scenes).find((s) => s.id === id)?.title
  /** A scene's title as the book has it now, or — gone — as the draft did. */
  const titleOf = (id: string) => titleIn(books?.after, id) ?? titleIn(books?.before, id) ?? 'Untitled scene'
  const change = comparison?.changes.find((c) => c.sceneId === selected) ?? comparison?.changes[0] ?? null
  const diff = useMemo(() => (change ? diffWords(change.textBefore, change.textAfter) : []), [change])
  const fromName = drafts.find((d) => d.id === fromId)?.name ?? 'the draft'
  const delta = comparison ? comparison.wordsAfter - comparison.wordsBefore : 0

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-end gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}>← All drafts</Button>
        <Field label="From" className="min-w-48 flex-1 gap-1">
          <Select value={fromId} onValueChange={onFrom}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{drafts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="To" className="min-w-48 flex-1 gap-1">
          <Select value={toId} onValueChange={onTo}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NOW}>The book now</SelectItem>
              {drafts.filter((d) => d.id !== fromId).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
      {comparison && (
        <p role="status" className="text-xs text-[hsl(var(--muted-foreground))]">
          {comparison.changes.length === 0
            ? 'Nothing has changed.'
            : `${plural(comparison.changes.length, 'scene')} changed · ${comparison.wordsBefore.toLocaleString()} → ${comparison.wordsAfter.toLocaleString()} words (${delta >= 0 ? '+' : '−'}${Math.abs(delta).toLocaleString()})`}
        </p>
      )}

      {comparison && comparison.changes.length > 0 && (
        <div className="flex gap-3" style={{ height: '55vh' }}>
          <ul aria-label="Scenes that changed" className="w-64 shrink-0 space-y-1 overflow-y-auto pr-1">
            {comparison.changes.map((c) => (
              <li key={c.sceneId}>
                <button
                  type="button"
                  aria-current={change?.sceneId === c.sceneId}
                  onClick={() => setSelected(c.sceneId)}
                  className={cn(
                    'w-full rounded-md border px-2 py-1.5 text-left',
                    change?.sceneId === c.sceneId ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--accent)/0.4)]',
                  )}
                >
                  <p className="truncate text-xs font-medium">
                    {c.chapter ?? c.chapterBefore ? `Ch. ${c.chapter ?? c.chapterBefore} · ` : ''}{c.title || 'Untitled scene'}
                  </p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{describe(c, titleOf)}</p>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex min-w-0 flex-1 flex-col">
            {change && (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">
                    {(() => { const s = diffStats(diff); return <><span className="text-emerald-400">+{s.added}</span> <span className="text-red-400">−{s.removed}</span> words</> })()}
                  </span>
                  {toId === NOW && change.state === 'kept' && change.textBefore !== change.textAfter && (
                    <Button size="sm" className="ml-auto gap-1.5" onClick={() => setRestoring(change)}>
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Restore this scene from the draft
                    </Button>
                  )}
                </div>
                <div aria-label="What changed in the scene" className="flex-1 overflow-y-auto whitespace-pre-wrap rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 leading-relaxed">
                  <ProseDiff tokens={diff} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={restoring !== null}
        onOpenChange={(o) => { if (!o) setRestoring(null) }}
        title="Restore this scene from the draft?"
        description={`Its prose goes back to what “${fromName}” had. What it says now is kept in the scene’s History, so you can undo this.`}
        confirmLabel="Restore"
        destructive={false}
        onConfirm={async () => {
          if (restoring) await restoreSceneFromDraft(worldId, restoring.sceneId, restoring.textBefore)
          setRestoring(null)
          setNonce((n) => n + 1)
        }}
      />
    </div>
  )
}

/** What happened to a scene, in words. */
export function describe(c: SceneChange, titleOf: (id: string) => string): string {
  const parts: string[] = []
  if (c.state === 'added') parts.push(c.splitFrom ? `Split from “${titleOf(c.splitFrom)}”` : 'Added')
  if (c.state === 'removed') parts.push(c.joinedInto ? `Joined into “${titleOf(c.joinedInto)}”` : 'Removed')
  if (c.splitInto) parts.push(`Split: the rest is now ${c.splitInto.map((id) => `“${titleOf(id)}”`).join(', ')}`)
  if (c.tookIn) parts.push(`Took in ${c.tookIn.map((id) => `“${titleOf(id)}”`).join(', ')}`)
  if (c.edited) {
    const d = c.wordsAfter - c.wordsBefore
    parts.push(`Edited${d ? `, ${d > 0 ? '+' : '−'}${Math.abs(d)} words` : ''}`)
  }
  if (c.moved) parts.push(c.chapterBefore !== c.chapter ? `Moved from Ch. ${c.chapterBefore}` : 'Moved')
  if (c.renamed) parts.push(`Was “${c.titleBefore || 'Untitled scene'}”`)
  return parts.join(' · ')
}
