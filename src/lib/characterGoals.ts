import type { CharacterGoal, CharacterGoalType, Chapter, WorldEvent } from '@/types'

/** Display metadata per goal type — one place so the tab, Arc View, and the
 *  Writer's Brief label and colour goals identically. */
export const GOAL_TYPE_CONFIG: Record<CharacterGoalType, { label: string; color: string; hint: string }> = {
  want: { label: 'Want', color: '#60a5fa', hint: 'The conscious objective they are chasing.' },
  need: { label: 'Need', color: '#34d399', hint: 'What they actually require — often at odds with the want.' },
  fear: { label: 'Fear', color: '#f87171', hint: 'What they are avoiding.' },
  flaw: { label: 'Flaw', color: '#fbbf24', hint: 'The trait that keeps getting in their way.' },
}

/** The goal types PlotWeave knows, in the order it presents them. */
export const GOAL_TYPES: CharacterGoalType[] = ['want', 'need', 'fear', 'flaw']

/**
 * The display config for a goal type, for any value at all.
 *
 * Same reasoning as `eventStatusConfig`: a goal's `type` is typed but never
 * validated on import, and the shipped Dracula example carried "escape" until
 * it was corrected — which made `GOAL_TYPE_CONFIG[goal.type].label` throw and
 * took the whole Goals tab down with it. Any `.pwk` can still do that.
 *
 * An unrecognised type keeps its own name rather than being relabelled, so the
 * writer can see what their file actually says and fix it.
 */
export function goalTypeConfig(type: unknown): { label: string; color: string; hint: string } {
  // Checked against the list rather than with `in`, which is true for
  // inherited keys like `toString` and would return a function.
  if (typeof type === 'string' && (GOAL_TYPES as readonly string[]).includes(type)) {
    return GOAL_TYPE_CONFIG[type as CharacterGoalType]
  }
  const label = typeof type === 'string' && type.trim() ? type.trim() : 'Goal'
  return { label, color: '#94a3b8', hint: 'This goal has a type PlotWeave does not recognise.' }
}

/**
 * Narrative position of an event: chapter number first, then order within the
 * chapter. Mirrors the ordering used elsewhere (the continuity checker, the
 * timeline bar) so "before" and "after" mean the same thing everywhere.
 */
export function eventPositions(events: WorldEvent[], chapters: Chapter[]): Map<string, number> {
  const chapterNumberById = new Map(chapters.map((c) => [c.id, c.number]))
  const positions = new Map<string, number>()
  for (const ev of events) {
    positions.set(ev.id, (chapterNumberById.get(ev.chapterId) ?? 0) * 10_000 + ev.sortOrder)
  }
  return positions
}

/**
 * Whether a goal holds at the given event.
 *
 * A goal with no start is true from the beginning; with no end it runs to the
 * end of the story. The end event is the last one where it still holds, so a
 * goal that starts and ends at the same event is active exactly there.
 *
 * With no active event (the "All chapters" cursor) every goal counts as active
 * — the reader is looking at the character as a whole, not a moment.
 */
export function isGoalActiveAt(
  goal: Pick<CharacterGoal, 'startEventId' | 'endEventId'>,
  activeEventId: string | null,
  positions: Map<string, number>,
): boolean {
  if (!activeEventId) return true
  const at = positions.get(activeEventId)
  if (at === undefined) return true

  if (goal.startEventId) {
    const start = positions.get(goal.startEventId)
    if (start !== undefined && at < start) return false
  }
  if (goal.endEventId) {
    const end = positions.get(goal.endEventId)
    if (end !== undefined && at > end) return false
  }
  return true
}

/** The goals a character holds at the cursor, in a stable want → need → fear →
 *  flaw order so the same character always reads the same way. */
export function activeGoalsAt(
  goals: CharacterGoal[],
  characterId: string,
  activeEventId: string | null,
  positions: Map<string, number>,
): CharacterGoal[] {
  const order = GOAL_TYPES
  return goals
    .filter((g) => g.characterId === characterId && isGoalActiveAt(g, activeEventId, positions))
    .sort((a, b) => {
      const byType = order.indexOf(a.type) - order.indexOf(b.type)
      return byType !== 0 ? byType : a.createdAt - b.createdAt
    })
}

/** Compact one-line summary for tooltips and dense rows, e.g.
 *  "Want: reclaim the throne · Fear: becoming his father". */
export function summariseGoals(goals: CharacterGoal[]): string {
  return goals.map((g) => `${goalTypeConfig(g.type).label}: ${g.text}`).join(' · ')
}
