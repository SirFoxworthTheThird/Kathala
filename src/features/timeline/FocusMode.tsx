import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Minimize2 } from 'lucide-react'
import { setSceneText } from '@/db/hooks/useManuscript'
import { wordCount } from '@/lib/manuscript'
import { focusStats, sessionGoalPercent } from '@/lib/focusSession'

interface FocusModeProps {
  worldId: string
  eventId: string
  /** Scene / event title shown in the slim header. */
  title: string
  /** The scene's prose when focus mode opens. */
  initialText: string
  onExit: () => void
}

const AUTOSAVE_MS = 1000

/**
 * Distraction-free full-screen writing surface for a single scene. Hides the app
 * chrome, keeps the caret line vertically centred (typewriter scrolling), shows a
 * live word + session count and ambient progress toward the daily session goal,
 * and autosaves through setSceneText (so revisions and the writing log still fire).
 * Esc exits.
 */
export function FocusMode({ worldId, eventId, title, initialText, onExit }: FocusModeProps) {
  const [text, setText] = useState(initialText)
  const startWords = useMemo(() => wordCount(initialText), [initialText])
  const stats = focusStats(startWords, wordCount(text))

  const scrollerRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<number | null>(null)
  const latest = useRef(initialText)
  latest.current = text

  const sessionGoal = Number(localStorage.getItem(`plotweave-session-goal-${worldId}`)) || 0

  // Debounced autosave; flush on unmount.
  function scheduleSave(next: string) {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => { setSceneText(worldId, eventId, next) }, AUTOSAVE_MS)
  }
  useEffect(() => () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    setSceneText(worldId, eventId, latest.current) // flush on exit
  }, [worldId, eventId])

  // Esc exits; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    taRef.current?.focus()
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onExit])

  // Typewriter scroll: keep the caret line centred in the scroller.
  function centreCaret() {
    const ta = taRef.current, scroller = scrollerRef.current, mirror = mirrorRef.current
    if (!ta || !scroller || !mirror) return
    const caret = ta.selectionStart
    mirror.textContent = text.slice(0, caret)
    const marker = document.createElement('span')
    marker.textContent = '​'
    mirror.appendChild(marker)
    const caretY = marker.offsetTop
    mirror.removeChild(marker)
    // Mirror sits at the same offset as the textarea inside the scroller.
    const target = ta.offsetTop + caretY - scroller.clientHeight / 2
    scroller.scrollTo({ top: Math.max(0, target), behavior: 'auto' })
  }

  // Auto-grow the textarea so the scroller (not the textarea) owns scrolling.
  useLayoutEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
    centreCaret()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value
    setText(next)
    scheduleSave(next)
  }

  const goalPct = sessionGoalPercent(stats.added, sessionGoal)

  return createPortal(
    <div className="fixed inset-0 z-[4000] flex flex-col bg-[hsl(var(--background))]">
      {/* Slim header */}
      <div className="flex shrink-0 items-center gap-3 px-4 py-2 text-xs text-[hsl(var(--muted-foreground))]">
        <span className="truncate">{title || 'Untitled scene'}</span>
        <span className="ml-auto tabular-nums">
          {stats.current.toLocaleString()} words
          {stats.sessionDelta !== 0 && (
            <span className={stats.sessionDelta > 0 ? 'text-emerald-400' : 'text-[hsl(var(--muted-foreground))]'}>
              {' '}({stats.sessionDelta > 0 ? '+' : ''}{stats.sessionDelta.toLocaleString()} this session)
            </span>
          )}
        </span>
        <span className="hidden sm:inline">Esc to exit</span>
        <button
          onClick={onExit}
          aria-label="Exit focus mode"
          title="Exit focus mode (Esc)"
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Writing surface */}
      <div ref={scrollerRef} className="relative flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6" style={{ paddingTop: '42vh', paddingBottom: '42vh' }}>
          <textarea
            ref={taRef}
            value={text}
            onChange={handleChange}
            onClick={centreCaret}
            onKeyUp={centreCaret}
            placeholder="Write…"
            spellCheck
            className="w-full resize-none overflow-hidden bg-transparent font-serif text-lg leading-loose text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground)/0.5)] focus:outline-none"
          />
        </div>
        {/* Hidden mirror for caret measurement (matches the textarea's box). */}
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute left-1/2 top-0 w-full max-w-2xl -translate-x-1/2 whitespace-pre-wrap break-words px-6 font-serif text-lg leading-loose"
          style={{ paddingTop: '42vh' }}
        />
      </div>

      {/* Ambient session-goal progress */}
      {sessionGoal > 0 && (
        <div className="shrink-0" title={`${stats.added} of ${sessionGoal} words toward today's goal`}>
          <div className="h-1 w-full bg-[hsl(var(--muted))]">
            <div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${goalPct}%` }} />
          </div>
        </div>
      )}

      {/* Exit affordance for touch */}
      <button
        onClick={onExit}
        aria-label="Exit focus mode"
        className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] shadow-lg hover:text-[hsl(var(--foreground))] sm:hidden"
      >
        <Minimize2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>,
    document.body
  )
}
