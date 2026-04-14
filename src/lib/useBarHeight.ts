import { useMemo } from 'react'
import { useTimelineRelationships } from '@/db/hooks/useTimelineRelationships'
import { useTimelines } from '@/db/hooks/useTimeline'

export const BAR_H_SINGLE = '3.25rem'
export const BAR_H_STACKED = '6rem'

/**
 * Returns the height the ChapterTimelineBar will occupy.
 * Single-track: 3.25rem. Stacked (frame_narrative active): 6rem.
 * Pass null / undefined when on the dashboard — returns '0'.
 */
export function useBarHeight(worldId: string | null | undefined): string {
  const relationships = useTimelineRelationships(worldId ?? null)
  const timelines = useTimelines(worldId ?? null)
  const hasFrameNarrative = useMemo(() => {
    const tlIds = new Set(timelines.map((t) => t.id))
    return relationships.some(
      (r) => r.type === 'frame_narrative' && tlIds.has(r.sourceTimelineId) && tlIds.has(r.targetTimelineId)
    )
  }, [relationships, timelines])
  return hasFrameNarrative ? BAR_H_STACKED : BAR_H_SINGLE
}
