import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useActiveWorldId, useActiveEventId, useAppStore, type PlaybackSpeed } from '@/store'
import { readingHoldMs } from '@/lib/playbackTiming'
import type { WorldEvent, TimelineRelationship } from '@/types'

export const SPEED_NEXT: Record<PlaybackSpeed, PlaybackSpeed> = { slow: 'normal', normal: 'fast', fast: 'slow' }
export const SPEED_LABEL: Record<PlaybackSpeed, string> = { slow: '0.5×', normal: '1×', fast: '2×' }

/** Manages the playback timer and exposes play/pause/stop/speed handlers.
 *  Call this once at the top of ChapterTimelineBar so the effect lifecycle is
 *  tied to the bar's mount rather than each render branch. */
export function useTimelinePlayback(
  orderedEvents: WorldEvent[],
  frameRel: TimelineRelationship | null,
  activeDepthTimelineId: string | null,
  innerTimelineId: string | null,
) {
  const worldId = useActiveWorldId()
  const activeEventId = useActiveEventId()
  const {
    isPlayingStory, setIsPlayingStory,
    playbackSpeed, setPlaybackSpeed,
    isAnimating,
    setActiveEventId,
    setActiveOuterEventId,
  } = useAppStore()
  const navigate = useNavigate()
  const location = useLocation()

  // Advance to the next event on a timer while playing
  useEffect(() => {
    if (!isPlayingStory || !orderedEvents.length || isAnimating) return
    if (!activeEventId) { setActiveEventId(orderedEvents[0].id); return }
    const idx = orderedEvents.findIndex((e) => e.id === activeEventId)
    if (idx === -1) return
    const ev = orderedEvents[idx]
    const holdMs = readingHoldMs([ev.title, ev.description ?? ''].join(' '), playbackSpeed)
    const t = setTimeout(() => {
      if (idx >= orderedEvents.length - 1) { setIsPlayingStory(false); return }
      const nextEv = orderedEvents[idx + 1]
      setActiveEventId(nextEv.id)
      if (frameRel && activeDepthTimelineId === innerTimelineId) {
        const sp = frameRel.syncPoints.find((s) => s.innerEventId === nextEv.id)
        if (sp) setActiveOuterEventId(sp.outerEventId)
      }
    }, holdMs)
    return () => clearTimeout(t)
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    isPlayingStory, isAnimating, activeEventId, orderedEvents, playbackSpeed,
    setActiveEventId, setIsPlayingStory, frameRel, activeDepthTimelineId, innerTimelineId, setActiveOuterEventId,
  ])

  function handlePlayPause() {
    if (isPlayingStory) {
      setIsPlayingStory(false)
    } else {
      if (!activeEventId || orderedEvents.findIndex((e) => e.id === activeEventId) >= orderedEvents.length - 1) {
        setActiveEventId(orderedEvents[0]?.id ?? null)
      }
      setIsPlayingStory(true)
      if (worldId && !location.pathname.includes('/maps')) navigate(`/worlds/${worldId}/maps`)
    }
  }

  function handleStop() {
    setIsPlayingStory(false)
    setActiveEventId(null)
  }

  function cycleSpeed() {
    setPlaybackSpeed(SPEED_NEXT[playbackSpeed])
  }

  return { handlePlayPause, handleStop, cycleSpeed, isPlayingStory, playbackSpeed }
}
