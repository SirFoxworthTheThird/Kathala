import { useMemo } from 'react'
import { useTimelineRelationships } from '@/db/hooks/useTimelineRelationships'
import { useTimelines } from '@/db/hooks/useTimeline'

export const BAR_H_SINGLE = '4rem'
export const BAR_H_STACKED = '6.25rem'

/**
 * Returns the height the ChapterTimelineBar will occupy.
 * Single-track: 4rem. Stacked (a frame narrative or exactly two timelines): 6.25rem.
 * Pass null / undefined when on the dashboard — returns '0'.
 */
export function useBarHeight(worldId: string | null | undefined): string {
  const relationships = useTimelineRelationships(worldId ?? null)
  const timelines = useTimelines(worldId ?? null)
  const hasStackedTimelines = useMemo(() => {
    const tlIds = new Set(timelines.map((t) => t.id))
    const hasFrameNarrative = relationships.some(
      (r) => r.type === 'frame_narrative' && tlIds.has(r.sourceTimelineId) && tlIds.has(r.targetTimelineId)
    )
    return hasFrameNarrative || timelines.length === 2
  }, [relationships, timelines])
  return hasStackedTimelines ? BAR_H_STACKED : BAR_H_SINGLE
}
