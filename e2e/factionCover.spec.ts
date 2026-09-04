import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'
import { IMAGE_URL } from './helpers/imageUrl'

/**
 * A picture of a faction.
 *
 * `Faction.coverImageId` had been on the record since factions landed, and
 * nothing in the app ever wrote it or drew it — the create path set it to null
 * and that was the whole of its life. Two of the shipped Library worlds carry
 * one regardless, because the generator could set what the app could not, so
 * the field was not merely unused: it was downloaded, stored, and invisible.
 *
 * This covers attaching one, seeing it on the panel and on the roster card,
 * taking it away, and what a reader gets instead of the controls.
 */

const IMAGE = IMAGE_URL

/** The faction roster grid, away from the detail panel that also draws a cover. */
const card = (page: Page) => page.getByRole('button').filter({ has: page.locator('[data-faction-name]') }).first()

test.describe('A faction cover', () => {
  test.describe.configure({ timeout: 240_000 })

  test.beforeEach(async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Heraldry')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

    await page.goto(`/#/worlds/${worldId}/factions`, { waitUntil: 'load' })
    await settleNav(page)
    await page.getByRole('button', { name: 'New Faction' }).click()
    await page.getByPlaceholder('Faction name…').fill('The Silver Company')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    // Creating selects it, so the panel is already open.
    await expect(page.getByRole('button', { name: 'Close faction panel' })).toBeVisible()
  })

  /** Attach a cover through the link-by-URL popover. */
  async function linkCover(page: Page) {
    await page.getByRole('button', { name: 'Link faction cover image by URL' }).click()
    await page.getByPlaceholder('https://…/image.png').fill(IMAGE)
    await page.getByRole('button', { name: 'Add linked image' }).click()
    await expect(page.locator(`img[src="${IMAGE}"]`).first()).toBeVisible()
  }

  test('offers a labelled way in when there is none, and takes one', async ({ page }) => {
    // Empty and filled are drawn differently: a labelled invitation while there
    // is nothing, corner controls once there is. Both halves are asserted, so
    // neither state can pass by the panel failing to draw at all.
    await expect(page.getByText('No cover image for this faction yet')).toBeVisible()
    await expect(page.getByText('Upload', { exact: true })).toBeVisible()
    const link = page.getByRole('button', { name: 'Link faction cover image by URL' })
    await expect(link).toHaveText(/Link/)
    await expect(page.locator(`img[src="${IMAGE}"]`)).toHaveCount(0)

    await linkCover(page)

    await expect(page.getByText('No cover image for this faction yet')).toHaveCount(0)
    await expect(link).not.toHaveText(/Link/)
  })

  test('reaches the roster card, and the colour dot steps aside for it', async ({ page }) => {
    // The dot is the faction's identity mark on the card, and it is what is
    // there before a cover exists.
    await page.getByRole('button', { name: 'Close faction panel' }).click()
    await expect(card(page).locator('img')).toHaveCount(0)

    await page.getByText('The Silver Company').first().click()
    await linkCover(page)
    await page.getByRole('button', { name: 'Close faction panel' }).click()

    // With the panel shut, the only cover left on screen is the card's — so
    // this cannot be satisfied by the panel it was set from.
    await expect(card(page).locator(`img[src="${IMAGE}"]`)).toBeVisible()
  })

  test('survives closing and reopening the faction', async ({ page }) => {
    await linkCover(page)
    await page.getByRole('button', { name: 'Close faction panel' }).click()
    await expect(page.getByRole('button', { name: 'Close faction panel' })).toHaveCount(0)

    await page.getByText('The Silver Company').first().click()
    await expect(page.getByRole('button', { name: 'Close faction panel' })).toBeVisible()
    // Read back from the record rather than from panel state.
    await expect(page.getByRole('button', { name: 'Remove faction cover image' })).toBeVisible()
  })

  test('can be taken away again', async ({ page }) => {
    await linkCover(page)
    const remove = page.getByRole('button', { name: 'Remove faction cover image' })
    await expect(remove).toBeVisible()

    await remove.click()

    await expect(page.locator(`img[src="${IMAGE}"]`)).toHaveCount(0)
    // The control goes with the picture rather than lingering as a button that
    // does nothing, and the empty invitation comes back.
    await expect(remove).toHaveCount(0)
    await expect(page.getByText('No cover image for this faction yet')).toBeVisible()
  })

  test('a reader gets the picture and none of the controls', async ({ page }) => {
    await linkCover(page)
    const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

    // A second faction, deliberately without a cover. It is the presence half
    // of the last pair below: while writing it shows the empty invitation, so
    // a reader not seeing it means something.
    await page.getByRole('button', { name: 'Close faction panel' }).click()
    await page.getByRole('button', { name: 'New Faction' }).click()
    await page.getByPlaceholder('Faction name…').fill('The Grey Order')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByText('No cover image for this faction yet')).toBeVisible()

    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Turn on reading mode' }).click()
    await expect(page.getByRole('button', { name: 'Turn off reading mode' })).toBeVisible()

    await page.goto(`/#/worlds/${worldId}/factions`, { waitUntil: 'load' })
    await settleNav(page)
    await page.getByText('The Silver Company').first().click()
    await expect(page.getByRole('button', { name: 'Close faction panel' })).toBeVisible()

    // The cover is shown — it is part of the book, not part of the workbench.
    await expect(page.locator(`img[src="${IMAGE}"]`).first()).toBeVisible()
    // Nothing that would change it is offered.
    await expect(page.getByRole('button', { name: 'Remove faction cover image' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Link faction cover image by URL' })).toHaveCount(0)
    await expect(page.getByText('Upload', { exact: true })).toHaveCount(0)

    // The faction with no cover: its panel opens, and where the writer got an
    // empty box inviting them to fill it, a reader gets nothing at all.
    await page.getByRole('button', { name: 'Close faction panel' }).click()
    await page.getByText('The Grey Order').first().click()
    await expect(page.getByRole('button', { name: 'Close faction panel' })).toBeVisible()
    await expect(page.getByText('No cover image for this faction yet')).toHaveCount(0)
  })
})
