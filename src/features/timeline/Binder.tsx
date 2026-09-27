import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { BookOpen, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { binderKey, binderRows, focusAfterDelete, type BinderRow } from '@/lib/binder'
import { chapterWithheld } from '@/lib/chapterReached'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { createChapterAt, createEventAt, deleteEvent } from '@/db/hooks/useTimeline'
import { describeShift, nextChapterNumber, parseChapterNumber, planChapterInsert } from '@/lib/chapterNumbering'
import type { Chapter, WorldEvent } from '@/types'
import { cn } from '@/lib/utils'

interface BinderProps {
  worldId: string
  timelineId: string
  /** Said above the list when the world has more than one timeline. */
  timelineName?: string
  /**
   * The chapter on screen — opened in the binder when you arrive at it. Null on
   * the whole book, where no chapter is.
   */
  currentChapterId: string | null
  /** This timeline's chapters. */
  chapters: readonly Chapter[]
  /** This timeline's scenes, already stopped at the reader's cursor by `useWorldEvents`. */
  scenes: readonly WorldEvent[]
  activeEventId: string | null
  onGoScene: (scene: WorldEvent) => void
  onGoChapter: (chapter: Chapter) => void
  onGoBook: () => void
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
  worldId, timelineId, timelineName, currentChapterId, chapters, scenes, activeEventId,
  onGoScene, onGoChapter, onGoBook,
}: BinderProps) {
  const gate = useGate()
  const editable = !gate.active

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(currentChapterId ? [currentChapterId] : []),
  )
  useEffect(() => {
    if (!currentChapterId) return
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

  async function commitChapter(title: string, number: number, byKey: boolean) {
    setAdding(null)
    // A taken number puts the chapter there and moves the rest up — see
    // `createChapterAt`. The suggestion is one past the highest.
    const created = await createChapterAt({ worldId, timelineId, number, title, synopsis: '' })
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
      {/*
        The other half of the screen. The whole book — every chapter at once,
        its orders, filters and bulk actions — is the same screen with a
        different right-hand side, so it sits above the list rather than being a
        place you leave for. A link, outside the tree: the tree is chapters and
        scenes, and this is neither.
      */}
      <div className="shrink-0 border-b border-[hsl(var(--border))] px-1 py-1">
        <button
          type="button"
          onClick={onGoBook}
          aria-current={currentChapterId === null ? 'page' : undefined}
          className={cn(
            'flex h-7 w-full items-center gap-1.5 rounded-sm px-2 text-left text-sm',
            'hover:bg-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]',
            currentChapterId === null
              ? 'bg-[hsl(var(--accent))] font-medium text-[hsl(var(--foreground))]'
              : 'text-[hsl(var(--muted-foreground))]',
          )}
        >
          <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Whole book
        </button>
        {timelineName && (
          <p className="truncate px-2 pt-0.5 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            {timelineName}
          </p>
        )}
      </div>
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
            <NewChapter
              chapters={chapters}
              onCommit={(title, number, byKey) => { void commitChapter(title, number, byKey) }}
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

/**
 * A new chapter's number and title, typed in place.
 *
 * The number holds the suggestion — one past the highest — and can be changed:
 * a taken number puts the chapter there and moves the rest up, and the line
 * under the row says which before anything happens. The title takes focus,
 * since that is what is being written; the number sits before it, one Shift+Tab away.
 *
 * Two fields, so leaving one for the other is not finishing. Only focus leaving
 * the row keeps what was typed, the same as a scene's title.
 */
function NewChapter({
  chapters, onCommit, onCancel,
}: {
  chapters: readonly Chapter[]
  onCommit: (title: string, number: number, byKey: boolean) => void
  onCancel: (byKey: boolean) => void
}) {
  const suggested = nextChapterNumber(chapters)
  const [title, setTitle] = useState('')
  const [numberText, setNumberText] = useState(String(suggested))
  const number = parseChapterNumber(numberText)
  const moves = number === null ? '' : describeShift(planChapterInsert(chapters, number))
  const row = useRef<HTMLDivElement>(null)
  const done = useRef(false)

  function finish(commit: boolean, byKey: boolean) {
    if (done.current) return
    // A number that is not one keeps the row open rather than guessing — the
    // note under it says why.
    if (commit && title.trim() && number === null) return
    done.current = true
    if (commit && title.trim() && number !== null) onCommit(title.trim(), number, byKey)
    else onCancel(byKey)
  }
  function keys(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); finish(true, true) }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false, true) }
  }

  return (
    <div
      ref={row}
      className="flex flex-col gap-0.5 py-0.5 pl-2 pr-2"
      onBlur={(e) => {
        if (row.current?.contains(e.relatedTarget as Node | null)) return
        finish(true, false)
      }}
    >
      <div className="flex h-7 items-center gap-1">
        <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]" aria-hidden="true">Ch.</span>
        <input
          aria-label="New chapter number"
          aria-describedby="binder-chapter-note"
          aria-invalid={number === null}
          inputMode="numeric"
          value={numberText}
          onChange={(e) => setNumberText(e.target.value)}
          onKeyDown={keys}
          className="h-6 w-10 shrink-0 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1 text-center text-sm outline-none focus:border-[hsl(var(--ring))]"
        />
        <input
          autoFocus
          aria-label="New chapter title"
          aria-describedby="binder-chapter-note"
          placeholder="Chapter title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={keys}
          className="h-6 min-w-0 flex-1 rounded-sm border border-[hsl(var(--ring))] bg-[hsl(var(--background))] px-1.5 text-sm outline-none"
        />
      </div>
      <p id="binder-chapter-note" className="pl-6 text-[10px] leading-snug text-[hsl(var(--muted-foreground))]">
        {number === null ? 'A whole number — 0 for a prologue.' : moves ? `${moves}.` : ''}
      </p>
    </div>
  )
}
