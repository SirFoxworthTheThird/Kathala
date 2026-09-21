import { useEffect } from 'react'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { useActiveEventId, useAppStore, type PlaybackSpeed } from '@/store'
import { readingHoldMs } from '@/lib/playbackTiming'
import { outerEventAt } from '@/lib/syncPoints'
import type { WorldEvent, TimelineRelationship } from '@/types'

export const SPEED_NEXT: Record<PlaybackSpeed, PlaybackSpeed> = { slow: 'normal', normal: 'fast', fast: 'slow' }
export const SPEED_LABEL: Record<PlaybackSpeed, string> = { slow: '0.5×', normal: '1×', fast: '2×' }

/** Keep map playback on the scene's own location, matching a scrubber click. */
function activatePlaybackEvent(event: WorldEvent, setActiveEventId: (id: string) => void) {
  setActiveEventId(event.id)
  if (event.locationMarkerId) {
    window.dispatchEvent(new CustomEvent('wb:map:focusMarker', { detail: { markerId: event.locationMarkerId } }))
  }
}

/** Manages the playback timer and exposes play/pause/stop/speed handlers.
 *  Call this once at the top of ChapterTimelineBar so the effect lifecycle is
 *  tied to the bar's mount rather than each render branch. */
export function useTimelinePlayback(
  orderedEvents: WorldEvent[],
  frameRel: TimelineRelationship | null,
  activeDepthTimelineId: string | null,
  innerTimelineId: string | null,
) {
  const activeEventId = useActiveEventId()
  const {
    isPlayingStory, setIsPlayingStory,
    playbackSpeed, setPlaybackSpeed,
    isAnimating,
    setActiveEventId,
    setActiveOuterEventId,
  } = useAppStore()
  const gate = useGate()

  // Advance to the next event on a timer while playing
  useEffect(() => {
    if (!isPlayingStory || !orderedEvents.length || isAnimating) return
    if (!activeEventId) { activatePlaybackEvent(orderedEvents[0], setActiveEventId); return }
    const idx = orderedEvents.findIndex((e) => e.id === activeEventId)
    if (idx === -1) return
    const ev = orderedEvents[idx]
    const holdMs = readingHoldMs([ev.title, ev.description ?? ''].join(' '), playbackSpeed)
    const t = setTimeout(() => {
      if (idx >= orderedEvents.length - 1) { setIsPlayingStory(false); return }
      // The sync used to be applied here, so it only ever fired when the timer
      // moved the cursor (MT-6). It follows the cursor now — see the effect
      // below — which covers this move and every scrub as one rule.
      activatePlaybackEvent(orderedEvents[idx + 1], setActiveEventId)
    }, holdMs)
    return () => clearTimeout(t)
  }, [
    isPlayingStory, isAnimating, activeEventId, orderedEvents, playbackSpeed,
    setActiveEventId, setIsPlayingStory,
  ])

  /*
    MT-6: which moment of the frame story is in force, kept in step with the
    cursor however the cursor got there — the timer above, a click on the
    scrubber, the previous/next arrows, or the search palette. It used to be
    applied only by the timer, so a writer who paired nine moments and scrubbed
    between them saw nothing happen at all.

    Only while the inner track is active: the outer cursor exists to draw the
    frame's cast as ghost pins beside the inner story, which is a thing you want
    while you are in the tale.
  */
  useEffect(() => {
    if (!frameRel || activeDepthTimelineId !== innerTimelineId) return
    setActiveOuterEventId(outerEventAt(
      orderedEvents.map((e) => e.id),
      frameRel.syncPoints,
      activeEventId,
    ))
  }, [
    frameRel, activeDepthTimelineId, innerTimelineId,
    orderedEvents, activeEventId, setActiveOuterEventId,
  ])

  function handlePlayPause() {
    if (isPlayingStory) {
      setIsPlayingStory(false)
    } else {
      if (!activeEventId || orderedEvents.findIndex((e) => e.id === activeEventId) >= orderedEvents.length - 1) {
        const first = orderedEvents[0]
        if (first) activatePlaybackEvent(first, setActiveEventId)
      }
      setIsPlayingStory(true)
      // The jump to the map that used to be here is gone with the reason for
      // it: the play button only exists on the map now, so by the time it can
      // be pressed you are already there.
    }
  }

  function handleStop() {
    setIsPlayingStory(false)
    /*
      Clearing the cursor is the writer's reset — back to "all chapters", which
      is where a viewfinder belongs when you put it down. To a reader that same
      null is the full-reveal state, and it arrived from a nine-pixel square
      with no confirmation: the fault the chapter rows had, in a smaller target.

      So stopping leaves a reader's place where playback carried it, which is
      also the truthful answer — they watched those scenes go by.
    */
    if (!gate.active) setActiveEventId(null)
  }

  function cycleSpeed() {
    setPlaybackSpeed(SPEED_NEXT[playbackSpeed])
  }

  return { handlePlayPause, handleStop, cycleSpeed, isPlayingStory, playbackSpeed }
}
