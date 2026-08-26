import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'

/**
 * TL-4, CB-3 and CB-4: a chapter row and a board column named the chapter and
 * repeated prose the author already wrote, without saying how much chapter was
 * in it. The roll-up maths is unit-tested in
 * `src/lib/__tests__/chapterProgress.test.ts`; this drives the two screens that
 * show it, against real scene prose.
 */

/** A world with one timeline and one chapter, left on the chapter detail screen. */
async function seedChapter(page: Page, worldName: string, statuses: string[]) {
  await resetDB(page)

  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill(worldName)
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  await page.getByRole('link', { name: /timeline/i }).click()
  await settleNav(page)
  await page.getByRole('button', { name: 'Create Timeline' }).click()
  await page.getByRole('button', { name: 'Add Chapter' }).first().click()
  await page.getByPlaceholder('Chapter title').fill('Alpha')
  await page.getByRole('button', { name: 'Add Chapter' }).last().click()

  await page.getByTitle('Open chapter detail').first().click()
  const titles = ['Opening', 'Closing']
  for (let i = 0; i < titles.length; i++) {
    await page.getByRole('main').getByRole('button', { name: 'Add Scene' }).first().click()
    const dialog = page.getByRole('dialog')
    await page.getByPlaceholder('Scene title').fill(titles[i])
    await dialog.getByRole('button', { name: statuses[i], exact: true }).click()
    await page.getByRole('button', { name: 'Add Scene' }).last().click()
    await expect(page.getByText(titles[i]).first()).toBeVisible()
  }
}

/** Write prose into the named scene from the chapter detail screen. */
async function writeScene(page: Page, title: string, prose: string) {
  const main = page.getByRole('main')
  await main.getByText(title, { exact: true }).click()
  const editor = main.getByPlaceholder(/Write or paste this scene/)
  await editor.fill(prose)
  await editor.blur()
  // Wait for the store, not the keystrokes: the save is triggered by blur, and
  // navigating away before it lands would leave the next screen with nothing to
  // count and no way to tell that apart from a broken roll-up.
  await expect.poll(() => page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as {
      sceneTexts: { toArray: () => Promise<{ text: string }[]> }
    }
    return (await db.sceneTexts.toArray()).map((s) => s.text)
  }), { timeout: 15_000 }).toContain(prose)
}

test.describe('Chapter roll-up', () => {
  test('the row and the board column say how much chapter there is', async ({ page }) => {
    test.setTimeout(120000)
    await seedChapter(page, 'Count World', ['Draft', 'Draft'])

    const main = page.getByRole('main')

    // ── Before any prose ────────────────────────────────────────────────────
    // The chapter has scenes but no words, so it says so — "0 words" on a
    // freshly outlined chapter would be noise.
    await page.getByRole('link', { name: /timeline/i }).click()
    await settleNav(page)
    await expect(main.getByText('2 scenes', { exact: true })).toBeVisible({ timeout: 30000 })

    await page.getByRole('link', { name: /corkboard/i }).click()
    await settleNav(page)
    await expect(page.getByRole('heading', { name: 'Corkboard' })).toBeVisible({ timeout: 30000 })
    await expect(main.getByText('2 scenes', { exact: true })).toBeVisible()
    // No card carries a length yet. This is the absence half; the presence half
    // below uses the same locator, so it cannot be passing vacuously.
    await expect(main.getByText(/^\d+ words?$/)).toHaveCount(0)

    // ── Write one scene ─────────────────────────────────────────────────────
    await page.getByRole('link', { name: /timeline/i }).click()
    await settleNav(page)
    await page.getByTitle('Open chapter detail').first().click()
    await writeScene(page, 'Opening', 'One two three four five six.')

    // ── After ───────────────────────────────────────────────────────────────
    await page.getByRole('link', { name: /timeline/i }).click()
    await settleNav(page)
    // Retried: the row updates when the blur-triggered save reaches the store.
    await expect(main.getByText('2 scenes · 6 words', { exact: true }))
      .toBeVisible({ timeout: 30000 })

    await page.getByRole('link', { name: /corkboard/i }).click()
    await settleNav(page)
    await expect(page.getByRole('heading', { name: 'Corkboard' })).toBeVisible({ timeout: 30000 })
    // The column header totals the chapter...
    await expect(main.getByText('2 scenes · 6 words', { exact: true })).toBeVisible()
    // ...and exactly one of the two cards carries a length: the one with prose.
    // `exact` keeps the header's own "· 6 words" out of the count.
    await expect(main.getByText('6 words', { exact: true })).toHaveCount(1)
  })

  test('the status rolls up to the least-advanced scene', async ({ page }) => {
    test.setTimeout(120000)
    // One finished scene and one barely started: the chapter is not finished.
    await seedChapter(page, 'Status World', ['Final', 'Idea'])

    const main = page.getByRole('main')
    await page.getByRole('link', { name: /timeline/i }).click()
    await settleNav(page)

    const pill = main.getByTitle('Least advanced of 2 scenes: Idea')
    await expect(pill).toBeVisible({ timeout: 30000 })
    await expect(pill).toHaveText('Idea')
    // It does not claim the whole chapter is at that stage...
    await expect(main.getByTitle('Every scene is Idea')).toHaveCount(0)
    // ...and it does not report the finished scene as the chapter's state.
    await expect(main.getByTitle(/Final$/)).toHaveCount(0)

    // Bring the lagging scene up to Final and the chapter reads Final, with the
    // sentence changing to match — the presence half of both absences above.
    await page.getByRole('link', { name: /corkboard/i }).click()
    await settleNav(page)
    await expect(page.getByRole('heading', { name: 'Corkboard' })).toBeVisible({ timeout: 30000 })
    // Cards sit in the order this test created them, so the second select is
    // Closing's. Read the value back rather than trusting the click, since the
    // assertion that matters is two screens away.
    const closingStatus = main.getByLabel('Scene status').nth(1)
    await closingStatus.selectOption('final')
    await expect(closingStatus).toHaveValue('final')

    await page.getByRole('link', { name: /timeline/i }).click()
    await settleNav(page)
    const whole = main.getByTitle('Every scene is Final')
    await expect(whole).toBeVisible({ timeout: 30000 })
    await expect(whole).toHaveText('Final')
    await expect(main.getByTitle(/^Least advanced/)).toHaveCount(0)
  })
})
