import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, CornerDownRight, MapPin, MessageSquarePlus, Pencil, RotateCcw, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { MakeTaskButton } from '@/features/revisions'
import { addProseNote, deleteProseNote, replyToProseNote, setProseNoteResolved, updateProseNote } from '@/db/hooks/useProseNotes'
import { journalGroup } from '@/db/hooks/useOperations'
import { anchorFrom, type NoteAnchor, type NotePlace } from '@/lib/noteAnchor'
import { DEFAULT_NOTE_FILTER, NOTE_AUTHOR_LABEL, NOTE_KIND_LABEL, authorLabel, noteRows, readerFilter, type NoteFilter, type NoteRow } from '@/lib/noteList'
import { REACTION_LABEL } from '@/lib/readerNotes'
import type { NoteAuthorKind, NoteKind, ProseNote } from '@/types'

/*
  The Notes panel, beside the Page (editorial-plan.md, R1): every note on the
  book's prose, in reading order, filtered by status, chapter and who wrote
  it. A note is gone to, answered, edited, resolved or reopened here, and a
  new one is written here after choosing its words on the page.

  A note whose words have been edited since is moved onto them when the
  writer acts on it — in the same undo step as the act — and one whose words
  have been rewritten is kept, unplaced, with the quote it was made on.
*/

const KINDS: NoteKind[] = ['note', 'query', 'cut', 'check', 'praise']

const IS_MAC = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
/** The Page's key for a note on the chosen words: Google Docs' key for a comment, which writers already know. */
export const ADD_NOTE_KEYS = IS_MAC ? '⌘⌥M' : 'Ctrl+Alt+M'

export interface NotesPanelProps {
  worldId: string
  notes: readonly ProseNote[]
  places: ReadonlyMap<string, NotePlace | null>
  chapters: ReadonlyArray<{ id: string; number: number; title: string }>
  chapterOf: (sceneId: string) => string | null
  sceneTitle: (sceneId: string) => string
  order: (sceneId: string) => number
  /** A scene's prose now, to move a note onto its edited words. */
  proseOf: (sceneId: string) => string | null
  /** The note to show, from a mark clicked on the page. */
  focusedId: string | null
  /** Words chosen on the page for a new note. */
  draft: { anchor: NoteAnchor; sceneTitle: string } | null
  onDraftDone: (note: ProseNote | null) => void
  /** Whether a note's place can be gone to from here: it is on this page. */
  canGoTo: (row: NoteRow) => boolean
  onGoTo: (row: NoteRow) => void
  onClose: () => void
  /**
   * Where the page has no Add note button of its own (a phone), the panel
   * offers it: words are chosen, and no note is being written on them yet.
   */
  onAddNote?: () => void
}

export function NotesPanel(p: NotesPanelProps) {
  const [filter, setFilter] = useState<NoteFilter>(DEFAULT_NOTE_FILTER)
  const rows = useMemo(() => noteRows(p.notes, p.places, p.chapterOf, p.order, filter), [p.notes, p.places, p.chapterOf, p.order, filter])
  const authors = useMemo(() => [...new Set(p.notes.map((n) => n.author.kind))], [p.notes])
  // Each beta reader by name, as well as readers together (R7).
  const readers = useMemo(() => [...new Set(p.notes.filter((n) => n.author.kind === 'reader' && n.author.name).map((n) => n.author.name!))].sort(), [p.notes])
  const listRef = useRef<HTMLOListElement>(null)

  // A note opened from its mark is shown, whatever the filter was hiding.
  useEffect(() => {
    if (!p.focusedId) return
    const n = p.notes.find((x) => x.id === p.focusedId)
    if (n && !rows.some((r) => r.note.id === n.id)) setFilter({ status: n.status, chapterId: 'all', author: 'all' })
    requestAnimationFrame(() => listRef.current?.querySelector(`[data-note="${p.focusedId}"]`)?.scrollIntoView({ block: 'nearest' }))
  }, [p.focusedId]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Act on a note, moving it first onto its words where they have been edited: one undo step. */
  const act = (row: NoteRow, fn: () => Promise<void>) => journalGroup(async () => {
    const { place, note } = row
    if (place && !place.exact) {
      const prose = p.proseOf(place.eventId)
      const anchor = prose !== null ? anchorFrom(place.eventId, prose, place.from, place.to) : null
      if (anchor) await updateProseNote(note.id, { anchor })
    }
    await fn()
  })

  return (
    <aside aria-label="Notes" className="flex min-h-0 w-full flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] text-sm">
      <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-3 py-2">
        <h2 className="flex-1 text-sm font-semibold">Notes</h2>
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Close notes" onClick={p.onClose}>
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {p.onAddNote && (
        <div className="border-b border-[hsl(var(--border))] px-3 py-2">
          <Button size="sm" variant="outline" className="w-full gap-1 pointer-coarse:h-11" onClick={p.onAddNote}>
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" /> Add a note on the chosen words
          </Button>
        </div>
      )}

      {p.draft && <NewNote key={`${p.draft.anchor.eventId}:${p.draft.anchor.quote}`} {...p} draft={p.draft} />}

      <div className="grid grid-cols-3 gap-2 border-b border-[hsl(var(--border))] px-3 py-2 text-xs">
        <Field label="Show">
          <Select value={filter.status} onValueChange={(v) => setFilter({ ...filter, status: v as NoteFilter['status'] })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Chapter">
          <Select value={filter.chapterId} onValueChange={(v) => setFilter({ ...filter, chapterId: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Every chapter</SelectItem>
              {p.chapters.map((c) => <SelectItem key={c.id} value={c.id}>{`Ch. ${c.number}${c.title ? ` · ${c.title}` : ''}`}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="From">
          <Select value={filter.author} onValueChange={(v) => setFilter({ ...filter, author: v as NoteFilter['author'] })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anyone</SelectItem>
              {(Object.keys(NOTE_AUTHOR_LABEL) as NoteAuthorKind[]).filter((k) => authors.includes(k) || k === filter.author).map((k) => (
                <SelectItem key={k} value={k}>{k === 'reader' && readers.length > 0 ? 'Every reader' : NOTE_AUTHOR_LABEL[k]}</SelectItem>
              ))}
              {readers.map((r) => <SelectItem key={r} value={readerFilter(r)}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {rows.length === 0 ? (
        <p className="px-3 py-4 text-xs text-[hsl(var(--muted-foreground))]">
          {p.notes.length === 0
            ? `No notes yet. Choose some words on the page and press Add note — or ${ADD_NOTE_KEYS}.`
            : 'No notes match. Show all of them, or another chapter.'}
        </p>
      ) : (
        <ol ref={listRef} aria-label="Notes on the prose" className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {rows.map((row) => (
            <NoteCard key={row.note.id} row={row} focused={row.note.id === p.focusedId} {...p} act={act} />
          ))}
        </ol>
      )}
    </aside>
  )
}

function NewNote({ worldId, draft, onDraftDone }: NotesPanelProps & { draft: NonNullable<NotesPanelProps['draft']> }) {
  const [kind, setKind] = useState<NoteKind>('note')
  const [body, setBody] = useState('')
  const save = async () => onDraftDone(await addProseNote({ worldId, anchor: draft.anchor, body, kind }))
  return (
    <form
      aria-label="New note"
      className="space-y-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] px-3 py-2"
      onSubmit={(e) => { e.preventDefault(); void save() }}
    >
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        On <q className="italic text-[hsl(var(--foreground))]">{clip(draft.anchor.quote, 120)}</q>, in “{draft.sceneTitle || 'Untitled scene'}”
      </p>
      <Field label="Kind" className="text-xs">
        <Select value={kind} onValueChange={(v) => setKind(v as NoteKind)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{NOTE_KIND_LABEL[k]}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Note" className="text-xs">
        <Textarea
          autoFocus
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void save() }
            if (e.key === 'Escape') { e.preventDefault(); onDraftDone(null) }
          }}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => onDraftDone(null)}>Cancel</Button>
        <Button type="submit" size="sm">Save note</Button>
      </div>
    </form>
  )
}

function NoteCard({ row, focused, sceneTitle, chapters, canGoTo, onGoTo, act }: NotesPanelProps & {
  row: NoteRow
  focused: boolean
  act: (row: NoteRow, fn: () => Promise<void>) => Promise<void>
}) {
  const { note, place } = row
  const [replying, setReplying] = useState(false)
  const [reply, setReply] = useState('')
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(note.body)
  const chapter = chapters.find((c) => c.id === row.chapterId)
  // On the title page or a chapter's heading, it says so, and not a scene (round-trip-plan-3.md, T9.4).
  const where = note.outside === 'title page'
    ? 'The title page'
    : note.outside === 'heading'
      ? (chapter ? `Ch. ${chapter.number} · its heading` : 'A chapter’s heading')
      : row.sceneId
        ? `${chapter ? `Ch. ${chapter.number} · ` : ''}${sceneTitle(row.sceneId) || 'Untitled scene'}`
        : 'Its scene has been deleted'
  const resolved = note.status === 'resolved'

  return (
    <li
      data-note={note.id}
      aria-label={`${note.reaction ? REACTION_LABEL[note.reaction] : NOTE_KIND_LABEL[note.kind]}: ${clip(note.quote, 60)}`}
      className={cn(
        'space-y-1.5 rounded-md border border-[hsl(var(--border))] p-2',
        focused && 'ring-2 ring-[hsl(var(--ring))]',
        resolved && 'opacity-70',
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
        <span className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 font-medium text-[hsl(var(--foreground))]">{note.reaction ? REACTION_LABEL[note.reaction] : NOTE_KIND_LABEL[note.kind]}</span>
        <span>{authorLabel(note.author)}</span>
        {resolved && <span>· Resolved</span>}
        <span className="ml-auto truncate" title={where}>{where}</span>
      </div>
      <blockquote className="border-l-2 border-yellow-500/70 pl-2 text-xs italic">{clip(note.quote, 200)}</blockquote>
      {/* What it was made on, where it has moved since: the question stays a question about those words (round-trip-plan.md, T6). */}
      {note.madeOn !== undefined && note.madeOn !== note.quote && (
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Made on: <q className="italic">{clip(note.madeOn, 160)}</q></p>
      )}
      {note.outside && (
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
          {note.outside === 'heading' ? 'On the chapter’s heading, as the file had it.' : 'On the title page, as the file had it.'} It is not on the Page: answer it here.
        </p>
      )}
      {!place && !note.outside && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          Unplaced: these words are no longer in the book. The note is kept with the words it was made on.
        </p>
      )}
      {place && !place.exact && <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Its words have been edited since.</p>}

      {editing ? (
        <form className="space-y-1" onSubmit={(e) => { e.preventDefault(); void act(row, () => updateProseNote(note.id, { body })).then(() => setEditing(false)) }}>
          <Textarea aria-label="Note" rows={3} value={body} onChange={(e) => setBody(e.target.value)} autoFocus />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => { setBody(note.body); setEditing(false) }}>Cancel</Button>
            <Button type="submit" size="sm">Save</Button>
          </div>
        </form>
      ) : (
        note.body && <p className="whitespace-pre-wrap">{note.body}</p>
      )}

      {note.replies.length > 0 && (
        <ul aria-label="Replies" className="space-y-1 border-l border-[hsl(var(--border))] pl-2">
          {note.replies.map((r) => (
            <li key={r.id} className="text-xs">
              <span className="text-[hsl(var(--muted-foreground))]">{authorLabel(r.author)}:</span> <span className="whitespace-pre-wrap">{r.body}</span>
            </li>
          ))}
        </ul>
      )}

      {replying && (
        <form className="space-y-1" onSubmit={(e) => { e.preventDefault(); void act(row, () => replyToProseNote(note.id, reply)).then(() => { setReply(''); setReplying(false) }) }}>
          <Textarea aria-label="Reply" rows={2} value={reply} onChange={(e) => setReply(e.target.value)} autoFocus />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setReplying(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={!reply.trim()}>Reply</Button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-1">
        {place && canGoTo(row) && (
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => onGoTo(row)}>
            <MapPin className="h-3 w-3" aria-hidden="true" /> Go to it
          </Button>
        )}
        {!replying && (
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => setReplying(true)}>
            <CornerDownRight className="h-3 w-3" aria-hidden="true" /> Reply
          </Button>
        )}
        {!editing && (
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => { setBody(note.body); setEditing(true) }}>
            <Pencil className="h-3 w-3" aria-hidden="true" /> Edit
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => void act(row, () => setProseNoteResolved(note.id, !resolved))}>
          {resolved
            ? <><RotateCcw className="h-3 w-3" aria-hidden="true" /> Reopen</>
            : <><Check className="h-3 w-3" aria-hidden="true" /> Resolve</>}
        </Button>
        <MakeTaskButton
          worldId={note.worldId}
          made={(t) => t.source?.kind === 'note' && t.source.noteId === note.id}
          task={async () => ({
            text: note.body.trim() || `Revise “${clip(note.quote, 80)}”`,
            // One on a chapter's heading is about the chapter, not the scene under it.
            links: [...(row.chapterId ? [{ kind: 'chapter' as const, id: row.chapterId }] : []), ...(row.sceneId && !note.outside ? [{ kind: 'scene' as const, id: row.sceneId }] : [])],
            source: { kind: 'note', noteId: note.id, quote: clip(note.quote, 80) },
          })}
        />
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-red-600 dark:text-red-400" onClick={() => void deleteProseNote(note.id)}>
          <Trash2 className="h-3 w-3" aria-hidden="true" /> Delete
        </Button>
      </div>
    </li>
  )
}

function clip(s: string, n: number): string {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > n ? `${one.slice(0, n - 1)}…` : one
}
