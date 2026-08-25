/** A plot thread / subplot the writer tracks across the story — the main quest,
 *  a romance, a political intrigue. Events are tagged with the threads they
 *  advance (via WorldEvent.threadIds), so a subplot's cadence and dormancy are
 *  visible at a glance. */
export interface PlotThread {
  id: string
  worldId: string
  name: string
  color: string
  description: string
  /**
   * The scene where this subplot lands, when the writer has said so.
   *
   * A thread that stops advancing three chapters before the end is reported as
   * *left dangling*, and the report's own advice — "resolve it or carry it into
   * a later scene" — was impossible to take: there was no way to resolve one.
   * The only way to silence it was to tag a late scene, which is a lie about a
   * subplot that genuinely lands in Ch. 40 of 117.
   *
   * So this is where it lands, not a flag that hides the warning. It is the
   * same shape as a character's `revived`, an item's *repaired* and a place's
   * *rebuilt*: the writer states what happened and the check has nothing left
   * to report, rather than reporting it and being told to be quiet.
   *
   * Absent on threads written before it existed, which is why every reader
   * coalesces it.
   */
  resolvedEventId?: string | null
  createdAt: number
  updatedAt: number
  /** Operation-journal bookkeeping (#115); absent on pre-v52 records. */
  version?: number
}
