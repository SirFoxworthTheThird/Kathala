import { useCallback } from 'react'
import { useAppStore } from '@/store'
import { useGate } from '@/db/hooks/ReadingGateContext'

/**
 * Look at a moment without relocating the reader's place in the book.
 *
 * For a writer the time cursor is a viewfinder: every screen moves it, that is
 * the idiom, and it costs nothing. For a reader the same value is **the one
 * piece of state they own** — where they have read up to — and a reader run
 * found it being reassigned as a side effect of looking at something. Cursor at
 * chapter 8, tap an earlier scene on the Calendar to remind yourself what it
 * was, and both the cursor and the stored position were chapter 3, with no undo
 * (reading mode removes it) and the shelf reporting *"Chapter 3 of 62"* a week
 * later.
 *
 * So while reading, the position moves only from the controls that say they
 * move it — the previous/next moment steppers, and *View from here*, whose
 * tooltip reads "Move the time cursor to this chapter's first moment".
 * Everything else navigates and leaves the bookmark alone.
 *
 * `ChapterDetailView` already made exactly this decision for its own arrival
 * effect — *"there the cursor is the reader's own place in the book"* — and this
 * is that rule everywhere else.
 */
export function useShowMoment() {
  const gate = useGate()
  const setActiveEventId = useAppStore((s) => s.setActiveEventId)
  return useCallback(
    (eventId: string | null) => {
      if (gate.active) return
      setActiveEventId(eventId)
    },
    [gate.active, setActiveEventId],
  )
}
