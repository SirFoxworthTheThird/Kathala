import { useMemo, useState } from 'react'
import { Check, ListPlus, Mail, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { plural } from '@/lib/plural'
import { addRevisionTask, useRevisionTasks, type NewTask } from '@/db/hooks/useRevisionTasks'
import { useEvents } from '@/db/hooks/useTimeline'
import type { RevisionTask } from '@/types'
import { TaskList, useTaskBook } from './TaskList'
import { LetterDialog } from './LetterDialog'

/*
  Revisions (editorial-plan.md, R5): the book's tasks on the dashboard,
  counted against it, and a chapter's in its panel.
*/

/** "12 of 31 done", and a bar that fills as they are. */
function Progress({ tasks, label }: { tasks: RevisionTask[]; label: string }) {
  const done = tasks.filter((t) => t.done).length
  return (
    <div className="space-y-1">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{done} of {tasks.length} done</p>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={done} className="h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]">
        <div className="h-full bg-emerald-500" style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} />
      </div>
    </div>
  )
}

/** A task, said in a line: Enter adds it. */
function AddTask({ placeholder, onAdd }: { placeholder: string; onAdd: (text: string) => Promise<unknown> }) {
  const [text, setText] = useState('')
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void onAdd(text).then(() => setText('')) }}>
      <Input aria-label="A new task" placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} className="h-8 text-sm" />
      <Button type="submit" size="sm" variant="outline" className="h-8 gap-1" disabled={!text.trim()}>
        <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add
      </Button>
    </form>
  )
}

/** Open first, in order; the done ones under them on asking. */
function OpenAndDone({ worldId, tasks, book, what }: { worldId: string; tasks: RevisionTask[]; book: ReturnType<typeof useTaskBook>; what: string }) {
  const [showDone, setShowDone] = useState(false)
  const open = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done)
  return (
    <div className="space-y-2">
      {open.length > 0 ? <TaskList worldId={worldId} tasks={open} book={book} label={`Open tasks${what}`} /> : tasks.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]"><Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" /> Every task is done.</p>
      )}
      {done.length > 0 && (
        <>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" aria-expanded={showDone} onClick={() => setShowDone((s) => !s)}>
            {showDone ? 'Hide the done' : `Show the ${plural(done.length, 'done task')}`}
          </Button>
          {showDone && <TaskList worldId={worldId} tasks={done} book={book} label={`Done tasks${what}`} />}
        </>
      )}
    </div>
  )
}

/** The book's tasks, on the dashboard. */
export function RevisionsSection({ worldId }: { worldId: string }) {
  const tasks = useRevisionTasks(worldId)
  const book = useTaskBook(worldId)
  const [letterOpen, setLetterOpen] = useState(false)
  return (
    <section aria-label="Revisions" className="space-y-3">
      {tasks.length > 0 ? <Progress tasks={tasks} label="Revision tasks done" /> : (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          The work a review asks for, as a list: paste an editor’s letter to split it into tasks, or add them one at a time.
          A note on the prose, or something the continuity check found, can become one too.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[16rem] flex-1"><AddTask placeholder="Something to do in the next draft…" onAdd={(text) => addRevisionTask(worldId, { text })} /></div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setLetterOpen(true)}>
          <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Paste an editorial letter…
        </Button>
      </div>
      <OpenAndDone worldId={worldId} tasks={tasks} book={book} what="" />
      <LetterDialog worldId={worldId} book={book} open={letterOpen} onOpenChange={setLetterOpen} />
    </section>
  )
}

/** A chapter's tasks — those linked to it, or to any of its scenes — in its panel. */
export function ChapterTasks({ worldId, chapterId, chapterNumber }: { worldId: string; chapterId: string; chapterNumber: number }) {
  const all = useRevisionTasks(worldId)
  const scenes = useEvents(chapterId)
  const book = useTaskBook(worldId)
  const tasks = useMemo(() => {
    const ids = new Set([chapterId, ...scenes.map((s) => s.id)])
    return all.filter((t) => t.links.some((l) => (l.kind === 'chapter' || l.kind === 'scene') && ids.has(l.id)))
  }, [all, scenes, chapterId])
  const done = tasks.filter((t) => t.done).length
  return (
    <div aria-label={`Revision tasks for chapter ${chapterNumber}`} role="region" className="flex flex-col border-t border-[hsl(var(--border))]">
      <div className="flex items-center gap-2 px-4 py-2">
        <ListPlus className="h-4 w-4 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
        <span className="flex-1 text-sm font-medium">Revisions</span>
        {tasks.length > 0 && <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{done} of {tasks.length} done</span>}
      </div>
      <div className="space-y-2 px-3 pb-3">
        <OpenAndDone worldId={worldId} tasks={tasks} book={book} what={` for chapter ${chapterNumber}`} />
        <AddTask placeholder="A task for this chapter…" onAdd={(text) => addRevisionTask(worldId, { text, links: [{ kind: 'chapter', id: chapterId }] })} />
      </div>
    </div>
  )
}

/**
 * Make a task of something — a note, a finding — once: after that, it says a
 * task was made from it.
 */
export function MakeTaskButton({ worldId, made, task, className }: {
  worldId: string
  /** Whether a task already came from this. */
  made: (t: RevisionTask) => boolean
  task: () => Promise<NewTask>
  className?: string
}) {
  const tasks = useRevisionTasks(worldId)
  const already = tasks.some(made)
  return (
    <Button
      size="sm"
      variant="ghost"
      className={className ?? 'h-7 gap-1 px-2 text-xs'}
      disabled={already}
      onClick={async () => { await addRevisionTask(worldId, await task()) }}
    >
      {already ? <><Check className="h-3 w-3" aria-hidden="true" /> A task</> : <><ListPlus className="h-3 w-3" aria-hidden="true" /> Make a task</>}
    </Button>
  )
}

