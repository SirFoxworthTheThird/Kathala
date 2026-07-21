import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

// Regression for dropdowns whose options are more than a bare string — e.g. the
// Story Beat picker renders `<span><dot/>{label}</span>`. The trigger used to
// go blank after selecting (and when re-opening an editor) because the item
// registered an empty label. The label-extraction logic is unit-tested in
// src/lib/__tests__/selectLabel.test.tsx; this drives the real portal Select.

test('a multi-child dropdown shows its selected value in the trigger', async ({ page }) => {
  test.setTimeout(90000)
  await page.goto('/')
  await resetDB(page)

  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Select World')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  // Timeline → chapter → event, then expand the card.
  await page.getByRole('link', { name: /timeline/i }).click()
  await page.getByRole('button', { name: 'Create Timeline' }).click()
  await page.getByRole('button', { name: 'Add Chapter' }).first().click()
  await page.getByPlaceholder('Chapter title').fill('One')
  await page.getByRole('button', { name: 'Add Chapter' }).last().click()
  await page.getByTitle('Open chapter detail').first().click()
  await page.getByRole('main').getByRole('button', { name: 'Add Event' }).first().click()
  await page.getByPlaceholder('Event title').fill('The gate')
  await page.getByRole('button', { name: 'Add Event' }).last().click()

  const main = page.getByRole('main')
  await main.getByText('The gate', { exact: true }).click()

  // The Story Beat picker starts on its placeholder…
  const beatTrigger = main.getByRole('button', { name: /No beat/ })
  await beatTrigger.scrollIntoViewIfNeeded()
  await expect(beatTrigger).toBeVisible()

  // …pick a beat whose option is a coloured-dot + label (not a plain string).
  await beatTrigger.click()
  await page.getByRole('option', { name: 'Inciting Incident' }).click()

  // The trigger now reflects the choice instead of going blank.
  await expect(main.getByRole('button', { name: 'Inciting Incident', exact: true })).toBeVisible()
  await expect(main.getByRole('button', { name: /No beat/ })).toHaveCount(0)

  // Collapse and re-open the card: the persisted value still resolves to its
  // label rather than a blank trigger (the "when editing something" case).
  await main.getByText('The gate', { exact: true }).click()
  await expect(main.getByRole('button', { name: /No beat/ })).toHaveCount(0)
  await main.getByText('The gate', { exact: true }).click()
  await expect(main.getByRole('button', { name: 'Inciting Incident', exact: true })).toBeVisible()
})
