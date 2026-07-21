/**
 * Pure accounting for the focus-mode writing session: how many words the current
 * draft has, how many were added since the session began, and progress toward a
 * daily goal. Kept separate from the DOM so it's easy to test.
 */

export interface FocusStats {
  /** Word count of the current draft. */
  current: number
  /** Net change since the session started (negative if trimming). */
  sessionDelta: number
  /** Words added this session, never negative (for the goal ring). */
  added: number
}

/** Net words written this session: current minus the starting count. */
export function sessionWordDelta(startWords: number, currentWords: number): number {
  return currentWords - startWords
}

/** Session accounting for a starting and current word count. */
export function focusStats(startWords: number, currentWords: number): FocusStats {
  const sessionDelta = sessionWordDelta(startWords, currentWords)
  return { current: currentWords, sessionDelta, added: Math.max(0, sessionDelta) }
}

/** Progress (0–100) of words added toward a daily session goal (0 goal = 0%). */
export function sessionGoalPercent(added: number, goal: number): number {
  if (goal <= 0) return 0
  return Math.min(100, Math.round((added / goal) * 100))
}
