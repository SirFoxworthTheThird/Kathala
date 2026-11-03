import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/**
 * Timelines in the order the writer sets (`Timeline.position`), on writer run
 * 10's *The Cold Choir*: its tabs read The Compact, The Mercy, The Quiet —
 * the order of their random ids — in a book that runs 1 BL, 311 AL, 742 AL.
 */
const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/cold-choir.pwk')

async function openTheBook(page: Page): Promise<string> {
  await resetDB(page)
  await page.locator('input[type="file"][accept=".pwk,.pwb,application/json"]').setInputFiles(FIXTURE)
  await expect(page.getByRole('heading', { name: 'The Cold Choir' })).toBeVisible({ timeout: 60_000 })
  await expect(page).toHaveURL(/#\/worlds\/[^/]+/)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.goto(`/#/worlds/${worldId}/manuscript`)
  await settle(page)
  return worldId
}

const tabs = (page: Page) => page.getByRole('tablist', { name: 'Timelines' })
/** The timeline tabs' names, in the order shown — not *All timelines*. */
const order = async (page: Page) =>
  (await tabs(page).getByRole('tab').allInnerTexts()).map((t) => t.trim()).filter((t) => t !== 'All timelines')
const tabButton = (page: Page, name: string) => tabs(page).getByRole('button', { name, exact: true })

test.describe('Timelines in the writer’s order', () => {
  test.describe.configure({ timeout: 180_000 })

  test('are in the order they were made, and move by drag or Alt+arrow', async ({ page }) => {
    await openTheBook(page)
    // The file carries no order of its own: by creation, the Mercy (1 BL) was first.
    await expect.poll(() => order(page)).toEqual(['The Mercy', 'The Compact', 'The Quiet'])

    // Drag the Quiet onto the Mercy's place.
    await tabs(page).getByRole('tab').filter({ hasText: 'The Quiet' }).dragTo(tabs(page).getByRole('tab').filter({ hasText: 'The Mercy' }))
    await expect.poll(() => order(page)).toEqual(['The Quiet', 'The Mercy', 'The Compact'])

    // Alt+→ moves the focused tab one place on.
    await tabButton(page, 'The Quiet').focus()
    await page.keyboard.press('Alt+ArrowRight')
    await expect.poll(() => order(page)).toEqual(['The Mercy', 'The Quiet', 'The Compact'])
    // The tab keeps the focus, so it can be moved again.
    await expect(tabButton(page, 'The Quiet')).toBeFocused()
    // An arrow alone is not a move. Waiting for nothing to change proves
    // nothing, so a real move follows: Alt+← puts the Quiet first only if the
    // plain arrow left it second.
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Alt+ArrowLeft')
    await expect.poll(() => order(page)).toEqual(['The Quiet', 'The Mercy', 'The Compact'])

    // It is kept: after a reload, the tabs read the same.
    await page.reload()
    await settle(page)
    await expect.poll(() => order(page)).toEqual(['The Quiet', 'The Mercy', 'The Compact'])
  })

  test('a new timeline is named first, and goes last', async ({ page }) => {
    await openTheBook(page)
    await page.getByRole('button', { name: 'New Timeline' }).click()
    const dialog = page.getByRole('dialog', { name: 'New timeline' })
    const add = dialog.getByRole('button', { name: 'Add timeline' })
    // Nothing is made on a click alone.
    await expect(add).toBeDisabled()
    await dialog.getByLabel('Timeline name').fill('The Thaw')
    await expect(add).toBeEnabled()
    await add.click()
    await expect(dialog).toHaveCount(0)
    await expect.poll(() => order(page)).toEqual(['The Mercy', 'The Compact', 'The Quiet', 'The Thaw'])
    await expect(tabs(page).getByRole('tab', { selected: true })).toContainText('The Thaw')
    await expect(tabs(page).getByText(/^Timeline \d+$/)).toHaveCount(0)
  })

  test('the Manuscript reopens on the tab it was left on', async ({ page }) => {
    const worldId = await openTheBook(page)
    const selected = () => tabs(page).getByRole('tab', { selected: true })
    // A fresh book opens on its first timeline.
    await expect(selected()).toContainText('The Mercy')
    await tabButton(page, 'The Quiet').click()
    await expect(selected()).toContainText('The Quiet')

    await page.goto(`/#/worlds/${worldId}/characters`)
    await settle(page)
    await page.reload()
    await page.goto(`/#/worlds/${worldId}/manuscript`)
    await settle(page)
    await expect(selected()).toContainText('The Quiet')
  })
})
