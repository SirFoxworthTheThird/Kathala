/** The actual prose for a scene, attached to the event it dramatizes.
 *  One record per event. The structured story data (POV, knowledge, tension,
 *  beats) is checked against this text, and its length feeds the pacing curve. */
export interface SceneText {
  id: string
  worldId: string
  /** The event whose scene this prose belongs to. One SceneText per event. */
  eventId: string
  /** The manuscript prose for this scene (plain text / lightweight markdown). */
  text: string
  /** Cached word count, recomputed on every save so reads stay cheap. */
  wordCount: number
  createdAt: number
  updatedAt: number
}

/** A prior version of a scene's prose, kept so a writer can view, diff, and
 *  restore an earlier draft. Captured (time-coalesced) whenever a scene is saved
 *  with changed text; pruned to the most recent N per scene. */
export interface SceneRevision {
  id: string
  worldId: string
  /** The event whose scene this is a past version of. */
  eventId: string
  /** The prose as it was at `createdAt`. */
  text: string
  wordCount: number
  /** When this version was superseded (i.e. captured). */
  createdAt: number
  /**
   * Kept as the version before a run of Find & replace changes, and when the
   * run's last change was made: the changes after the first, until a pause,
   * are the same run and keep no version of their own (round-trip-plan-3.md,
   * T13, S6). Absent for every other version.
   */
  run?: 'replace'
  runUntil?: number
}

/** A per-day rollup of net manuscript words written in a world. One row per
 *  (world × local calendar day). Feeds the writing-progress streak and pacing. */
export interface WritingLog {
  id: string
  worldId: string
  /** Local calendar day this rollup covers, as `YYYY-MM-DD`. */
  date: string
  /** Net words written that day (additions minus deletions across all scenes). */
  words: number
  /**
   * Words added and words cut that day, kept apart so a day of revision is a
   * day of writing (issue #706, D-2). Absent on a day logged before v71, which
   * is read by its net, as it was.
   */
  added?: number
  cut?: number
  createdAt: number
  updatedAt: number
}

/**
 * A writing sprint (issue #706): a set time, and the words added and cut in
 * it. A record rather than a timer, so it outlives the page: the countdown is
 * worked out from `startedAt`, `plannedMs` and the pauses (sprints-plan.md, D-6).
 */
export interface WritingSprint {
  id: string
  worldId: string
  startedAt: number
  /** The length chosen. */
  plannedMs: number
  /** Time paused so far, not counting a pause still going on. */
  pausedMs: number
  /** When the pause going on now began, or null when running. */
  pausedAt: number | null
  /** When it ended, or null while it runs. A sprint whose page closed ends at its planned end. */
  endedAt: number | null
  /** How it ended: its time ran out, the writer stopped it, or the page closed before the end. */
  ended?: 'done' | 'stopped' | 'closed'
  wordsAdded: number
  wordsCut: number
  /** The scenes saved during it, in the order first saved. */
  eventIds: string[]
  createdAt: number
  updatedAt: number
}
