import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'

/**
 * HB-6, from an outside review: *Recent Changes is too generic.*
 *
 * Two halves, and both stood. Every edit read "Edited scene", whatever it had
 * changed — though `changedFields` had been recorded on every update all
 * along, and simply never read. And the panel dimmed every row below the first
 * and gave it no button, without saying why; the reason was written in the
 * component's own doc comment, where no writer will ever see it, so undo looked
 * broken for older entries rather than deliberately reserved for the newest.
 *
 * The wording and the field-name rules are unit-tested in
 * `src/lib/__tests__/describeOperation.test.ts`. This is about the panel: that
 * the line reaches the screen, and that the explanation appears exactly when
 * there is something to explain.
 *
 * A later blind run (N6) found the other half of the same complaint: naming the
 * *field* was not enough, because the row still did not say which record it was
 * about. Seventeen accepted continuity fixes produced seventeen rows reading
 * *"Edited scene — involved characters"*, and undo was pressed five times into
 * work the panel had given no way to recognise. The record's name is now
 * resolved from the store — an update stores only the fields it changed, so it
 * is the only place it can come from — and the last test here is the one that
 * would have caught it: two edits of the same kind, on the same screen, that
 * must not read the same.
 */

const panel = (page: Page) => page.getByRole('dialog', { name: 'Recent changes' })
const ONLY_NEWEST = /Only the newest change can be undone/

async function worldWithAScene(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Journal World')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  await page.getByRole('link', { name: /timeline/i }).first().click()
  await settleNav(page)
  await page.getByRole('button', { name: 'Create Timeline' }).click()
  await page.getByRole('button', { name: 'Add Chapter' }).first().click()
  await page.getByPlaceholder('Chapter title').fill('The First Chapter')
  await page.getByRole('button', { name: 'Add Chapter' }).last().click()

  await page.getByTitle('Open chapter detail').first().click()
  await page.getByRole('main').getByRole('button', { name: 'Add Scene' }).first().click()
  await page.getByPlaceholder('Scene title').fill('The gate opens')
  await page.getByRole('button', { name: 'Add Scene' }).last().click()
  await expect(page.getByRole('main').getByText('The gate opens').first()).toBeVisible()
}

async function openRecentChanges(page: Page) {
  await page.getByRole('button', { name: 'Recent changes' }).first().click()
  await expect(panel(page)).toBeVisible()
}

test.describe('Recent changes says what changed', () => {
  test.describe.configure({ timeout: 300_000 })

  test('names the field an edit touched, not just the record', async ({ page }) => {
    await worldWithAScene(page)

    /*
      Type a chapter note. `updateChapter(id, { notes })` carries no name and no
      title, which is exactly the case the review filed: the row used to read
      "Edited chapter" flat, whatever had been touched.

      The scene's tension rating is the same shape and was the first choice,
      but that section only renders once the card is in edit mode, and driving
      that adds two clicks this test is not about.
    */
    await page.getByLabel("Writer's notes for this chapter").fill('Remember the gate.')
    await expect(page.getByText('Auto-saved')).toBeVisible()
    await page.waitForTimeout(1500)

    await openRecentChanges(page)
    await expect(panel(page).getByText('Edited chapter “The First Chapter” — notes')).toBeVisible()
  })

  /**
   * The finding, in the smallest shape that reproduces it: two edits of the
   * same kind to two different records. Before the name was resolved these
   * were the same sentence twice, and the panel is where you choose what to
   * undo.
   */
  test('tells two edits of the same kind apart', async ({ page }) => {
    await worldWithAScene(page)

    await page.getByLabel("Writer's notes for this chapter").fill('Remember the gate.')
    await expect(page.getByText('Auto-saved')).toBeVisible()
    await page.waitForTimeout(1500)

    // A second chapter, edited the same way. Back to the timeline first.
    await page.getByRole('link', { name: /timeline/i }).first().click()
    await settleNav(page)
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('The Second Chapter')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await expect(page.getByRole('main').getByText('The Second Chapter').first()).toBeVisible()
    await page.getByTitle('Open chapter detail').last().click()
    await settleNav(page)
    // Empty notes are how we know this is the *second* chapter's editor and not
    // the first one still mounted — the first chapter's notes are filled in
    // above, and without this the second edit lands on chapter one and the two
    // rows agree for the wrong reason.
    await expect(page.getByLabel("Writer's notes for this chapter")).toHaveValue('')
    await page.getByLabel("Writer's notes for this chapter").fill('And the bell.')
    await expect(page.getByText('Auto-saved')).toBeVisible()
    await page.waitForTimeout(1500)

    await openRecentChanges(page)
    await expect(panel(page).getByText('Edited chapter “The Second Chapter” — notes')).toBeVisible()
    await expect(panel(page).getByText('Edited chapter “The First Chapter” — notes')).toBeVisible()
  })

  /**
   * The presence-and-absence pair for the explanation. With one entry there is
   * no "older" to explain and the note would be noise; with two there is, and
   * the second row is the thing it is explaining. Vacuity cannot satisfy both.
   */
  test('explains why only the top row can be undone, once there is a second', async ({ page }) => {
    await worldWithAScene(page)

    // One journalled edit so far: creating the scene. Adding the chapter and
    // the timeline are journalled too, so assert the shape rather than assume.
    await openRecentChanges(page)
    const rows = panel(page).getByRole('listitem')
    await expect.poll(() => rows.count(), { timeout: 15_000 }).toBeGreaterThan(1)
    await expect(panel(page).getByText(ONLY_NEWEST)).toBeVisible()

    // And exactly one row offers the button, which is the thing being explained.
    await expect(panel(page).getByRole('button', { name: 'Undo' })).toHaveCount(1)
  })

  test('and says nothing about it when there is only one change', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('One Change')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    await page.getByRole('link', { name: /characters/i }).first().click()
    await settleNav(page)
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Aldric')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Aldric').first()).toBeVisible()

    await openRecentChanges(page)
    // The single row is there — without this the absence below is vacuous.
    await expect(panel(page).getByText('Added character “Aldric”')).toBeVisible()
    await expect(panel(page).getByRole('listitem')).toHaveCount(1)
    await expect(panel(page).getByText(ONLY_NEWEST)).toHaveCount(0)
  })
})
