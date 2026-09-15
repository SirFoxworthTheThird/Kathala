import { useEffect, useRef, useState, type RefObject } from 'react'
import { List, CornerUpLeft } from 'lucide-react'
import { chaptersBehind, shouldOfferReturn, type ContentsChapter } from '@/lib/readingContents'
import { cn } from '@/lib/utils'

/**
 * Turning back, without un-revealing.
 *
 * Scrolling up re-hides nothing — `cursorForScene` never moves the cursor
 * backwards — so reading back was always safe. What a reader did not have was a
 * *way* back that was not a very long scroll, and a way to return afterwards.
 * The chapter bar's scrubber looks like that way and is not: moving it moves
 * the gate, so checking a name from four chapters ago costs everything learned
 * since.
 *
 * So: a list of where you have been, and a way back to where you were. Neither
 * touches the cursor. The list holds only chapters already reached, for the
 * reason set out on `chaptersBehind` — a click landing ten chapters ahead would
 * be a ten-chapter reveal.
 */
export function ReadingContents({
  scrollRef,
  chapters,
  gateChapterNumber,
  placeEventId,
}: {
  scrollRef: RefObject<HTMLDivElement | null>
  chapters: readonly ContentsChapter[]
  /** The chapter the spoiler gate has reached, or null for "all chapters". */
  gateChapterNumber: number | null
  /** The scene the reader's place is on, which is where "back" goes. */
  placeEventId: string | null
}) {
  const [open, setOpen] = useState(false)
  const [offerReturn, setOfferReturn] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const behind = chaptersBehind(chapters, gateChapterNumber)

  // Watch how far the reader has strayed from their place.
  useEffect(() => {
    const root = scrollRef.current
    if (!root || !placeEventId) { setOfferReturn(false); return }
    let frame = 0
    const read = () => {
      frame = 0
      const el = root.querySelector<HTMLElement>(`[data-scene-event-id="${CSS.escape(placeEventId)}"]`)
      setOfferReturn(shouldOfferReturn({
        scrollTop: root.scrollTop,
        placeTop: el ? el.offsetTop : null,
        clientHeight: root.clientHeight,
      }))
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(read) }
    read()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [scrollRef, placeEventId])

  // Close the list on a click elsewhere, the way a menu does.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const goTo = (selector: string) => {
    const root = scrollRef.current
    root?.querySelector<HTMLElement>(selector)?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }

  const btn = 'rounded-md border border-[hsl(var(--border))] px-2 py-1 text-xs transition-colors hover:bg-[hsl(var(--accent)/0.4)]'

  return (
    <div className="relative flex items-center gap-2" ref={panelRef}>
      {offerReturn && (
        <button
          type="button"
          className={cn(btn, 'flex items-center gap-1')}
          onClick={() => { if (placeEventId) goTo(`[data-scene-event-id="${CSS.escape(placeEventId)}"]`) }}
        >
          <CornerUpLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to your place
        </button>
      )}

      <button
        type="button"
        className={cn(btn, 'flex items-center gap-1', open && 'bg-[hsl(var(--accent))]')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        disabled={behind.length === 0}
      >
        <List className="h-3.5 w-3.5" aria-hidden="true" />
        Contents
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-1 max-h-80 w-64 overflow-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1 shadow-lg"
          role="group"
          aria-label="Chapters you have read"
        >
          {/*
            Only what is behind them, so the list cannot become a way to read
            ahead by accident. A reader looking for what comes next finds it by
            reading, which moves the gate a scene at a time as it should.
          */}
          {behind.map((c) => (
            <button
              key={c.id}
              type="button"
              className="block w-full truncate rounded px-2 py-1.5 text-left text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent)/0.5)]"
              onClick={() => {
                setOpen(false)
                goTo(`[data-chapter-number="${c.number}"]`)
              }}
            >
              <span className="tabular-nums text-[hsl(var(--muted-foreground))]">{c.number}.</span>{' '}
              {c.title || 'Untitled'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
