import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

test.describe('World management', () => {
  test.beforeEach(async ({ page }) => {
    await resetDB(page)
  })

  test('shows the empty state and the ways in', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'PlotWeave' })).toBeVisible()
    await expect(page.getByRole('main')).toContainText('No worlds yet')
    // The empty state no longer carries its own copy of the entry points — they
    // live in the header's two groups, one control each.
    await expect(page.getByRole('group', { name: 'Start something new' })
      .getByRole('button', { name: 'New World' })).toBeVisible()
  })

  test('creates a new world and navigates to its dashboard', async ({ page }) => {
    await page.getByRole('button', { name: 'New World' }).click()
    // The custom Dialog has no role="dialog" — check the heading instead
    await expect(page.getByRole('heading', { name: 'Create New World' })).toBeVisible()

    // World dialog has htmlFor/id so getByLabel works here
    await page.getByLabel('Name').fill('Middle Earth')
    await page.getByLabel('Description').fill('A high-fantasy setting.')
    await page.getByRole('button', { name: 'Create World' }).last().click()

    await expect(page).toHaveURL(/#\/worlds\//)
    /*
      The banner's copy of the name, the way `mapControls.spec.ts` already reads
      it — not a page-wide `getByText`, which resolves to both the top bar and
      the dashboard heading and fails strict mode the moment the second one
      renders. That is what this test reported as a flake: ambiguous the whole
      time, and only fatal when the two settled in the same tick.

      Not the dashboard heading either, which is the obvious repair and is
      wrong: a world created with no timeline yet meets the first-run guide
      rather than the dashboard, so the `h1` is often not there at all. Scoping
      to it turned an intermittent failure into a reliable one.
    */
    await expect(page.getByRole('banner').getByText('Middle Earth')).toBeVisible()
  })

  test('shows the created world on the selector page', async ({ page }) => {
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Westeros')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    await page.getByText('PlotWeave').click()
    await expect(page).toHaveURL('/#/')
    await expect(page.getByText('Westeros')).toBeVisible()
  })

  test('requires a name to create a world', async ({ page }) => {
    await page.getByRole('button', { name: 'New World' }).click()
    await expect(page.getByRole('heading', { name: 'Create New World' })).toBeVisible()
    const createBtn = page.getByRole('button', { name: 'Create World' }).last()
    await expect(createBtn).toBeDisabled()
  })

  test('cancels world creation without creating anything', async ({ page }) => {
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Cancelled World')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Create New World' })).not.toBeVisible()
    await expect(page.getByText('Cancelled World')).not.toBeVisible()
  })
})
