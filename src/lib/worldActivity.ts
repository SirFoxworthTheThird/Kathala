/**
 * What date a world card should show, and what to call it.
 *
 * The card said *Created 25 Aug 2026* — accurate, and not the question a
 * returning writer with several worlds is asking, which is *which of these did
 * I last touch*. A blind run filed it as the more useful line.
 *
 * `world.updatedAt` is not that line, and reaching for it would have been a
 * more confident lie than the label it replaced: `updateWorld` is the only
 * thing that moves it, so it tracks renaming the world or editing its calendar
 * and not the two hundred scenes written since. The operation journal *is* the
 * record of "something in this world changed", and it is indexed by
 * `[worldId+seq]`, so the last entry costs one seek.
 *
 * Two things it cannot answer, both handled by saying so rather than guessing:
 *
 * - **A journal can be empty and the world still worked on.** Importing a
 *   world, generating one from AI or importing a manuscript all call
 *   `markJournalDiscontinuity`, which resets the journal rather than leaving
 *   one that claims to be complete and isn't. Records predating v52 have none
 *   either.
 * - **Not every edit is journalled.** The world's own record isn't on the
 *   operation seam, so a rename shows up in `updatedAt` and nowhere else.
 *
 * So the answer is the later of the two, and the *label* changes with it: a
 * world nothing has happened to since it was made says "Created", and one that
 * has been worked in says "Edited". The card never has to be read as a claim it
 * cannot support — which was the original complaint about this line, when it
 * was a bare `4/1/2026` that could have been either.
 */

export interface WorldActivity {
  /** The word in front of the date. */
  label: 'Created' | 'Edited'
  at: number
}

export function worldActivity(
  world: { createdAt: number; updatedAt: number },
  lastOperationAt: number | null,
): WorldActivity {
  const touched = Math.max(world.updatedAt, lastOperationAt ?? 0)
  return touched > world.createdAt
    ? { label: 'Edited', at: touched }
    : { label: 'Created', at: world.createdAt }
}
