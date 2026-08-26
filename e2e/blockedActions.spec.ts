import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import path from 'path'
import { fileURLToPath } from 'url'
import { settle } from './helpers/settle'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

/**
 * X-9: primary actions disabled themselves and said nothing. *Add Location*
 * greyed out until Name was filled (**OP-6**); *Save route* until the route had
 * both a name and two points (**RT-1**). No required marker, no helper text, no
 * message on hover — the button did nothing and the writer had to guess which
 * of several fields was at fault.
 *
 * Every case here is compound or non-obvious, which is where guessing actually
 * happens. A single-field dialog whose one visible field is empty is not the
 * finding and is deliberately left alone.
 */

async function newWorld(page: Page, name: string) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
}

test.describe('A blocked action says what it is waiting for', () => {
  test.describe.configure({ timeout: 180_000 })

  test('OP-6: Add Location names the field that is holding it', async ({ page }) => {
    await newWorld(page, 'Blocked')
    await page.getByRole('link', { name: /maps/i }).first().click()
    await page.mouse.move(900, 500)
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
    await page.getByLabel('Map Name').clear()
    await page.getByLabel('Map Name').fill('Middle Earth')
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
    await settle(page)

    await page.getByRole('button', { name: 'Location', exact: true }).click()
    await page.locator('.leaflet-container').click({ position: { x: 300, y: 200 } })
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 15_000 })

    // Presence: blocked, and it says so — naming the field, not just greying out.
    const add = dialog.getByRole('button', { name: 'Add Location' })
    await expect(add).toBeDisabled()
    await expect(dialog.getByRole('status')).toHaveText('Needs a name.')
    // …and the field itself is marked, so the message has somewhere to point.
    await expect(dialog.getByText('(required)')).toBeVisible()

    // Absence: the moment it can run, the message is gone entirely — not an
    // empty box holding space. Permanent help text is its own finding (X-5).
    await dialog.getByPlaceholder('e.g. Thornwall City').fill('Rivendell')
    await expect(add).toBeEnabled()
    await expect(dialog.getByRole('status')).toHaveCount(0)
  })

  test('RT-1: Save route names both halves, and only what is missing', async ({ page }) => {
    await newWorld(page, 'Blocked Route')
    await page.getByRole('link', { name: /maps/i }).first().click()
    await page.mouse.move(900, 500)
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
    await page.getByLabel('Map Name').clear()
    await page.getByLabel('Map Name').fill('Middle Earth')
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
    await settle(page)

    await page.getByRole('button', { name: /^Routes/i }).first().click()
    await page.getByRole('button', { name: 'New route' }).click()
    const hud = page.getByRole('status')
    await expect(hud).toHaveText('Needs a name and two points.', { timeout: 15_000 })

    // Placing points satisfies one half and the message narrows to the other —
    // the half the HUD's point counter never hinted at.
    const canvas = (await page.locator('.leaflet-container').boundingBox())!
    await page.mouse.click(canvas.x + canvas.width * 0.3, canvas.y + canvas.height * 0.4)
    await page.mouse.click(canvas.x + canvas.width * 0.6, canvas.y + canvas.height * 0.5)
    await expect(hud).toHaveText('Needs a name.')

    // Absence: naming it clears the message and frees the button.
    const save = page.getByRole('button', { name: 'Save route' })
    await expect(save).toBeDisabled()
    await page.getByPlaceholder('Route name…').fill('The Great East Road')
    await expect(page.getByRole('status')).toHaveCount(0)
    await expect(save).toBeEnabled()
  })

  test('the merged timeline says why Add Chapter is dead, and stops when it is not', async ({ page }) => {
    // The least guessable instance: a chapter belongs to one timeline, so both
    // header actions go dead on the merged view, with nothing on the button to
    // connect them to the tab that put you there.
    await newWorld(page, 'Two Timelines')
    await page.getByRole('link', { name: /timeline/i }).first().click()
    await settle(page)

    const seeded = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        worlds: { toArray: () => Promise<{ id: string }[]> }
        timelines: { toArray: () => Promise<unknown[]>; add: (v: unknown) => Promise<unknown> }
      }
      const worldId = (await db.worlds.toArray())[0].id
      const now = Date.now()
      const before = (await db.timelines.toArray()).length
      await db.timelines.add({ id: 'tl-a', worldId, name: 'The Present', description: '', color: '#f59e0b', createdAt: now })
      await db.timelines.add({ id: 'tl-b', worldId, name: 'The Past', description: '', color: '#60a5fa', createdAt: now + 1 })
      return before + 2
    })
    expect(seeded, 'the seeding seam should be present in an e2e build').toBeGreaterThanOrEqual(2)

    await page.reload({ waitUntil: 'load' })
    await settle(page)

    // Two "Add Chapter" buttons exist: the header action and the empty-state
    // CTA inside the panel. The header one is what goes dead on the merged view.
    const add = page.getByRole('button', { name: 'Add Chapter' }).first()

    // Absence first, as the ordinary case: on a single timeline it just works,
    // and says nothing. Without this half the presence below could pass on a
    // message that is simply always there.
    await expect(add).toBeEnabled({ timeout: 15_000 })
    await expect(page.getByRole('status')).toHaveCount(0)

    // Presence: the merged view is reached by this view's own tab, and there
    // the action is dead and the page says why — naming that tab, not the
    // scope selector in the bar, which is a different control entirely.
    await page.getByRole('tab', { name: 'All timelines' }).click()
    await expect(add).toBeDisabled({ timeout: 15_000 })
    await expect(page.getByRole('status').first()).toContainText('pick a tab above')

    // And going back to one timeline clears both together.
    await page.getByRole('tab', { name: 'The Past' }).click()
    await expect(add).toBeEnabled({ timeout: 15_000 })
    await expect(page.getByRole('status')).toHaveCount(0)
  })
})
