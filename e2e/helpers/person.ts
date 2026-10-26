import type { Page } from '@playwright/test'

/** One person's record as the screens read it: whole at its scene. */
export interface WholeRecord {
  id: string
  characterId: string
  eventId: string
  isAlive: boolean
  revived?: boolean
  currentLocationMarkerId: string | null
  currentMapLayerId: string | null
  travelModeId: string | null
  statusNotes: string
  inventoryNotes: string
}

/**
 * Every person's record read whole at its own scene (`__pwperson`, in
 * `src/db/hooks/useSnapshots.ts`). A stored record says only what its scene
 * said (Part B2): read raw, a missing `isAlive` is not "dead" and a missing
 * place is not "nowhere". Who holds what is custody's (`./custody`).
 */
export function wholeRecords(page: Page): Promise<WholeRecord[]> {
  return page.evaluate(() => {
    const seam = (window as { __pwperson?: { records: () => Promise<WholeRecord[]> } }).__pwperson
    if (!seam) throw new Error('No __pwperson: the app was not built for e2e')
    return seam.records()
  })
}
