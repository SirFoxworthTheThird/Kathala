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
