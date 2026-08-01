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
  createdAt: number
  updatedAt: number
  /** Operation-journal bookkeeping (#115); absent on pre-v52 records. */
  version?: number
}
