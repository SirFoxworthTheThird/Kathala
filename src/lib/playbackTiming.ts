import type { PlaybackSpeed } from '@/store'

/** Words per minute the user is expected to read at each playback speed */
const WPM: Record<PlaybackSpeed, number> = { slow: 100, normal: 180, fast: 280 }

/**
 * Absolute minimum hold time (ms) per speed.
 * Covers the map animation duration plus a brief orientation pause,
 * so very short chapters aren't rushed either.
 */
export const MIN_HOLD_MS: Record<PlaybackSpeed, number> = { slow: 8000, normal: 5000, fast: 3000 }

/** Extra milliseconds kept after reading finishes — covers the fade-out transition */
const POST_READ_BUFFER_MS = 2000

/**
 * Compute how long a chapter should be held on screen during playback.
 *
 * Pass the concatenated visible text (title + synopsis + any notes shown in the
 * overlay). The result is at least MIN_HOLD_MS[speed] so chapters with very
 * little text still get enough time for the map animation to finish.
 */
export function readingHoldMs(text: string, speed: PlaybackSpeed): number {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0).length
  const readMs = Math.ceil((words / WPM[speed]) * 60_000)
  return Math.max(MIN_HOLD_MS[speed], readMs + POST_READ_BUFFER_MS)
}
