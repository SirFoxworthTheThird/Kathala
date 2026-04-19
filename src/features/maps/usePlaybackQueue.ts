import { useState, useEffect, type MutableRefObject } from 'react'
import type { CharacterSnapshot, LocationMarker } from '@/types'
import type { PinAnimation, MovementLine } from './LeafletMapCanvas'
import type { PlaybackStep } from './mapUtils'
import { buildSequentialQueue, PIN_TRAVEL_MS } from './mapUtils'
import type { MapRoute } from '@/types'
import type { PlaybackSpeed } from '@/store'
import { useEventMovements } from '@/db/hooks/useMovements'

interface UsePlaybackQueueParams {
  worldId: string
  layerId: string
  isPlayingStory: boolean
  playbackSpeed: PlaybackSpeed
  activeEventId: string | null
  prevSnapshots: CharacterSnapshot[]
  snapshots: CharacterSnapshot[]
  allMarkers: LocationMarker[]
  mapRoutes: MapRoute[]
  pinAnimationKeyRef: MutableRefObject<number>
  setActiveMapLayerId: (id: string) => void
}

export function usePlaybackQueue({
  worldId,
  layerId,
  isPlayingStory,
  playbackSpeed,
  activeEventId,
  prevSnapshots,
  snapshots,
  allMarkers,
  mapRoutes,
  pinAnimationKeyRef,
  setActiveMapLayerId,
}: UsePlaybackQueueParams) {
  const movements = useEventMovements(worldId, activeEventId)
  const [playbackQueue, setPlaybackQueue] = useState<PlaybackStep[]>([])
  const [playbackStepIdx, setPlaybackStepIdx] = useState(0)

  // Rebuild queue whenever the active event changes during playback
  useEffect(() => {
    if (!isPlayingStory || !activeEventId) {
      setPlaybackQueue([])
      setPlaybackStepIdx(0)
      return
    }
    if (prevSnapshots.length === 0 && snapshots.length === 0) return

    const queue = buildSequentialQueue(
      prevSnapshots, snapshots, allMarkers, movements,
      PIN_TRAVEL_MS[playbackSpeed], pinAnimationKeyRef, mapRoutes,
    )
    setPlaybackQueue(queue)
    setPlaybackStepIdx(0)

    // Navigate to the first map in the queue if different from current
    if (queue.length > 0 && queue[0].mapLayerId !== layerId) {
      setActiveMapLayerId(queue[0].mapLayerId)
    }
  }, [activeEventId, isPlayingStory]) // eslint-disable-line react-hooks/exhaustive-deps

  // When step index advances, navigate to that step's map layer
  useEffect(() => {
    if (playbackQueue.length === 0) return
    const step = playbackQueue[playbackStepIdx]
    if (step && step.mapLayerId !== layerId) {
      setActiveMapLayerId(step.mapLayerId)
    }
  }, [playbackStepIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentStep = playbackQueue[playbackStepIdx] ?? null
  const pinAnimation: PinAnimation | null =
    currentStep && currentStep.mapLayerId === layerId ? currentStep.pinAnimation : null

  function handlePlaybackAnimationEnd() {
    setPlaybackStepIdx((i) => i + 1)
  }

  return { pinAnimation, handlePlaybackAnimationEnd }
}

export type { PlaybackStep, MovementLine }
