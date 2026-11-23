/** How a succession's line is drawn (issue #702, D-3). */
export type SuccessionRule = 'eldest' | 'byHand'

/**
 * What is inherited and by whom (issue #702, D-3): *the Heights*, from Mr
 * Earnshaw. The line is read at the cursor: the holder is the first in it born
 * and alive, the heirs those after.
 */
export interface Succession {
  id: string
  worldId: string
  title: string
  founderId: string
  rule: SuccessionRule
  /** The line after the founder, in order, for `byHand`. Kept for `eldest` too, so switching back loses nothing. */
  line: string[]
  createdAt: number
  updatedAt: number
  version?: number
}
