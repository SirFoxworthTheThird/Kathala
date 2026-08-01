/** The four classic axes of a character's inner life.
 *  - want:  the conscious, external objective they're chasing.
 *  - need:  the thing they actually require to be whole (often at odds with the want).
 *  - fear:  what they're avoiding.
 *  - flaw:  the trait that keeps getting in their way. */
export type CharacterGoalType = 'want' | 'need' | 'fear' | 'flaw'

export const CHARACTER_GOAL_TYPES: readonly CharacterGoalType[] = ['want', 'need', 'fear', 'flaw']

/** A character's inner-life entry, optionally scoped to a stretch of the story:
 *  a want they pick up in chapter 3 and abandon in chapter 9, a fear they carry
 *  throughout. Complements the external state kept in CharacterSnapshot. */
export interface CharacterGoal {
  id: string
  worldId: string
  characterId: string
  type: CharacterGoalType
  /** The goal itself, in the writer's words. */
  text: string
  /** Event this becomes true. null = true from the start of the story. */
  startEventId: string | null
  /** Event after which it no longer holds. null = still active at the end. */
  endEventId: string | null
  createdAt: number
  updatedAt: number
  /** Operation-journal bookkeeping (#115); absent on pre-v52 records. */
  version?: number
}
