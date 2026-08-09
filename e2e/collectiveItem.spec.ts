import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * Marking an item as a kind of thing rather than one object.
 *
 * The continuity checker treats an item's whereabouts as unique, which is wrong
 * for lembas or a cloak the whole Fellowship carries — that one rule produced 71
 * of the 97 issues the shipped Fellowship reported. The flag is only useful if a
 * writer can actually set it, so this drives it through the editor.
 */
test('an item can be marked as something there is more than one of', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Quartermaster')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  await page.getByRole('link', { name: /items/i }).first().click()
  await page.getByRole('button', { name: 'Add Item' }).first().click()
  await expect(page.getByRole('heading', { name: 'Add Item' })).toBeVisible()
  await page.getByPlaceholder('Item name').fill('Elven Cloak')
  await page.getByRole('button', { name: 'Add Item' }).last().click()
  await page.getByText('Elven Cloak').first().click()

  await page.getByRole('button', { name: /^Edit/ }).first().click()
  const box = page.getByRole('checkbox', { name: /more than one of these/i })
  await expect(box, 'the control should be offered').toBeVisible()
  await expect(box, 'a new item is a unique object by default').not.toBeChecked()

  await box.check()
  await page.getByRole('button', { name: 'Save' }).first().click()

  // It survives a reload, which is the part that proves it was written rather
  // than only held in component state.
  await page.reload()
  await page.getByRole('button', { name: /^Edit/ }).first().click()
  await expect(page.getByRole('checkbox', { name: /more than one of these/i })).toBeChecked()
})
