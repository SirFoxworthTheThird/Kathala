import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { binderKey, binderRows, focusAfterDelete, type BinderRow } from '@/lib/binder'
import { chapterWithheld } from '@/lib/chapterReached'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { createChapter, createEventAt, deleteEvent } from '@/db/hooks/useTimeline'
import type { Chapter, WorldEvent } from '@/types'
import { cn } from '@/lib/utils'

interface BinderProps {
  worldId: string
  timelineId: string
  /** The chapter on screen — opened in the binder when you arrive at it. */
  currentChapterId: string
  /** This timeline's chapters. */
  chapters: readonly Chapter[]
  /** This timeline's scenes, already stopped at the reader's cursor by `useWorldEvents`. */
  scenes: readonly WorldEvent[]
  activeEventId: string | null
  onGoScene: (scene: WorldEvent) => void
  onGoChapter: (chapter: Chapter) => void
}

type Adding =
  | { kind: 'scene'; chapterId: string; index: number; returnTo: string | null }
  | { kind: 'chapter'; returnTo: string | null }

/**
 * The book's chapters and scenes, beside the writing.
 *
 * Structure used to happen on the Timeline screen and writing on this one, so
 * moving to another scene, or making one, meant leaving the prose to do it. The
 * binder brings the tree here.
 *
 * Keyboard first, because that is where a writer's hands are: the arrows move
 * and open, **Enter makes a scene on the line below** — a title typed in place,
 * no form — and Delete removes one, with the app's undo to catch a stray key.
 * The rules are `binderKey` in `src/lib/binder.ts`, tested without a browser.
 *
 * Rows hold nothing focusable. A tree's keyboard model is one tab stop that
 * the arrows move, and a button inside a row would be a second one the arrows
 * cannot reach. So there is no per-row menu: the mouse deletes a scene from its
 * card, one column over, and the two actions a mouse needs here are the
 * buttons under the tree.
 */
export function Binder({
  worldId, timelineId, currentChapterId, chapters, scenes, activeEventId, onGoScene, onGoChapter,
}: BinderProps) {
  const gate = useGate()
  const editable = !gate.active

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([currentChapterId]))
  useEffect(() => {
    setExpanded((prev) => (prev.has(currentChapterId) ? prev : new Set(prev).add(currentChapterId)))
  }, [currentChapterId])

  const rows = useMemo(
    () => binderRows(chapters, scenes, {
      expanded,
      showChapter: (c) => !chapterWithheld(gate, c.number),
    }),
    [chapters, scenes, expanded, gate],
  )

  const [focusedId, setFocusedId] = useState<string | null>(null)
  /*
    The one row Tab lands on: the last one focused if it is still showing, else
    the scene the cursor is on, else the chapter on screen. A collapsed chapter
    takes its hidden scene's place rather than leaving the tree with no stop.
  */
  const has = (id: string | null) => id !== null && rows.some((r) => r.id === id)
  const focusedScene = scenes.find((s) => s.id === focusedId)
  const rovingId = has(focusedId) ? focusedId
    : focusedScene && has(focusedScene.chapterId) ? focusedScene.chapterId
    : has(activeEventId) ? activeEventId
    : has(currentChapterId) ? currentChapterId
    : rows[0]?.id ?? null

  const rowEls = useRef(new Map<string, HTMLElement>())
  /*
    A row asked to take focus may not exist yet — a scene just created arrives
    on the next live-query pass — so the request waits until it does.
  */
  const pendingFocus = useRef<string | null>(null)
  useEffect(() => {
    const id = pendingFocus.current
    if (!id) return
    const el = rowEls.current.get(id)
    if (el) {
      el.focus()
      pendingFocus.current = null
    }
  })
  function focusRow(id: string) {
    setFocusedId(id)
    pendingFocus.current = id
  }

  const [adding, setAdding] = useState<Adding | null>(null)

  function openChapter(chapterId: string) {
    setExpanded((prev) => (prev.has(chapterId) ? prev : new Set(prev).add(chapterId)))
  }
  function toggle(chapterId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (!next.delete(chapterId)) next.add(chapterId)
      return next
    })
  }

  function go(row: BinderRow) {
    if (row.kind === 'scene') {
      const scene = scenes.find((s) => s.id === row.id)
      if (scene) onGoScene(scene)
      return
    }
    openChapter(row.chapterId)
    const chapter = chapters.find((c) => c.id === row.chapterId)
    if (chapter) onGoChapter(chapter)
  }

  function startAddingAt(from: string | null) {
    const action = binderKey(rows, from, 'Enter', true)
    if (action?.type !== 'add') return
    openChapter(action.chapterId)
    setAdding({ kind: 'scene', chapterId: action.chapterId, index: action.index, returnTo: from })
  }

  async function handleKey(e: KeyboardEvent<HTMLDivElement>) {
    // The title being typed owns its own keys, and a chord is somebody else's
    // shortcut — Ctrl+Z most of all, which the app's undo answers.
    if ((e.target as HTMLElement).tagName === 'INPUT') return
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const action = binderKey(rows, rovingId, e.key, editable)
    if (!action) return
    e.preventDefault()
    switch (action.type) {
      case 'focus':
        focusRow(action.id)
        break
      case 'expand':
        openChapter(action.chapterId)
        break
      case 'collapse':
        toggle(action.chapterId)
        break
      case 'go':
        go(action.row)
        break
      case 'add':
        startAddingAt(rovingId)
        break
      case 'delete': {
        const next = focusAfterDelete(rows, action.sceneId)
        await deleteEvent(action.sceneId)
        if (next) focusRow(next)
        break
      }
    }
  }

  async function commitScene(target: Extract<Adding, { kind: 'scene' }>, title: string, byKey: boolean) {
    setAdding(null)
    const created = await createEventAt(target.chapterId, target.index, title)
    if (!created || !byKey) return
    /*
      Only from the keyboard. A title finished by clicking away was finished
      because the writer went somewhere else, and pulling focus and the cursor
      back to the binder would undo the click.
    */
    focusRow(created.id)
    onGoScene(created)
  }

  async function commitChapter(title: string, byKey: boolean) {
    setAdding(null)
    /*
      One past the highest number, not one past the count: after a chapter has
      been deleted those are different, and the count would hand out a number
      that is still in use.
    */
    const number = chapters.reduce((max, c) => Math.max(max, c.number), 0) + 1
    const created = await createChapter({ worldId, timelineId, number, title, synopsis: '' })
    openChapter(created.id)
    if (!byKey) return
    focusRow(created.id)
    onGoChapter(created)
  }

  function cancel(returnTo: string | null, byKey: boolean) {
    setAdding(null)
    // Escape hands focus back to the row it came from; clicking away was going
    // somewhere, and is left to arrive.
    if (returnTo && byKey) focusRow(returnTo)
  }

  const insertsAfter = (row: BinderRow) =>
    adding?.kind === 'scene' && row.chapterId === adding.chapterId
    && (row.kind === 'chapter' ? adding.index === 0 : row.index === adding.index - 1)

  return (
    <nav aria-label="Binder" className="flex h-full min-h-0 flex-col">
      {rows.length === 0 && adding === null ? (
        <p className="px-3 py-3 text-xs text-[hsl(var(--muted-foreground))]">No chapters yet.</p>
      ) : (
        <div
          role="tree"
          aria-label="Chapters and scenes"
          onKeyDown={(e) => { void handleKey(e) }}
          className="min-h-0 flex-1 overflow-auto py-1"
        >
          {rows.map((row) => (
            <Fragment key={row.id}>
              <div
                ref={(el) => {
                  if (el) rowEls.current.set(row.id, el)
                  else rowEls.current.delete(row.id)
                }}
                role="treeitem"
                aria-level={row.kind === 'chapter' ? 1 : 2}
                aria-posinset={row.position}
                aria-setsize={row.setSize}
                aria-expanded={row.kind === 'chapter' ? row.expanded : undefined}
                aria-current={row.kind === 'scene' && row.id === activeEventId ? 'true' : undefined}
                tabIndex={row.id === rovingId ? 0 : -1}
                onFocus={() => setFocusedId(row.id)}
                onClick={() => { focusRow(row.id); go(row) }}
                className={cn(
                  'flex h-7 cursor-pointer select-none items-center gap-1 rounded-sm pr-2 text-sm outline-none',
                  'hover:bg-[hsl(var(--accent))] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[hsl(var(--ring))]',
                  row.kind === 'chapter' ? 'pl-1 font-medium' : 'pl-7',
                  row.kind === 'chapter' && row.chapterId === currentChapterId && 'text-[hsl(var(--foreground))]',
                  row.kind === 'chapter' && row.chapterId !== currentChapterId && 'text-[hsl(var(--muted-foreground))]',
                  row.kind === 'scene' && row.id === activeEventId && 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]',
                  row.kind === 'scene' && row.id !== activeEventId && 'text-[hsl(var(--muted-foreground))]',
                )}
              >
                {row.kind === 'chapter' ? (
                  <>
                    {/*
                      Mouse only, and deliberately: the arrows open and close a
                      chapter from the keyboard, and a focusable toggle inside
                      the row would be a stop the arrows cannot reach.
                    */}
                    <span
                      aria-hidden="true"
                      onClick={(e) => { e.stopPropagation(); toggle(row.chapterId) }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm hover:bg-[hsl(var(--muted))]"
                    >
                      <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', row.expanded && 'rotate-90')} />
                    </span>
                    <span className="truncate">Ch. {row.number} · {row.title || 'Untitled chapter'}</span>
                    {!row.expanded && row.sceneCount > 0 && (
                      <span className="ml-auto shrink-0 pl-1 text-[10px] font-normal text-[hsl(var(--muted-foreground))]">
                        {row.sceneCount}<span className="sr-only"> scenes</span>
                      </span>
                    )}
                  </>
                ) : (
                  <span className="truncate">{row.title || 'Untitled scene'}</span>
                )}
              </div>
              {insertsAfter(row) && adding?.kind === 'scene' && (
                <NewTitle
                  label="New scene title"
                  placeholder="Scene title"
                  indent="pl-7"
                  onCommit={(title, byKey) => { void commitScene(adding, title, byKey) }}
                  onCancel={(byKey) => cancel(adding.returnTo, byKey)}
                />
              )}
            </Fragment>
          ))}
          {adding?.kind === 'chapter' && (
            <NewTitle
              label="New chapter title"
              placeholder="Chapter title"
              indent="pl-2"
              onCommit={(title, byKey) => { void commitChapter(title, byKey) }}
              onCancel={(byKey) => cancel(adding.returnTo, byKey)}
            />
          )}
        </div>
      )}

      {editable && (
        <div className="shrink-0 border-t border-[hsl(var(--border))] px-2 py-1.5">
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs"
              disabled={rows.length === 0}
              onClick={() => startAddingAt(rovingId)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New scene
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => setAdding({ kind: 'chapter', returnTo: rovingId })}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New chapter
            </Button>
          </div>
          <p className="px-2 pt-1 text-[10px] leading-snug text-[hsl(var(--muted-foreground))]">
            In the list: Enter adds a scene below, Delete removes one.
          </p>
        </div>
      )}
    </nav>
  )
}

/**
 * A title typed in place. Enter keeps it, Escape throws it away, and clicking
 * elsewhere keeps what was typed — a title is never lost to where the mouse went
 * next. An empty one is not a scene.
 */
function NewTitle({
  label, placeholder, indent, onCommit, onCancel,
}: {
  label: string
  placeholder: string
  indent: string
  onCommit: (title: string, byKey: boolean) => void
  onCancel: (byKey: boolean) => void
}) {
  const [value, setValue] = useState('')
  // Enter commits and then the input unmounts, which blurs it: without this the
  // blur would commit a second time.
  const done = useRef(false)
  function finish(commit: boolean, byKey: boolean) {
    if (done.current) return
    done.current = true
    if (commit && value.trim()) onCommit(value.trim(), byKey)
    else onCancel(byKey)
  }
  return (
    <div className={cn('flex h-7 items-center pr-2', indent)}>
      <input
        autoFocus
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); finish(true, true) }
          else if (e.key === 'Escape') { e.preventDefault(); finish(false, true) }
        }}
        onBlur={() => finish(true, false)}
        className="h-6 w-full rounded-sm border border-[hsl(var(--ring))] bg-[hsl(var(--background))] px-1.5 text-sm outline-none"
      />
    </div>
  )
}
