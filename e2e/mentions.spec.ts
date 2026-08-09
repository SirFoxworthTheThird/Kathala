import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

// Exercises the browser-only parts of the "@"-mention feature that unit and
// fake-indexeddb integration tests can't reach: the autocomplete dropdown, name
// insertion into the prose, and the caret/blur interplay in SceneDraftEditor.

test.describe('@-mentions in the scene draft', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Mentions World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    // A character to mention.
    await page.getByRole('link', { name: /characters/i }).click()
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Kael')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Kael')).toBeVisible()
  })

  // Creates a chapter + event, opens the chapter detail, and expands the event
  // card. Returns the scene-draft textarea (scoped to <main> so the card title
  // isn't confused with the timeline-bar marker of the same name).
  async function openSceneDraft(page: Page) {
    await page.getByRole('link', { name: /timeline/i }).click()
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('Act One')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await page.getByTitle('Open chapter detail').click()
    await expect(page).toHaveURL(/#\/worlds\/.+\/timeline\/.+/)

    const main = page.getByRole('main')
    await main.getByRole('button', { name: 'Add Event' }).first().click()
    await page.getByPlaceholder('Event title').fill('The Departure')
    await page.getByRole('button', { name: 'Add Event' }).last().click()

    // Expand the event card via its title button (inside <main>).
    // Exact: the card's icon controls are named after the scene they act on,
    // so a substring match on the title finds five buttons.
    await main.getByRole('button', { name: 'The Departure', exact: true }).click()
    const draft = page.getByPlaceholder(/Write or paste this scene/)
    await expect(draft).toBeVisible()
    return draft
  }

  test('typing @ inserts the plain name and records the mention', async ({ page }) => {
    const draft = await openSceneDraft(page)

    // fill() dispatches a single change with the caret at the end, opening the
    // autocomplete on the trailing "@Kae" token.
    await draft.fill('Mira spoke of @Kae')

    // Pick Kael from the dropdown. Clicking runs the item's onMouseDown → select,
    // which is independent of textarea focus (unlike an Enter keypress).
    await page.getByRole('button', { name: 'Kael' }).click()

    // The prose gets the plain name — no "@" token left behind.
    await expect(draft).toHaveValue('Mira spoke of Kael ')
    // The mention is recorded immediately (on select, not on blur).
    await expect(page.getByRole('button', { name: 'Remove mention of Kael' })).toBeVisible()

    // Removing the mention chip clears it again.
    await page.getByRole('button', { name: 'Remove mention of Kael' }).click()
    await expect(page.getByRole('button', { name: 'Remove mention of Kael' })).toHaveCount(0)
  })
})
