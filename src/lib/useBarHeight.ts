import { useMemo } from 'react'
import { useTimelineRelationships } from '@/db/hooks/useTimelineRelationships'
import { useTimelines } from '@/db/hooks/useTimeline'
import { useAppStore } from '@/store'

export const BAR_H_SINGLE = '4rem'
export const BAR_H_STACKED = '6.25rem'
/**
 * Rolled up (MT-3). The bar is fixed chrome on every screen in a world — 64px
 * for one track, 100px for a frame narrative's two — and the map and the
 * manuscript both want that height back. Enough to keep where you are legible
 * and to get the bar open again.
 */
export const BAR_H_COLLAPSED = '1.75rem'

/**
 * Returns the height the ChapterTimelineBar will occupy.
 * Stacked (6.25rem) is reserved for frame narratives, whose two synced tracks
 * need the room. Every other world — single timeline, or a multi-timeline world
 * shown one-at-a-time or merged — uses the single 4rem bar.
 * Pass null / undefined when on the dashboard — returns '0'.
 */
export function useBarHeight(worldId: string | null | undefined): string {
  const relationships = useTimelineRelationships(worldId ?? null)
  const timelines = useTimelines(worldId ?? null)
  const collapsed = useAppStore((s) => s.barCollapsed)
  const hasFrameNarrative = useMemo(() => {
    const tlIds = new Set(timelines.map((t) => t.id))
    return relationships.some(
      (r) => r.type === 'frame_narrative' && tlIds.has(r.sourceTimelineId) && tlIds.has(r.targetTimelineId)
    )
  }, [relationships, timelines])
  if (!worldId) return '0'
  if (collapsed) return BAR_H_COLLAPSED
  return hasFrameNarrative ? BAR_H_STACKED : BAR_H_SINGLE
}
