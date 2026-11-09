import { useEffect, useMemo, useState, type RefObject } from 'react'
import { MessageSquareHeart, Send, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useProseNotes, deleteProseNote } from '@/db/hooks/useProseNotes'
import { addReaction, isOwnReaderNote, readerNotesFor } from '@/db/hooks/useReaderNotes'
import { useActiveEventId } from '@/store'
import { anchorFrom, type NoteAnchor } from '@/lib/noteAnchor'
import { plainScene } from '@/lib/proseChecks/text'
import { REACTIONS, REACTION_LABEL, readerNotesFileName } from '@/lib/readerNotes'
import { downloadBlob } from '@/lib/download'
import { plural } from '@/lib/plural'
import type { ManuscriptBookData } from './useManuscriptBook'

/*
  A beta reader's notes on the book (editorial-plan.md, R7), left as they read
  it in reading mode. With **Notes for the author** on, choosing words — or
  tapping a paragraph, where choosing words is awkward — offers the reactions
  (*lost*, *slow*, *loved it*, *didn't believe it*, *where am I?*) and a line
  to say why. **Your notes** lists them, and sends them to the author as a
  file of the notes alone.
*/

const NAME_KEY = 'kathala-reader-name'
const readName = () => { try { return localStorage.getItem(NAME_KEY) ?? '' } catch { return '' } }
const keepName = (name: string) => { try { localStorage.setItem(NAME_KEY, name) } catch { /* the name is asked again next time */ } }

/** The words chosen in the book, or the paragraph tapped: what a reaction will be on. */
export interface Chosen { anchor: NoteAnchor }

/**
 * Follow what the reader chooses in the book while reacting: words chosen in
 * one paragraph of a scene, or a paragraph tapped with nothing chosen. Offsets
 * are the scene's text as the page shows it (`plainScene`), which the
 * paragraphs carry as `data-p`.
 */
export function useReactionTarget(scrollRef: RefObject<HTMLDivElement | null>, on: boolean, textOf: (eventId: string) => string): [Chosen | null, () => void] {
  const [chosen, setChosen] = useState<Chosen | null>(null)
  useEffect(() => {
    if (!on) { setChosen(null); return }
    const root = scrollRef.current
    if (!root) return
    const pick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      // A click on the bar itself chooses nothing.
      if (!target || target.closest('[data-reaction-bar]')) return
      const sel = window.getSelection()
      const para = (n: Node | null) => (n instanceof Element ? n : n?.parentElement)?.closest<HTMLElement>('p[data-p]') ?? null
      const scene = (p: HTMLElement) => p.closest<HTMLElement>('[data-scene-event-id]')?.dataset.sceneEventId ?? null
      const offsetIn = (p: HTMLElement, node: Node, offset: number) => {
        const r = document.createRange()
        r.setStart(p, 0)
        r.setEnd(node, offset)
        return r.toString().length
      }
      let p: HTMLElement | null = null
      let from = 0
      let to = 0
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        p = para(range.startContainer)
        if (!p || p !== para(range.endContainer)) return
        from = offsetIn(p, range.startContainer, range.startOffset)
        to = offsetIn(p, range.endContainer, range.endOffset)
      } else {
        p = para(target)
        if (!p) return
        to = (p.textContent ?? '').length
      }
      const eventId = scene(p)
      if (!eventId) return
      const plain = plainScene(textOf(eventId))
      const start = plain.paragraphs[Number(p.dataset.p)]?.start
      if (start === undefined) return
      const anchor = anchorFrom(eventId, plain.text, start + from, start + to)
      if (anchor) setChosen({ anchor })
    }
    root.addEventListener('mouseup', pick)
    return () => root.removeEventListener('mouseup', pick)
  }, [on, scrollRef, textOf])
  return [chosen, () => setChosen(null)]
}

/** The reactions, for the words chosen: one click says how they read, with a line to say why if the reader wants. */
export function ReactionBar({ worldId, chosen, onDone }: { worldId: string; chosen: Chosen; onDone: () => void }) {
  const [why, setWhy] = useState('')
  const quote = chosen.anchor.quote.replace(/\s+/g, ' ')
  return (
    <div data-reaction-bar role="group" aria-label="React to the chosen words" className="sticky bottom-0 z-10 mx-auto max-w-2xl border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 text-sm shadow-lg">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 truncate text-xs italic text-[hsl(var(--muted-foreground))]" title={quote}>“{quote}”</p>
        <Button size="sm" variant="ghost" className="h-6 w-6 shrink-0 p-0" aria-label="Choose nothing" onClick={onDone}><X className="h-3.5 w-3.5" aria-hidden="true" /></Button>
      </div>
      <Input aria-label="Why (if you like)" placeholder="Why, if you like…" value={why} onChange={(e) => setWhy(e.target.value)} className="my-1.5 h-8 text-xs" />
      <div className="flex flex-wrap gap-1.5">
        {REACTIONS.map((r) => (
          <Button key={r} size="sm" variant="outline" className="h-7 text-xs" onClick={() => { void addReaction(worldId, chosen.anchor, r, why.trim()).then(() => { setWhy(''); window.getSelection()?.removeAllRanges(); onDone() }) }}>
            {REACTION_LABEL[r]}
          </Button>
        ))}
      </div>
    </div>
  )
}

/** In the reader's row: reacting on or off, and the reader's notes, to read over and send. */
export function ReaderNotesControls({ worldId, worldName, book, reacting, onReacting }: {
  worldId: string
  worldName: string
  book: ManuscriptBookData
  reacting: boolean
  onReacting: (on: boolean) => void
}) {
  const notes = useProseNotes(worldId)
  const mine = useMemo(() => notes.filter(isOwnReaderNote), [notes])
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" variant="outline" className={reacting ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))]' : ''} aria-pressed={reacting} onClick={() => onReacting(!reacting)}>
        <MessageSquareHeart className="h-4 w-4" aria-hidden="true" /> Notes for the author
      </Button>
      {mine.length > 0 && <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Your notes · {mine.length}</Button>}
      <YourNotes worldId={worldId} worldName={worldName} book={book} open={open} onOpenChange={setOpen} />
    </>
  )
}

function YourNotes({ worldId, worldName, book, open, onOpenChange }: { worldId: string; worldName: string; book: ManuscriptBookData; open: boolean; onOpenChange: (o: boolean) => void }) {
  const notes = useProseNotes(worldId)
  const mine = useMemo(() => notes.filter(isOwnReaderNote).sort((a, b) => a.createdAt - b.createdAt), [notes])
  const place = useActiveEventId()
  const [name, setName] = useState(readName)
  const scene = (id: string) => book.manuscript.chapters.flatMap((c) => c.scenes.map((s) => ({ c, s }))).find((x) => x.s.eventId === id)
  const at = place ? scene(place) : undefined
  const readTo = at ? { eventId: at.s.eventId, chapter: at.c.number, scene: at.s.title } : null

  const send = async () => {
    keepName(name.trim())
    const file = await readerNotesFor(worldId, name.trim(), readTo)
    downloadBlob(new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' }), readerNotesFileName(file))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Your notes for the author</DialogTitle></DialogHeader>
        <ol aria-label="Your notes" className="max-h-[45vh] space-y-1.5 overflow-y-auto text-sm">
          {mine.map((n) => {
            const where = scene(n.eventId)
            return (
              <li key={n.id} aria-label={`${n.reaction ? REACTION_LABEL[n.reaction] : 'Note'}: ${n.quote}`} className="flex items-start gap-2 rounded-md border border-[hsl(var(--border))] p-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                    <span className="font-medium text-[hsl(var(--foreground))]">{n.reaction ? REACTION_LABEL[n.reaction] : 'Note'}</span>
                    {where && ` · Ch. ${where.c.number}`}
                  </p>
                  <p className="truncate text-xs italic">“{n.quote}”</p>
                  {n.body && <p className="text-xs">{n.body}</p>}
                </div>
                <Button size="sm" variant="ghost" className="h-7 w-7 shrink-0 p-0" aria-label={`Delete: ${n.quote}`} onClick={() => void deleteProseNote(n.id)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </li>
            )
          })}
        </ol>
        <form className="space-y-2 border-t border-[hsl(var(--border))] pt-3 text-sm" onSubmit={(e) => { e.preventDefault(); void send() }}>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Send them as a file to the author{worldName ? ` of ${worldName}` : ''}: {plural(mine.length, 'note')}, each with the few words it is on,
            and how far you have read{at ? ` (Ch. ${at.c.number}${at.s.title ? ` · ${at.s.title}` : ''})` : ''}. The book is not in it.
          </p>
          <Field label="Your name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="So the author knows whose notes they are" />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={!name.trim() || mine.length === 0}><Send className="h-4 w-4" aria-hidden="true" /> Send to the author</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
