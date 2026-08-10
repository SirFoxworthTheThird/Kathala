import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * SEL-3, SEL-4 and X-6 — what the world list tells you before you open a world.
 */

const SPEC = JSON.stringify({
  world: { name: 'Aethelgard', description: 'A pilot who knows the shoals.' },
  characters: [{ name: 'Kestrel' }, { name: 'Bram' }],
  chapters: [
    { title: 'Landfall', events: [{ id: 'e1', title: 'The wreck' }] },
    { title: 'Ashfall', events: [{ id: 'e2', title: 'The long road' }] },
    { title: 'The Reckoning', events: [{ id: 'e3', title: 'The gate' }] },
  ],
})

async function worldList(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
  await page.getByLabel('Story spec JSON').fill(SPEC)
  await page.getByRole('button', { name: 'Import world', exact: true }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
  await page.goto('/#/', { waitUntil: 'load' })
}

test.describe('The world list', () => {
  test.describe.configure({ timeout: 120_000 })

  test('SEL-3: a card says how much world is in it', async ({ page }) => {
    await worldList(page)
    const card = page.getByRole('main').getByText('Aethelgard').first().locator('..').locator('..')
    await expect(page.getByText('Aethelgard').first()).toBeVisible({ timeout: 30_000 })

    // The counts the Library card had and this one did not.
    await expect(page.getByText('3 chapters')).toBeVisible()
    await expect(page.getByText('2 characters')).toBeVisible()
    // The description was already there; the counts sit with it rather than
    // replacing it.
    await expect(page.getByText('A pilot who knows the shoals.')).toBeVisible()
    void card
  })

  test('X-6: the date says what it is and names its month', async ({ page }) => {
    await worldList(page)

    // "Created" answers "created or edited?", and a named month answers
    // "April or January?" — a bare 4/1/2026 answered neither.
    const created = page.getByText(/^Created /)
    await expect(created.first()).toBeVisible({ timeout: 30_000 })
    const text = await created.first().innerText()
    expect(text, `the month should be named, not numbered: ${text}`)
      .toMatch(/Created \d{1,2} [A-Z][a-z]{2}|Created [A-Z][a-z]{2} \d{1,2}/)
    expect(text).not.toMatch(/\d+\/\d+\/\d+/)
  })

  test('SEL-4: the product describes itself', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)
    await expect(page.getByText('A story bible for fiction writers')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Story Tracker')).toHaveCount(0)
  })
})
