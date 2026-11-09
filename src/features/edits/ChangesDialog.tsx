import { useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ProseDiff } from '@/components/ProseDiff'
import { cn } from '@/lib/utils'
import type { DiffToken } from '@/lib/textDiff'
import { shownChange } from '@/lib/docxEdits'
import { plural } from '@/lib/plural'
import { acceptScene, acceptSuggestion, placePassage, rejectScene, rejectSuggestion, useEditSuggestions } from '@/db/hooks/useEditImport'
import { useAllWorldEvents, useWorldChapters } from '@/db/hooks/useTimeline'
import type { EditSuggestion } from '@/types'

/*
  An editor's changes, decided (editorial-plan.md, R4): each one shown as its
  words before and after, with a little of the text around them, and accepted
  or rejected — one at a time, or a scene at a time. A change whose words the
  writer has since rewritten cannot be accepted, and says so; it is theirs to
  make by hand, or reject. Passages of the file no scene matched are placed
  here first.
*/

export function ChangesDialog({ worldId, open, onOpenChange, focusedId }: {
  worldId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A change clicked on the page. */
  focusedId?: string | null
}) {
  const suggestions = useEditSuggestions(open ? worldId : null)
  const events = useAllWorldEvents(worldId)
  const chapters = useWorldChapters(worldId)
  // The book's scenes in its order, every timeline: for their titles, and to place a passage in one.
  const scenes = useMemo(() => {
    const number = new Map(chapters.map((c) => [c.id, c.number]))
    return events
      .map((e) => ({ id: e.id, title: e.title, chapter: number.get(e.chapterId) ?? 0, sortOrder: e.sortOrder }))
      .sort((a, b) => a.chapter - b.chapter || a.sortOrder - b.sortOrder)
  }, [events, chapters])
  const [stale, setStale] = useState<ReadonlySet<string>>(new Set())
  const order = useMemo(() => new Map(scenes.map((s, i) => [s.id, i])), [scenes])
  const byScene = useMemo(() => {
    const groups = new Map<string, EditSuggestion[]>()
    for (const s of suggestions) if (s.eventId) groups.set(s.eventId, [...(groups.get(s.eventId) ?? []), s])
    return [...groups].sort(([a], [b]) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9))
  }, [suggestions, order])
  const passages = useMemo(() => {
    const groups = new Map<string, { text: string; rows: EditSuggestion[] }>()
    for (const s of suggestions) if (!s.eventId && s.passage) {
      const g = groups.get(s.passage.id) ?? { text: s.passage.text, rows: [] }
      g.rows.push(s)
      groups.set(s.passage.id, g)
    }
    return [...groups]
  }, [suggestions])

  const accept = async (s: EditSuggestion) => {
    if (!(await acceptSuggestion(s.id))) setStale((prev) => new Set([...prev, s.id]))
  }
  const sceneOf = (id: string) => scenes.find((s) => s.id === id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Changes from the editor</DialogTitle>
        </DialogHeader>
        {suggestions.length === 0 ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">No changes waiting. Bring in an editor&rsquo;s Word file to see theirs here.</p>
        ) : (
          <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1 text-sm">
            <p role="status" className="text-xs text-[hsl(var(--muted-foreground))]">
              {plural(suggestions.length, 'change')} waiting. Accepting one writes it into the scene; what the scene said is kept in its History.
            </p>

            {passages.map(([id, p]) => (
              <section key={id} aria-label="A passage no scene matched" className="space-y-2 rounded-md border border-amber-500/50 p-3">
                <p className="text-xs">No scene in the book matched this passage of the file. Say which scene it is to review its changes there.</p>
                <blockquote className="max-h-24 overflow-y-auto whitespace-pre-wrap border-l-2 border-amber-500/60 pl-2 text-xs italic">{p.text}</blockquote>
                <Field label="Its scene" className="gap-1">
                  <Select value="" onValueChange={(eventId) => { void placePassage(worldId, id, eventId) }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choose a scene…" /></SelectTrigger>
                    <SelectContent>{scenes.map((s) => <SelectItem key={s.id} value={s.id}>{`Ch. ${s.chapter} · ${s.title || 'Untitled scene'}`}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Button size="sm" variant="ghost" onClick={() => { for (const r of p.rows) void rejectSuggestion(r.id) }}>Drop this passage&rsquo;s changes</Button>
              </section>
            ))}

            {byScene.map(([eventId, rows]) => {
              const scene = sceneOf(eventId)
              return (
                <section key={eventId} aria-label={`Changes to ${scene?.title || 'Untitled scene'}`} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="flex-1 text-xs font-semibold">{scene ? `Ch. ${scene.chapter} · ${scene.title || 'Untitled scene'}` : 'A scene no longer in the book'}</h3>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { void acceptScene(worldId, eventId).then((r) => { if (r.kept) setStale((prev) => new Set([...prev, ...rows.map((x) => x.id)])) }) }}>Accept all {rows.length}</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { void rejectScene(worldId, eventId) }}>Reject all</Button>
                  </div>
                  <ol className="space-y-1.5">
                    {rows.map((s) => <Change key={s.id} s={s} stale={stale.has(s.id)} focused={s.id === focusedId} onAccept={() => accept(s)} onReject={() => rejectSuggestion(s.id)} />)}
                  </ol>
                </section>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Change({ s, stale, focused, onAccept, onReject }: { s: EditSuggestion; stale: boolean; focused: boolean; onAccept: () => void; onReject: () => void }) {
  // One stretch out and one in, the words both sides share shown as the text around them.
  const shown = useMemo(() => shownChange(s.before, s.after), [s.before, s.after])
  const tokens: DiffToken[] = [{ op: 'remove', text: shown.out }, { op: 'add', text: shown.in }]
  // A little of the text either side, cut at a word.
  const before = (s.prefix + shown.lead).replace(/^.*\n/s, '')
  const after = (shown.tail + s.suffix).replace(/\n.*$/s, '')
  const lead = before.length >= 32 ? before.slice(-32).replace(/^\S*\s/, '') : before
  const tail = after.length >= 32 ? after.slice(0, 32).replace(/\s\S*$/, '') : after
  return (
    <li
      aria-label={`${s.kind === 'tracked' ? 'Tracked change' : 'Untracked edit'}: ${s.before.trim() || '…'} → ${s.after.trim() || '(removed)'}`}
      aria-current={focused || undefined}
      className={cn('flex items-start gap-2 rounded-md border border-[hsl(var(--border))] p-2', focused && 'ring-2 ring-[hsl(var(--ring))]')}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="whitespace-pre-wrap leading-relaxed">
          <span className="text-[hsl(var(--muted-foreground))]">{before.length >= 32 ? `…${lead}` : lead}</span>
          <ProseDiff tokens={tokens} />
          <span className="text-[hsl(var(--muted-foreground))]">{after.length >= 32 ? `${tail}…` : tail}</span>
        </p>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {s.kind === 'tracked' ? `Tracked change${s.author ? ` by ${s.author}` : ''}` : 'Made with tracking off: found by comparing the file with the book as it went out'}
        </p>
        {stale && <p role="alert" className="text-[11px] text-amber-600 dark:text-amber-400">The scene no longer has these words: you have changed them since. Make this change by hand, or reject it.</p>}
      </div>
      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onAccept} aria-label="Accept">
        <Check className="h-3 w-3" aria-hidden="true" /> Accept
      </Button>
      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={onReject} aria-label="Reject">
        <X className="h-3 w-3" aria-hidden="true" /> Reject
      </Button>
    </li>
  )
}
