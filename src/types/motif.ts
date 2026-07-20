/** A recurring theme, symbol, or motif the writer tracks across the story — the
 *  colour red, mirrors, the idea of exile. Events are tagged with the motifs
 *  they carry (via WorldEvent.motifIds), so a motif's recurrence and quiet
 *  stretches are visible at a glance. Mirrors PlotThread, for symbolism rather
 *  than plot. */
export interface Motif {
  id: string
  worldId: string
  name: string
  color: string
  description: string
  createdAt: number
  updatedAt: number
}
