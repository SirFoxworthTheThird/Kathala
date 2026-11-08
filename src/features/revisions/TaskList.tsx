import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link2, ShieldCheck, StickyNote, Sparkles, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAllWorldEvents, useWorldChapters } from '@/db/hooks/useTimeline'
import { useCharacters } from '@/db/hooks/useCharacters'
import { deleteRevisionTask, setRevisionTaskDone, updateRevisionTask } from '@/db/hooks/useRevisionTasks'
import { useAppStore } from '@/store'
import type { RevisionTask, TaskLink } from '@/types'

/*
  Revision tasks, listed (editorial-plan.md, R5): each done or open, said in
  its words, with what it is linked to — each a way there — and where it came
  from: a letter, a note, or what a check found, with the way back to it.
*/

export interface TaskBook {
  label: (link: TaskLink) => string | null
  go: (link: TaskLink) => void
  chapters: Array<{ id: string; number: number; title: string }>
  scenes: Array<{ id: string; title: string; chapter: number }>
  characters: Array<{ id: string; name: string }>
}

/** The book, as a task's links need it: what each is called, and how to get there. */
export function useTaskBook(worldId: string): TaskBook {
  const navigate = useNavigate()
  const setActiveEventId = useAppStore((s) => s.setActiveEventId)
  const chapterRows = useWorldChapters(worldId)
  const events = useAllWorldEvents(worldId)
  const people = useCharacters(worldId)
  return useMemo(() => {
    const chapters = [...chapterRows].sort((a, b) => a.number - b.number).map((c) => ({ id: c.id, number: c.number, title: c.title }))
    const numberOf = new Map(chapters.map((c) => [c.id, c.number]))
    const scenes = events
      .map((e) => ({ id: e.id, title: e.title, chapter: numberOf.get(e.chapterId) ?? 0, sortOrder: e.sortOrder }))
      .sort((a, b) => a.chapter - b.chapter || a.sortOrder - b.sortOrder)
    const characters = [...people].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, name: c.name }))
    const label = (link: TaskLink): string | null => {
      if (link.kind === 'chapter') { const n = numberOf.get(link.id); return n === undefined ? null : `Ch. ${n}` }
      if (link.kind === 'scene') { const s = scenes.find((x) => x.id === link.id); return s ? s.title || 'Untitled scene' : null }
      return characters.find((c) => c.id === link.id)?.name ?? null
    }
    const go = (link: TaskLink) => {
      if (link.kind === 'chapter') navigate(`/worlds/${worldId}/manuscript/${link.id}`)
      else if (link.kind === 'scene') { setActiveEventId(link.id); navigate(`/worlds/${worldId}/manuscript`, { state: { reveal: link.id } }) }
      else navigate(`/worlds/${worldId}/characters/${link.id}`)
    }
    return { label, go, chapters, scenes, characters }
  }, [chapterRows, events, people, navigate, setActiveEventId, worldId])
}

/** Tasks in order, each under its letter's heading where it has one. */
export function TaskList({ worldId, tasks, book, label }: { worldId: string; tasks: RevisionTask[]; book: TaskBook; label: string }) {
  return (
    <ul aria-label={label} className="space-y-1">
      {tasks.map((t, i) => (
        <li key={t.id} className="list-none">
          {t.group && t.group !== tasks[i - 1]?.group && (
            <p className="mb-1 mt-2 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t.group}</p>
          )}
          <TaskRow worldId={worldId} task={t} book={book} />
        </li>
      ))}
    </ul>
  )
}

function TaskRow({ worldId, task, book }: { worldId: string; task: RevisionTask; book: TaskBook }) {
  const navigate = useNavigate()
  const setCheckerOpen = useAppStore((s) => s.setCheckerOpen)
  const setTimelineLayout = useAppStore((s) => s.setTimelineLayout)
  const setActiveEventId = useAppStore((s) => s.setActiveEventId)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(task.text)
  // A link to something gone from the book is not shown: there is nowhere to go.
  const links = task.links.map((l) => ({ link: l, name: book.label(l) })).filter((l): l is { link: TaskLink; name: string } => l.name !== null)
  const save = () => { if (text.trim() && text.trim() !== task.text) void updateRevisionTask(task.id, { text }); setEditing(false) }
  const source = task.source

  return (
    <div
      aria-label={`${task.done ? 'Done' : 'To do'}: ${task.text}`}
      role="group"
      className="flex items-start gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-2 text-sm"
    >
      <input
        type="checkbox"
        className="mt-1 accent-[hsl(var(--ring))]"
        checked={task.done}
        aria-label={`Done: ${task.text}`}
        onChange={(e) => void setRevisionTaskDone(task.id, e.target.checked)}
      />
      <div className="min-w-0 flex-1 space-y-1">
        {editing ? (
          <Input
            aria-label="Task"
            value={text}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); save() }
              if (e.key === 'Escape') { e.preventDefault(); setText(task.text); setEditing(false) }
            }}
          />
        ) : (
          <button
            className={cn('block w-full text-left', task.done && 'text-[hsl(var(--muted-foreground))] line-through')}
            title="Change what it says"
            onClick={() => { setText(task.text); setEditing(true) }}
          >
            {task.text}
          </button>
        )}
        <div className="flex flex-wrap items-center gap-1">
          {links.map(({ link, name }) => (
            <span key={`${link.kind}:${link.id}`} className="inline-flex items-center rounded bg-[hsl(var(--muted))] text-[11px]">
              <button className="px-1.5 py-0.5 hover:underline" title={`Go to ${name}`} onClick={() => book.go(link)}>{name}</button>
              <button
                aria-label={`Unlink ${name}`}
                className="pr-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                onClick={() => void updateRevisionTask(task.id, { links: task.links.filter((l) => !(l.kind === link.kind && l.id === link.id)) })}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          <LinkPicker book={book} taken={task.links} onPick={(link) => void updateRevisionTask(task.id, { links: [...task.links, link] })} />
        </div>
        {source && (
          <p className="flex items-center gap-1 text-[11px] text-[hsl(var(--muted-foreground))]">
            {source.kind === 'letter' && <>From the letter: {source.letter}</>}
            {source.kind === 'note' && (
              <>
                <StickyNote className="h-3 w-3" aria-hidden="true" />
                <button
                  className="truncate text-left underline decoration-[hsl(var(--border))] underline-offset-2 hover:decoration-[hsl(var(--ring))]"
                  onClick={async () => {
                    const eventId = task.links.find((l) => l.kind === 'scene')?.id
                    setTimelineLayout(worldId, 'page')
                    if (eventId) setActiveEventId(eventId)
                    navigate(`/worlds/${worldId}/manuscript`, { state: { ...(eventId ? { reveal: eventId } : {}), note: source.noteId } })
                  }}
                >
                  From a note on “{source.quote}”
                </button>
              </>
            )}
            {source.kind === 'issue' && (
              <>
                {source.audit ? <Sparkles className="h-3 w-3" aria-hidden="true" /> : <ShieldCheck className="h-3 w-3" aria-hidden="true" />}
                <button
                  className="truncate text-left underline decoration-[hsl(var(--border))] underline-offset-2 hover:decoration-[hsl(var(--ring))]"
                  onClick={() => setCheckerOpen(true)}
                >
                  {source.audit ? 'From the AI audit' : 'From the continuity check'}: {source.message}
                </button>
              </>
            )}
          </p>
        )}
      </div>
      <Button size="sm" variant="ghost" className="h-7 w-7 shrink-0 p-0 text-[hsl(var(--muted-foreground))]" aria-label={`Delete: ${task.text}`} onClick={() => void deleteRevisionTask(task.id)}>
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  )
}

/** Link a task to a chapter, a scene or a character it is not linked to yet. */
export function LinkPicker({ book, taken, onPick }: { book: TaskBook; taken: TaskLink[]; onPick: (link: TaskLink) => void }) {
  const has = (kind: TaskLink['kind'], id: string) => taken.some((l) => l.kind === kind && l.id === id)
  return (
    <Select value="" onValueChange={(v) => { const [kind, id] = v.split(':') as [TaskLink['kind'], string]; onPick({ kind, id }) }}>
      <SelectTrigger aria-label="Link to…" className="h-6 w-auto gap-1 border-dashed px-1.5 text-[11px]">
        <Link2 className="h-3 w-3" aria-hidden="true" />
        <SelectValue placeholder="Link" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Chapters</SelectLabel>
          {book.chapters.filter((c) => !has('chapter', c.id)).map((c) => <SelectItem key={c.id} value={`chapter:${c.id}`}>{`Ch. ${c.number}${c.title ? ` · ${c.title}` : ''}`}</SelectItem>)}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Scenes</SelectLabel>
          {book.scenes.filter((s) => !has('scene', s.id)).map((s) => <SelectItem key={s.id} value={`scene:${s.id}`}>{`Ch. ${s.chapter} · ${s.title || 'Untitled scene'}`}</SelectItem>)}
        </SelectGroup>
        {book.characters.length > 0 && (
          <SelectGroup>
            <SelectLabel>Characters</SelectLabel>
            {book.characters.filter((c) => !has('character', c.id)).map((c) => <SelectItem key={c.id} value={`character:${c.id}`}>{c.name}</SelectItem>)}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  )
}
