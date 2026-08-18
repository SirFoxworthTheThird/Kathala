import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * Hovering a nav link expands the left rail, which then overlays the board and
 * swallows drag gestures. Move the pointer back over the content first.
 */
const settleNav = (page: Page) => page.mouse.move(700, 400).then(() => page.waitForTimeout(150))

// The corkboard renders one card per event; dragging a card reorders it. This
// drives the real HTML5 drag-and-drop wiring (the ordering maths is unit-tested
// separately in src/lib/__tests__/corkboard.test.ts).

test.describe('Corkboard', () => {
  test('drags a scene card to reorder it within a chapter', async ({ page }) => {
    test.setTimeout(90000)
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Board World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    // Timeline → one chapter.
    await page.getByRole('link', { name: /timeline/i }).click()
    await settleNav(page)
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('Alpha')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await expect(page.getByText('Alpha').first()).toBeVisible()

    // Two events in that chapter.
    await page.getByTitle('Open chapter detail').first().click()
    for (const title of ['First Scene', 'Second Scene']) {
      await page.getByRole('main').getByRole('button', { name: 'Add Scene' }).first().click()
      await page.getByPlaceholder('Scene title').fill(title)
      await page.getByRole('button', { name: 'Add Scene' }).last().click()
      await expect(page.getByText(title).first()).toBeVisible()
    }

    // Go to the corkboard.
    await page.getByRole('link', { name: /corkboard/i }).click()
    await settleNav(page)
    // First navigation can trigger a cold Vite compile of the lazy chunk.
    await expect(page.getByRole('heading', { name: 'Corkboard' })).toBeVisible({ timeout: 30000 })

    const cards = page.locator('p.font-semibold', { hasText: /Scene/ })
    await expect(cards).toHaveText(['First Scene', 'Second Scene'])

    // Drag the second card onto the first → it should land first. Scoped to the
    // board: the chapter bar is on this screen now (W-1) and carries the same
    // scene titles, so a page-wide match here is ambiguous.
    const board = page.getByRole('main')
    await board.getByText('Second Scene', { exact: true })
      .dragTo(board.getByText('First Scene', { exact: true }))

    await expect(cards).toHaveText(['Second Scene', 'First Scene'])
  })
})
