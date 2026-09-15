import { useEffect, useState, type RefObject } from 'react'
import { readingPlace, minutesLeft, type ChapterExtent, type Place } from '@/lib/readingPlace'

/**
 * How far through the book the reader is, and how much of this chapter is left.
 *
 * The reading screen is one continuous column — 1,918 screens of it for *The
 * Count of Monte Cristo* — and a scrollbar across that says nothing. This is
 * the pair of facts a paperback gives away by being thick on one side: where
 * you are in the whole thing, and how near the next stopping place is.
 *
 * **It owns its own state on purpose.** Scroll position changes constantly, and
 * holding it in `ManuscriptView` would re-render the entire book on every
 * frame. Keeping it here confines that to one line of text.
 *
 * The chapter extents are measured once and cached, because reading `offsetTop`
 * forces layout: doing it for all 117 of Monte Cristo's chapters on every
 * scroll frame is exactly the jank this screen cannot afford. Only `scrollTop`
 * is read while scrolling, which is free. A resize re-measures.
 */
export function ReadingProgress({
  scrollRef,
  chapterCount,
}: {
  scrollRef: RefObject<HTMLDivElement | null>
  /** Re-measure when the book itself changes, not when the reader moves. */
  chapterCount: number
}) {
  const [place, setPlace] = useState<Place | null>(null)

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return

    let extents: ChapterExtent[] = []
    const measureExtents = () => {
      extents = Array.from(root.querySelectorAll<HTMLElement>('[data-chapter-number]')).map((el) => ({
        number: Number(el.dataset.chapterNumber),
        top: el.offsetTop,
        height: el.offsetHeight,
        words: Number(el.dataset.chapterWords ?? '0'),
      }))
    }

    let frame = 0
    const read = () => {
      frame = 0
      setPlace(readingPlace({
        scrollTop: root.scrollTop,
        scrollHeight: root.scrollHeight,
        clientHeight: root.clientHeight,
        chapters: extents,
      }))
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(read) }

    // After layout, or every extent is measured against a column that has not
    // been laid out yet and they all read zero.
    const first = requestAnimationFrame(() => { measureExtents(); read() })

    const onResize = () => { measureExtents(); read() }
    root.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      root.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(first)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [scrollRef, chapterCount])

  if (!place) return null
  const { percent, chapter } = place

  return (
    <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
      <div
        className="h-1 w-24 shrink-0 overflow-hidden rounded-full bg-[hsl(var(--muted))]"
        role="progressbar"
        aria-label="Progress through the book"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-[hsl(var(--primary))] transition-[width] duration-150"
          style={{ width: `${percent}%` }}
        />
      </div>
      {/*
        Said in words as well as drawn, because the bar alone is unreadable to a
        screen reader beyond its number, and "72%" without "of the book" is a
        percentage of nothing in particular.
      */}
      <span className="tabular-nums">{percent}% of the book</span>
      {chapter && (
        <>
          <span aria-hidden="true">·</span>
          <span>
            Chapter {chapter.number} of {chapterCount}
          </span>
          {chapter.wordsLeft > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="hidden sm:inline">
                about {minutesLeft(chapter.wordsLeft)} min left in it
              </span>
            </>
          )}
        </>
      )}
    </div>
  )
}
