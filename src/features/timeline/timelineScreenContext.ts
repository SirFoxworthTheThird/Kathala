import { useOutletContext } from 'react-router-dom'

/** The whole-book view's "every timeline merged" tab. */
export const ALL_TIMELINES = '__all__'

/**
 * What the Timeline screen's frame shares with the page inside it.
 *
 * The Timeline is one screen: the binder down the left, and on the right either
 * the whole book or one chapter. The frame outlives the page — going from the
 * whole book to a chapter and back swaps only the right-hand side — so state
 * that must survive the swap lives here rather than in either page.
 */
export interface TimelineScreenContext {
  /**
   * The whole book's timeline tab: a timeline id, `ALL_TIMELINES`, or null for
   * the first timeline. Kept in the frame so it is still selected on coming
   * back from a chapter, and so the binder lists the same timeline.
   */
  timelineTab: string | null
  setTimelineTab: (id: string | null) => void
  /** Open the binder as a drawer — the way round a chapter on a narrow screen. */
  openBinderDrawer: () => void
}

const STANDALONE: TimelineScreenContext = {
  timelineTab: null,
  setTimelineTab: () => {},
  openBinderDrawer: () => {},
}

/**
 * The frame's context, or inert defaults for a page rendered without it — so
 * neither page has to know whether it is inside the frame to render at all.
 */
export function useTimelineScreen(): TimelineScreenContext {
  return useOutletContext<TimelineScreenContext | undefined>() ?? STANDALONE
}
