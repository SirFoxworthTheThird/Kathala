import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import path from 'path'
import { fileURLToPath } from 'url'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

/**
 * Two findings about the dialogs a writer meets first.
 *
 * **WRUN-9** — Add Chapter and Add Scene labelled their fields by adjacency: a
 * `<Label>` with no `htmlFor` beside an `<Input>` with no `id`, so the only
 * thing naming the field was the placeholder, which disappears as you type.
 * `controlNames.spec.ts` sweeps eight screens and **HB-7a** named its boundary
 * out loud — *"a dialog no screen in `controlNames` has open"* — which is
 * exactly where these two sit.
 *
 * **WRUN-10** — the map dialog's *or link a URL* field was `type="url"` inside
 * the same form as the submit, so half-typed text abandoned there blocked the
 * upload of a file already chosen and previewed above it, with a native bubble
 * pointing at the field the writer had given up on.
 */

async function aWorld(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Salt')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  return worldId
}

/** Fields in the open dialog that no label, `aria-label` or `title` names. */
const unnamedFields = (page: Page) => page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]')
  if (!dialog) return ['no dialog open']
  return [...dialog.querySelectorAll('input, textarea')]
    .filter((el) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return false
      if (el.getAttribute('aria-label') || el.getAttribute('title')) return false
      if (el.getAttribute('aria-labelledby')) return false
      const id = el.getAttribute('id')
      return !(id && dialog.querySelector(`label[for="${CSS.escape(id)}"]`))
    })
    .map((el) => `${el.tagName.toLowerCase()} placeholder=${el.getAttribute('placeholder') ?? '—'}`)
})

test.describe('The first dialogs name their fields', () => {
  test.describe.configure({ timeout: 180_000 })

  test('Add Chapter', async ({ page }) => {
    const worldId = await aWorld(page)
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await page.waitForTimeout(1200)
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()

    // Presence first, so a dialog that failed to open cannot pass as "nothing
    // unnamed" — the vacuity this suite keeps finding.
    await expect(page.getByLabel('Title')).toBeVisible()
    await expect(page.getByLabel('Synopsis')).toBeVisible()

    const bad = await unnamedFields(page)
    expect(bad, `fields with no accessible name:\n${bad.join('\n')}`).toEqual([])
  })

  test('Add Scene', async ({ page }) => {
    const worldId = await aWorld(page)
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await page.waitForTimeout(1200)
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('The Letter')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await page.getByTitle('Open chapter detail').first().click()
    await page.waitForTimeout(800)
    await page.getByRole('main').getByRole('button', { name: 'Add Scene' }).first().click()

    /*
      Scoped to the dialog, which is what this test is about. Unscoped,
      `getByLabel('Title')` also matched the chapter screen behind it once its
      heading became an editable "Chapter title" — a substring match on a field
      that was ambiguous-in-waiting rather than a regression in the dialog.
    */
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Title')).toBeVisible()
    await expect(dialog.getByLabel('Description')).toBeVisible()
    await expect(dialog.getByLabel('Tags')).toBeVisible()

    const bad = await unnamedFields(page)
    expect(bad, `fields with no accessible name:\n${bad.join('\n')}`).toEqual([])
  })

  test('a half-typed URL does not block a map upload', async ({ page }) => {
    const worldId = await aWorld(page)
    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    await page.mouse.move(900, 500)
    await page.getByRole('button', { name: 'Upload Map' }).first().click()

    // The half-thought the writer abandoned…
    await page.getByPlaceholder('https://…/map.jpg').fill('ashcorn map')
    // …and the file they actually chose.
    await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
    await page.getByLabel('Map Name').clear()
    await page.getByLabel('Map Name').fill('The Reach')
    await page.getByRole('button', { name: 'Upload', exact: true }).click()

    // It goes through: the map is on screen and the dialog has closed.
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
