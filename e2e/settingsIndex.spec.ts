import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * SET-2 — eleven sections in one unbroken scroll, with no tabs, jump links or
 * section index. Changing one thing meant scrolling past everything else, and
 * past the paragraph each section carries explaining what it is for (**X-5**).
 *
 * The index is read from the sections themselves rather than from a list kept
 * beside them, because half of them are conditional — the world block is hidden
 * in reading mode, sync only appears once its data exists. The last test here
 * is what makes that worth doing: a hand-maintained list would keep offering a
 * chip for a section that is no longer on screen.
 */

const SPEC = JSON.stringify({
  world: { name: 'Aethelgard' },
  characters: [{ name: 'Kestrel' }],
  chapters: [{ title: 'Landfall', events: [{ id: 'e1', title: 'The wreck', characters: ['Kestrel'] }] }],
})

async function settings(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
  await page.getByLabel('Story spec JSON').fill(SPEC)
  await page.getByRole('button', { name: 'Import world', exact: true }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
  return worldId
}

const index = (page: Page) => page.getByRole('navigation', { name: 'Settings sections' })

test.describe('World settings can be navigated', () => {
  test.describe.configure({ timeout: 120_000 })

  test('SET-2: the index lists the sections and jumps to them', async ({ page }) => {
    await settings(page)
    await expect(index(page)).toBeVisible({ timeout: 30_000 })

    // Every section on the page is offered.
    const sectionLabels = await page.locator('[data-settings-section]')
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.settingsSection))
    expect(sectionLabels.length).toBeGreaterThan(5)
    for (const label of sectionLabels) {
      await expect(index(page).getByRole('link', { name: label!, exact: true })).toBeVisible()
    }

    // Absence first: the section at the far end of the scroll is off screen.
    const share = page.locator('#settings-share')
    expect(await share.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return r.top >= 0 && r.bottom <= window.innerHeight
    })).toBe(false)

    // Presence: the chip brings it into view, and clear of the sticky index.
    await index(page).getByRole('link', { name: 'Share', exact: true }).click()
    await expect.poll(async () => share.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const nav = document.querySelector('nav[aria-label="Settings sections"]')!.getBoundingClientRect()
      return r.top >= nav.bottom - 1 && r.top < window.innerHeight
    }), { timeout: 10_000 }).toBe(true)
  })

  test('SET-2: the index tracks sections that come and go', async ({ page }) => {
    await settings(page)
    await expect(index(page).getByRole('link', { name: 'World', exact: true })).toBeVisible({ timeout: 30_000 })

    // Reading mode hides the World block — a downloaded book is not the
    // reader's to rename — along with everything else that calibrates a draft,
    // leaving two sections. A list maintained by hand would go on offering
    // chips that scroll nowhere; reading the DOM leaves nothing to offer, and
    // an index of two is more chrome than the scrolling it saves.
    await page.getByRole('button', { name: 'Turn on reading mode' }).click()
    await expect(page.locator('#settings-world')).toHaveCount(0, { timeout: 15_000 })
    await expect(page.locator('[data-settings-section]')).toHaveCount(2)
    await expect(index(page)).toHaveCount(0)

    // Back again — so this is not passing because the index broke on the first
    // render and stayed broken.
    await page.getByRole('button', { name: 'Turn off reading mode' }).click()
    await expect(index(page).getByRole('link', { name: 'World', exact: true }))
      .toBeVisible({ timeout: 15_000 })
  })
})
