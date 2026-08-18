import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'

test.describe("Writer's Brief panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    // Create a world
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Brief World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
  })

  test("opens Writer's Brief panel via toolbar button", async ({ page }) => {
    await page.getByTitle("Writer's Brief").click()
    await expect(page.getByText("Writer's Brief")).toBeVisible()
  })

  test('closes panel by clicking backdrop', async ({ page }) => {
    await page.getByTitle("Writer's Brief").click()
    await expect(page.getByText("Writer's Brief")).toBeVisible()
    // Click the backdrop (outside the panel — top-left corner)
    await page.mouse.click(5, 5)
    await expect(page.getByText("Writer's Brief")).not.toBeVisible()
  })

  // The no-cursor state is WB-1's subject and is covered in full by
  // `writersBriefCursor.spec.ts` — a picker when there are scenes, a route to
  // the Timeline when there are none. It used to be one sentence naming the
  // timeline bar, asserted here.

  test('shows chapter content when an event is active', async ({ page }) => {
    // Create a timeline with a chapter and event
    await page.getByRole('link', { name: 'Timeline' }).click()
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await expect(page.getByText('Main Timeline')).toBeVisible()

    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('Opening Act')
    await page.getByPlaceholder('Brief synopsis...').fill('The story begins.')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    // Appears in both the chapter list and the timeline bar — first() is fine.
    await expect(page.getByText('Opening Act').first()).toBeVisible()

    // Open chapter detail and create an event
    await page.getByTitle('Open chapter detail').click()
    await page.getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByPlaceholder('Scene title').fill('First Encounter')
    await page.getByRole('button', { name: 'Add Scene' }).last().click()
    // Scoped to the card: opening a chapter now sets the time cursor, so the
    // pill in the top bar carries the scene title too.
    await expect(page.getByRole('main').getByRole('button', { name: 'First Encounter', exact: true })).toBeVisible()

    // Set the event as active via the timeline bar
    await page.getByRole('link', { name: 'Timeline' }).click()
    await settleNav(page)
    await page.getByTitle('First Encounter', { exact: true }).click()

    // Open brief — should show chapter info
    await page.getByTitle("Writer's Brief").click()
    await expect(page.getByText("Writer's Brief")).toBeVisible()
    // Brief panel shows the chapter title (exact match to avoid chapter bar duplicates)
    await expect(page.getByText('Opening Act', { exact: true })).toBeVisible()
    // Brief shows active event (appears in panel + timeline bar; first() is fine)
    await expect(page.getByText('First Encounter').first()).toBeVisible()
  })

  test('brief shows characters involved in chapter', async ({ page }) => {
    // Create a character
    await page.getByTitle('Characters').click()
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Aragorn')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Aragorn')).toBeVisible()

    // Create timeline with chapter + event involving the character
    await page.getByRole('link', { name: 'Timeline' }).click()
    await page.getByRole('button', { name: 'Create Timeline' }).click()

    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('The Council')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()

    await page.getByTitle('Open chapter detail').click()
    await page.getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByPlaceholder('Scene title').fill('Council Scene')
    await page.getByRole('button', { name: 'Add Scene' }).last().click()

    // Activate the event
    await page.getByRole('link', { name: 'Timeline' }).click()
    await settleNav(page)
    await page.getByTitle('Council Scene', { exact: true }).click()

    // Open brief
    await page.getByTitle("Writer's Brief").click()
    await expect(page.getByText("Writer's Brief")).toBeVisible()
    await expect(page.getByText('The Council', { exact: true })).toBeVisible()
  })
})
