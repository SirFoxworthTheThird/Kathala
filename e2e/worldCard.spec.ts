import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'

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
    //
    // This world says "Created" for a reason worth naming: it arrived by spec
    // import, which calls `markJournalDiscontinuity`, so nothing knows when it
    // was last worked on and the card does not pretend otherwise. The other
    // branch is the test below.
    const created = page.getByText(/^Created /)
    await expect(created.first()).toBeVisible({ timeout: 30_000 })
    const text = await created.first().innerText()
    expect(text, `the month should be named, not numbered: ${text}`)
      .toMatch(/Created \d{1,2} [A-Z][a-z]{2}|Created [A-Z][a-z]{2} \d{1,2}/)
    expect(text).not.toMatch(/\d+\/\d+\/\d+/)
  })

  /*
    "Which of these did I last touch" is the question a returning writer with
    several worlds brings to this screen, and the card answered "when was it
    made". `world.updatedAt` is not the answer — only `updateWorld` moves it, so
    it tracks a rename and not the two hundred scenes written since — so the
    line reads the operation journal, and says "Created" where that has nothing
    to say. See `src/lib/worldActivity.ts`.
  */
  test('the date follows the work, once there is work to follow', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Anhalt')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    await dismissFirstRunGuide(page)

    // Nothing has happened in it yet, so the card says when it was made.
    await page.goto('/#/', { waitUntil: 'load' })
    const card = page.getByRole('main').getByText('Anhalt').first().locator('../..')
    await expect(card.getByText(/^Created /)).toBeVisible({ timeout: 30_000 })
    await expect(card.getByText(/^Edited /)).toHaveCount(0)

    // One journalled edit — a character — and the same card changes its answer.
    await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByLabel('Name').fill('Ossian Marl')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByRole('main').getByText('Ossian Marl')).toBeVisible({ timeout: 20_000 })

    await page.goto('/#/', { waitUntil: 'load' })
    const same = page.getByRole('main').getByText('Anhalt').first().locator('../..')
    await expect(same.getByText(/^Edited /)).toBeVisible({ timeout: 30_000 })
    await expect(same.getByText(/^Created /)).toHaveCount(0)
  })

  test('SEL-4: the product describes itself', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)
    await expect(page.getByText('A story bible for fiction writers')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Story Tracker')).toHaveCount(0)
  })
})
