import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * MT-3: the chapter bar is fixed chrome on every screen in a world, and the map
 * and the manuscript both want the height back.
 *
 * The finding says "roughly 150px". Measured, it is 100px for a frame
 * narrative's two tracks and 64px for the single track every other world gets —
 * so collapsing only the stacked case would have recovered 36px, which is not
 * worth a control. It rolls up on any world instead.
 *
 * The number that matters is the one the rest of the app sees: `main` reserves
 * the bar's height as padding, so the test reads that padding rather than
 * looking at the bar.
 */

const SPEC = JSON.stringify({
  world: { name: 'Rollup' },
  characters: [{ name: 'Kestrel' }],
  chapters: [{
    title: 'Landfall',
    events: [
      { id: 'e1', title: 'The wreck', characters: ['Kestrel'] },
      { id: 'e2', title: 'The harbour', characters: ['Kestrel'] },
    ],
  }],
})

async function worldFromSpec(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
  await page.getByLabel('Story spec JSON').fill(SPEC)
  await page.getByRole('button', { name: 'Import world', exact: true }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
  return page.url().split('/worlds/')[1].split('/')[0]
}

/** What the bar costs every screen: the padding `main` reserves for it. */
const reserved = (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector('main')
    return main ? Math.round(parseFloat(getComputedStyle(main).paddingBottom)) : -1
  })

const strip = (page: Page) => page.locator('[data-chapter-bar="collapsed"]')

test.describe('The chapter bar rolls up', () => {
  test.describe.configure({ timeout: 180_000 })

  test('it gives the height back, keeps the cursor legible, and comes back', async ({ page }) => {
    const worldId = await worldFromSpec(page)
    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    await expect(page.locator('[data-chapter-bar]')).toBeVisible({ timeout: 30_000 })

    // Put the cursor somewhere, so the strip has a position to carry and the
    // "where am I" half of the test is not vacuous.
    await page.locator('[data-chapter-bar]').getByRole('button', { name: 'The harbour' }).first().click()
    await page.waitForTimeout(400)

    // Presence: the full bar is a scrubber you can steer with, and it costs the
    // single-track height.
    const open = await reserved(page)
    expect(open, 'the single track is 4rem at a 16px root').toBe(64)
    await expect(strip(page), 'no strip while the bar is open').toHaveCount(0)

    await page.getByRole('button', { name: 'Hide the chapter bar' }).click()
    await expect(strip(page)).toBeVisible()

    // Absence, paired with the presence above: the scene markers are gone, and
    // so is most of the height.
    const rolled = await reserved(page)
    expect(rolled, `rolled up ${rolled}px vs open ${open}px`).toBeLessThan(open / 2)
    expect(rolled, 'but still a strip, not nothing').toBeGreaterThan(0)
    await expect(
      strip(page).getByRole('button', { name: 'The harbour' }),
      'the strip is one control, not a track of them',
    ).toHaveCount(0)

    // It still says where the cursor is — the one thing the bar was for that
    // survives at this height.
    await expect(strip(page)).toContainText('The harbour')
    await expect(strip(page)).toContainText('Ch.1')

    // Persisted: someone who put 100px of chrome away on the map did not mean
    // "until the next navigation". This is the assertion the partialize
    // whitelist has to earn.
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await expect(strip(page)).toBeVisible({ timeout: 30_000 })
    await page.reload()
    await expect(strip(page)).toBeVisible({ timeout: 30_000 })
    expect(await reserved(page)).toBe(rolled)

    // And back: the same height returns, and so does the track it was hiding.
    await page.getByRole('button', { name: 'Show the chapter bar' }).click()
    await expect(strip(page)).toHaveCount(0)
    expect(await reserved(page)).toBe(open)
    await expect(
      page.locator('[data-chapter-bar]').getByRole('button', { name: 'The harbour' }).first(),
    ).toBeVisible()
  })
})
