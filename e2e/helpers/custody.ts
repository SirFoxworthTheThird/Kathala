import type { Page } from '@playwright/test'

/**
 * What each person holds at scene `eventId`, as the app reads item custody
 * (`__pwcustody`, in `src/db/hooks/useCustody.ts`): only people holding
 * something are listed. A record's own `inventoryItemIds` is a copy of the one
 * before it, and is not who holds what (Part B1).
 */
export function heldAt(page: Page, eventId: string): Promise<Record<string, string[]>> {
  return page.evaluate((id) => {
    const seam = (window as { __pwcustody?: { heldAt: (eventId: string) => Promise<Record<string, string[]>> } }).__pwcustody
    if (!seam) throw new Error('No __pwcustody: the app was not built for e2e')
    return seam.heldAt(id)
  }, eventId)
}

/** Who holds `itemId` at each scene, by title, in book order. */
export async function holdersByScene(page: Page, itemId: string): Promise<Record<string, string[]>> {
  const scenes = await page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, unknown>>> }>
    const chapters = new Map((await db.chapters.toArray()).map((c) => [c.id as string, c.number as number]))
    const key = (e: Record<string, unknown>) => (chapters.get(e.chapterId as string) ?? 0) + (e.sortOrder as number) / 1_000_000
    return (await db.events.toArray()).sort((a, b) => key(a) - key(b)).map((e) => [e.id as string, e.title as string] as const)
  })
  const out: Record<string, string[]> = {}
  for (const [id, title] of scenes) {
    const held = await heldAt(page, id)
    out[title] = Object.keys(held).filter((who) => held[who].includes(itemId)).sort()
  }
  return out
}
