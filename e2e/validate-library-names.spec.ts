import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { downloadLibraryBook } from './helpers/library'
import { settle } from './helpers/settle'

/**
 * The Library's books, named as they name their people (SirFoxworthTheThird/
 * Kathala-Library, scripts/names/).
 *
 * Eighteen books now carry names over the book, aliases learned at a scene, or
 * a character revealed to be another. `characterNames.spec.ts` and
 * `characterIdentity.spec.ts` test the app with data they set themselves; this
 * reads three of the shipped books, each at both sides of the scene that
 * names someone, so a book that loses its schedule — or an app that stops
 * reading it — shows here:
 *
 * - The Invisible Man: the stranger, then the Invisible Man, then Griffin.
 * - The Phantom of the Opera: the Opera Ghost is his own page until the
 *   house on the lake, where he is revealed to be Erik.
 * - The Woman in White: Laura Fairlie becomes Lady Glyde at her wedding.
 */

test.describe.configure({ timeout: 300_000 })

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

/** The name on a character's page at the reader's place. */
async function nameOn(page: Page, worldId: string, characterId: string) {
  await page.goto(`/#/worlds/${worldId}/characters/${characterId}`, { waitUntil: 'load' })
  await settle(page)
  const heading = page.getByRole('main').getByRole('heading', { level: 2 }).first()
  await expect(heading).toBeVisible({ timeout: 30_000 })
  return (await heading.innerText()).trim()
}

test('the Invisible Man is the stranger, then the Invisible Man, then Griffin', async ({ page }) => {
  await resetDB(page)
  const worldId = await downloadLibraryBook(page, 'The Invisible Man')
  const griffin = 'invisible-man-character-griffin'

  await readAt(page, 'invisible-man-event-laboratory')
  expect(await nameOn(page, worldId, griffin)).toBe('The Stranger')
  await expect(page.getByRole('main').getByText(/Griffin/)).toHaveCount(0)

  await readAt(page, 'invisible-man-event-unveiling')
  expect(await nameOn(page, worldId, griffin)).toBe('The Invisible Man')

  await readAt(page, 'invisible-man-event-griffin-arrives')
  expect(await nameOn(page, worldId, griffin)).toBe('Griffin')
  await expect(page.getByRole('main').getByText(/^Also known as .*The Invisible Man/)).toBeVisible()
})

test('the Opera Ghost is his own page until the house on the lake, and Erik from it', async ({ page }) => {
  await resetDB(page)
  const worldId = await downloadLibraryBook(page, 'The Phantom of the Opera')
  const ghost = 'phantom-char-opera-ghost'
  const main = page.getByRole('main')

  await readAt(page, 'phantom-event-13-1')
  expect(await nameOn(page, worldId, ghost)).toBe('The Opera Ghost')
  await expect(main.getByText(/^Revealed to be/)).toHaveCount(0)

  // From the reveal a reader is shown one person (Part 2b): the Ghost's page is Erik's, which says so.
  await readAt(page, 'phantom-event-13-2')
  expect(await nameOn(page, worldId, ghost)).toBe('Erik')
  await expect(page).toHaveURL(/\/characters\/phantom-char-erik/)
  await expect(main.getByText('Also The Opera Ghost', { exact: true })).toBeVisible()
})

test('Laura Fairlie is Lady Glyde from her wedding day', async ({ page }) => {
  await resetDB(page)
  const worldId = await downloadLibraryBook(page, 'The Woman in White')
  const laura = 'woman-in-white-character-laura'

  await readAt(page, 'woman-in-white-event-marian-1')
  expect(await nameOn(page, worldId, laura)).toBe('Laura Fairlie')
  await expect(page.getByRole('main').getByText(/Lady Glyde/)).toHaveCount(0)

  await readAt(page, 'woman-in-white-event-marian-2')
  expect(await nameOn(page, worldId, laura)).toBe('Lady Glyde')
})
