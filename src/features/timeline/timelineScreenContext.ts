import { useOutletContext } from 'react-router-dom'

/** The whole-book view's "every timeline merged" tab — and the reader's one book. */
export { ALL_TIMELINES } from '@/lib/readersBook'

/**
 * What the Timeline screen's frame shares with the page inside it.
 *
 * The frame is the binder down the left; the page is the book, open at a
 * chapter or not. The binder lists one timeline and the page shows one, so the
 * tab choosing it lives here, where both can read it.
 */
export interface TimelineScreenContext {
  /**
   * The timeline tab: a timeline id, `ALL_TIMELINES`, or null for the first
   * timeline. Opening a chapter switches it to that chapter's timeline, so the
   * binder and the list agree on which one you are in.
   */
  timelineTab: string | null
  setTimelineTab: (id: string | null) => void
  /**
   * Slide the binder in over the page, where there is no room for its column —
   * or null where there is no binder to slide in.
   */
  showBinderSheet: (() => void) | null
}

const STANDALONE: TimelineScreenContext = {
  timelineTab: null,
  setTimelineTab: () => {},
  showBinderSheet: null,
}

/**
 * The frame's context, or inert defaults for a page rendered without it — so
 * the page does not have to know whether it is inside the frame to render at all.
 */
export function useTimelineScreen(): TimelineScreenContext {
  return useOutletContext<TimelineScreenContext | undefined>() ?? STANDALONE
}
