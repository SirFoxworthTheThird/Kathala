import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { downloadLibraryBook } from './helpers/library'
import { settle } from './helpers/settle'

/**
 * The Library's *Jekyll and Hyde*, as shipped: Hyde is revealed to be Jekyll at
 * "Hyde Becomes Jekyll", and nothing says so before it.
 *
 * `characterIdentity.spec.ts` tests the feature and sets the link itself; this
 * tests the book. The book said it on page one for a long time — Hyde was
 * "Jekyll's liberated secondary identity", their relationship "Two identities
 * in one body" from the moment both had been met, and the page explaining it
 * opened three scenes early — so the boundary is checked from both sides: the
 * scene before the reveal shows none of it, the reveal shows all of it.
 */

test.describe.configure({ timeout: 300_000 })

const JEKYLL = 'jekyll-hyde-char-jekyll'
const HYDE = 'jekyll-hyde-char-hyde'
/** Chapter 9: the midnight visitor mixes the draught. One scene before. */
const BEFORE = 'jekyll-hyde-event-36'
/** Chapter 9: "Hyde Becomes Jekyll". */
const REVEAL = 'jekyll-hyde-event-37'

async function readAt(page: Page, eventId: string) {
  await page.evaluate((eid: string) => {
    const raw = localStorage.getItem('kathala-ui')
    const st = raw ? JSON.parse(raw) : { state: {}, version: 0 }
    st.state.activeEventId = eid
    if (st.state.eventByWorld) for (const k of Object.keys(st.state.eventByWorld)) st.state.eventByWorld[k] = eid
    localStorage.setItem('kathala-ui', JSON.stringify(st))
  }, eventId)
  await page.reload({ waitUntil: 'load' })
  await settle(page)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kathala-ui') ?? '{}').state?.activeEventId ?? null)).toBe(eventId)
}

async function openPage(page: Page, worldId: string, id: string) {
  await page.goto(`/#/worlds/${worldId}/characters/${id}`, { waitUntil: 'load' })
  await settle(page)
  await expect(page.getByRole('main').getByRole('heading', { level: 2 }).first()).toBeVisible({ timeout: 30_000 })
}

/** Every result label a search answers with. */
async function search(page: Page, q: string) {
  await page.getByTitle('Search (Ctrl+K)').click()
  await page.getByPlaceholder(/as far as you have read/).fill(q)
  await page.waitForTimeout(500)
  const labels = await page.locator('[data-search-result-label]').allInnerTexts()
  await page.keyboard.press('Escape')
  return labels
}

test('the Library’s Jekyll and Hyde keeps its secret until Lanyon watches it', async ({ page }) => {
  await resetDB(page)
  const worldId = await downloadLibraryBook(page, 'Strange Case of Dr Jekyll and Mr Hyde')
  await settle(page)
  // The book's own data, not the spec's: the link has to have come with it.
  expect(await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as { characters: { get: (id: string) => Promise<{ revealedAs?: unknown }> } }
    return (await db.characters.get(id)).revealedAs ?? null
  }, HYDE)).toEqual({ characterId: JEKYLL, eventId: REVEAL })
  const main = page.getByRole('main')

  // One scene before: two men, described as they are met, and nothing joining them.
  await readAt(page, BEFORE)
  await openPage(page, worldId, HYDE)
  await expect(main.getByText(/^A small, plainly dressed young man/)).toBeVisible()
  await expect(main.getByText(/secondary identity/)).toHaveCount(0)
  await expect(main.getByText(/^Revealed to be/)).toHaveCount(0)
  expect(await search(page, 'Two identities')).not.toContain('Two identities in one body')
  expect(await search(page, 'One Embodied')).not.toContain('Jekyll and Hyde Are One Embodied Person')

  // The reveal: the link, the relationship, and the page that explains the two cards.
  await readAt(page, REVEAL)
  await openPage(page, worldId, HYDE)
  await expect(main.getByText('Revealed to be Dr Henry Jekyll', { exact: true })).toBeVisible()
  await openPage(page, worldId, JEKYLL)
  await expect(main.getByText('Also Edward Hyde', { exact: true })).toBeVisible()
  expect(await search(page, 'Two identities')).toContain('Two identities in one body')
  expect(await search(page, 'One Embodied')).toContain('Jekyll and Hyde Are One Embodied Person')
})
