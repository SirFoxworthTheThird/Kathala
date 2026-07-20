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

/** A per-day rollup of net manuscript words written in a world. One row per
 *  (world × local calendar day). Feeds the writing-progress streak and pacing. */
export interface WritingLog {
  id: string
  worldId: string
  /** Local calendar day this rollup covers, as `YYYY-MM-DD`. */
  date: string
  /** Net words written that day (additions minus deletions across all scenes). */
  words: number
  createdAt: number
  updatedAt: number
}
