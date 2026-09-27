import { useOutletContext } from 'react-router-dom'

/** The whole-book view's "every timeline merged" tab. */
export const ALL_TIMELINES = '__all__'

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
}

const STANDALONE: TimelineScreenContext = {
  timelineTab: null,
  setTimelineTab: () => {},
}

/**
 * The frame's context, or inert defaults for a page rendered without it — so
 * the page does not have to know whether it is inside the frame to render at all.
 */
export function useTimelineScreen(): TimelineScreenContext {
  return useOutletContext<TimelineScreenContext | undefined>() ?? STANDALONE
}
