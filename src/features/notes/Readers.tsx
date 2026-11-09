import { useMemo, useRef, useState } from 'react'
import { MessageSquareHeart, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { importReaderNotes, type ReaderNotesImport } from '@/db/hooks/useReaderNotes'
import { useProseNotes } from '@/db/hooks/useProseNotes'
import { useAllWorldEvents, useWorldChapters } from '@/db/hooks/useTimeline'
import { useWorld } from '@/db/hooks/useWorlds'
import { REACTIONS, REACTION_LABEL } from '@/lib/readerNotes'
import { readersMap } from '@/lib/readersMap'
import { plural } from '@/lib/plural'

/*
  The writer's side of beta readers' notes (editorial-plan.md, R7): a
  reader's file brought in — its notes on their words, in the Notes panel
  under the reader's name — and the reactions map, chapter by chapter.
*/

/** Bring in a reader's notes file, and say what came. */
export function BringInReaderNotes({ worldId, className }: { worldId: string; className?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<ReaderNotesImport | null>(null)
  const [error, setError] = useState('')
  const bringIn = async (file: File) => {
    setError('')
    try { setResult(await importReaderNotes(worldId, await file.text())) } catch (e) { setResult(null); setError(e instanceof Error ? e.message : 'The file could not be read.') }
    if (input.current) input.current.value = ''
  }
  return (
    <>
      <input ref={input} type="file" accept=".json,application/json" aria-label="A reader’s notes file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void bringIn(f) }} />
      <Button size="sm" variant="outline" className={className} onClick={() => input.current?.click()}>
        <MessageSquareHeart className="h-4 w-4" /> Bring in a reader’s notes…
      </Button>
      <Dialog open={result !== null || error !== ''} onOpenChange={(o) => { if (!o) { setResult(null); setError('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{error ? 'The notes could not be brought in' : 'A reader’s notes brought in'}</DialogTitle></DialogHeader>
          {error ? <p role="alert" className="text-sm">{error}</p> : result && (
            <p role="status" className="text-sm">
              {plural(result.notes, 'note')} from {result.reader}, each on the words it was made on: in the Notes panel on the Page, under their name.
              {result.replaced > 0 && ` They replace the ${plural(result.replaced, 'note')} from ${result.reader}’s earlier file.`}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** The readers, and the reactions map: chapter by chapter, how they reacted and where each stopped. */
export function ReadersButton({ worldId, className }: { worldId: string; className?: string }) {
  const world = useWorld(worldId)
  const notes = useProseNotes(worldId)
  const chapters = useWorldChapters(worldId)
  const events = useAllWorldEvents(worldId)
  const [open, setOpen] = useState(false)
  const [only, setOnly] = useState<string>('all')
  const readers = useMemo(() => world?.betaReaders ?? [], [world?.betaReaders])
  const rows = useMemo(() => readersMap(chapters, events, notes, readers, only === 'all' ? null : only), [chapters, events, notes, readers, only])
  if (readers.length === 0) return null
  const cell = 'px-2 py-1 text-center tabular-nums'
  return (
    <>
      <Button size="sm" variant="outline" className={className} onClick={() => setOpen(true)}>
        <Users className="h-4 w-4" /> Readers · {readers.length}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Beta readers</DialogTitle></DialogHeader>
          <ul aria-label="Readers" className="space-y-0.5 text-sm">
            {readers.map((r) => (
              <li key={r.name}>
                <span className="font-medium">{r.name}</span>
                <span className="text-[hsl(var(--muted-foreground))]">
                  {' '}· {plural(r.notes, 'note')}
                  {r.readTo ? ` · read to Ch. ${r.readTo.chapter ?? '?'}${r.readTo.scene ? `, ${r.readTo.scene}` : ''}` : ''}
                  {' '}· sent {new Date(r.sentAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
          <Field label="Whose reactions" className="max-w-xs">
            <Select value={only} onValueChange={setOnly}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Every reader’s</SelectItem>
                {readers.map((r) => <SelectItem key={r.name} value={r.name}>{r.name}’s</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="max-h-[50vh] overflow-auto">
            <table aria-label="Reactions by chapter" className="w-full text-xs">
              <thead className="sticky top-0 bg-[hsl(var(--card))] text-[11px] text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-2 py-1 text-left font-medium">Chapter</th>
                  {REACTIONS.map((r) => <th key={r} className="px-2 py-1 font-medium">{REACTION_LABEL[r]}</th>)}
                  <th className="px-2 py-1 font-medium">Other notes</th>
                  <th className="px-2 py-1 text-left font-medium">Stopped here</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.chapterId} aria-label={`Ch. ${row.number}`} className="border-t border-[hsl(var(--border))]">
                    <td className="px-2 py-1">Ch. {row.number}{row.title ? ` · ${row.title}` : ''}</td>
                    {REACTIONS.map((r) => {
                      const n = row.reactions[r] ?? 0
                      return <td key={r} className={cell}>{n > 0 ? <span className={r === 'loved' ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'font-semibold text-amber-600 dark:text-amber-400'}>{n}</span> : <span className="text-[hsl(var(--muted-foreground))]">·</span>}</td>
                    })}
                    <td className={cell}>{row.plain || <span className="text-[hsl(var(--muted-foreground))]">·</span>}</td>
                    <td className="px-2 py-1">{row.stopped.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
