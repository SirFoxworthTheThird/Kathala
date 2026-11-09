import { useMemo, useState } from 'react'
import { Merge, Heading } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import { plural } from '@/lib/plural'
import { lettersTasks, makeHeading, mergeWithPrevious, splitLetter, suggestLinks, type LetterItem } from '@/lib/editorialLetter'
import { addRevisionTasks, type NewTask } from '@/db/hooks/useRevisionTasks'
import { useCharacters } from '@/db/hooks/useCharacters'
import type { TaskBook } from './TaskList'

/*
  An editorial letter, pasted in and split into tasks (editorial-plan.md, R5):
  each point offered, with the chapters and characters it names as its links.
  The writer keeps, merges or drops each, and says a heading is a point where
  it is one, before any task is made.
*/

export function LetterDialog({ worldId, book, open, onOpenChange }: {
  worldId: string
  book: TaskBook
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [letter, setLetter] = useState('')
  const [from, setFrom] = useState('')
  const [items, setItems] = useState<LetterItem[] | null>(null)
  const characters = useCharacters(worldId)

  const close = () => { setLetter(''); setFrom(''); setItems(null); onOpenChange(false) }
  const linksOf = useMemo(() => {
    const chapters = book.chapters
    return (text: string) => suggestLinks(text, { chapters, characters })
  }, [book.chapters, characters])

  // The tasks the list makes now: each point kept, under the heading before it, with its links.
  const tasks = useMemo<NewTask[]>(() => {
    if (!items) return []
    const letter = from.trim() || 'an editorial letter'
    return lettersTasks(items).map((t) => ({ ...t, links: linksOf(t.text), source: { kind: 'letter', letter } }))
  }, [items, from, linksOf])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tasks from an editorial letter</DialogTitle>
        </DialogHeader>
        {items === null ? (
          <form className="space-y-3 text-sm" onSubmit={(e) => { e.preventDefault(); setItems(splitLetter(letter)) }}>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Paste the letter as it came. It is split at each bullet and numbered point and between paragraphs, and
              you keep, merge or drop each point before any task is made.
            </p>
            <Field label="The letter">
              <Textarea rows={12} value={letter} onChange={(e) => setLetter(e.target.value)} autoFocus />
            </Field>
            <Field label="Whose letter (optional)">
              <Input value={from} placeholder="Ines, 3 November" onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={!letter.trim()}>Split into tasks</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 text-sm">
            <p role="status" className="text-xs text-[hsl(var(--muted-foreground))]">
              {plural(tasks.length, 'task')} to add, of {plural(items.filter((i) => !i.heading).length, 'point')}. Untick what is not work.
            </p>
            <ol aria-label="Points of the letter" className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
              {items.map((it, i) => it.heading ? (
                <li key={i} aria-label={`Heading: ${it.text}`} className="flex items-center gap-2 pt-1">
                  <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{it.text}</span>
                  <Button size="sm" variant="ghost" className="h-6 gap-1 px-1.5 text-[11px]" onClick={() => setItems(items.map((x, k) => (k === i ? { ...x, heading: false } : x)))}>
                    <Heading className="h-3 w-3" aria-hidden="true" /> Not a heading
                  </Button>
                </li>
              ) : (
                <li key={i} aria-label={`Point: ${it.text}`} className={cn('flex items-start gap-2 rounded-md border border-[hsl(var(--border))] p-2', !it.keep && 'opacity-60')}>
                  <input
                    type="checkbox"
                    className="mt-1 accent-[hsl(var(--ring))]"
                    checked={it.keep}
                    aria-label={`Keep: ${firstWords(it.text)}`}
                    onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, keep: e.target.checked } : x)))}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p>{it.text}</p>
                    {it.keep && (() => {
                      const names = linksOf(it.text).map((l) => book.label(l)).filter(Boolean)
                      return names.length > 0 && <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Linked to {names.join(', ')}</p>
                    })()}
                  </div>
                  {i > 0 && !items[i - 1].heading && (
                    <Button size="sm" variant="ghost" className="h-6 shrink-0 gap-1 px-1.5 text-[11px]" title="One point with the one above" onClick={() => setItems(mergeWithPrevious(items, i))}>
                      <Merge className="h-3 w-3" aria-hidden="true" /> Merge up
                    </Button>
                  )}
                  {/* A heading the guess missed: it then stands over the points after it (round-trip-plan.md, T3). */}
                  {it.text.length <= 80 && (
                    <Button size="sm" variant="ghost" className="h-6 shrink-0 gap-1 px-1.5 text-[11px]" title="A heading over the points after it" onClick={() => setItems(makeHeading(items, i))}>
                      <Heading className="h-3 w-3" aria-hidden="true" /> Make a heading
                    </Button>
                  )}
                </li>
              ))}
            </ol>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setItems(null)}>Back to the letter</Button>
              <Button disabled={tasks.length === 0} onClick={() => { void addRevisionTasks(worldId, tasks).then(close) }}>
                Add {plural(tasks.length, 'task')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** A point's first words, to name its checkbox by: the whole of a long point is too much to hear. */
function firstWords(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return words.length === 0 ? 'this point' : words.length > 10 ? `${words.slice(0, 10).join(' ')}…` : words.join(' ')
}
