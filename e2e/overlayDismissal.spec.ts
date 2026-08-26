import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * Escape closes every overlay, not merely most of them.
 *
 * Writer's Brief and Continuity Checker registered their own key handlers;
 * Recent changes and Chapter Diff — hand-rolled overlays rather than the shared
 * Dialog — registered none, so the key that works everywhere else silently did
 * nothing on two panels opened from the same toolbar.
 *
 * All four are driven in one test on purpose: a broken key or a dead page would
 * take every line down together, so two passing and two failing is a result
 * about the app rather than about the harness.
 */
test.describe('Overlay dismissal', () => {
  test.describe.configure({ timeout: 120_000 })

  async function worldWithChapters(page: Page) {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Dismiss')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const id = page.url().match(/#\/worlds\/([^/]+)/)![1]

    await page.goto(`/#/worlds/${id}/timeline`)
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    for (const t of ['The Gate', 'The Road']) {
      await page.getByRole('button', { name: 'Add Chapter' }).first().click()
      await page.getByPlaceholder('Chapter title').fill(t)
      await page.getByRole('button', { name: 'Add Chapter' }).last().click()
      await expect(page.getByText(t).first()).toBeVisible()
    }
    // Chapter Diff only appears once an event is active on the timeline bar.
    await page.getByTitle('Open chapter detail').first().click()
    await page.getByRole('main').getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByPlaceholder('Scene title').fill('Scene One')
    await page.getByRole('button', { name: 'Add Scene' }).last().click()
    await page.goto(`/#/worlds/${id}/timeline`)
    await page.getByTitle('Scene One', { exact: true }).click()
    return id
  }

  test('Escape closes every top-bar overlay', async ({ page }) => {
    await worldWithChapters(page)

    // Each marker is the overlay itself, not text that happens to name it. The
    // loose page-wide versions these replace made the Continuity case flake:
    // /Continuity/ matches whatever else the checker leaves on screen, so the
    // "it closed" assertion was really "no word like that is anywhere".
    const cases: { name: string; open: () => Promise<void>; marker: () => ReturnType<Page['getByText']> }[] = [
      {
        name: "Writer's Brief",
        open: async () => { await page.getByRole('button', { name: "Writer's Brief" }).click() },
        marker: () => page.getByRole('dialog', { name: "Writer's Brief" }),
      },
      {
        name: 'Continuity Checker',
        open: async () => { await page.getByRole('button', { name: 'Continuity Checker' }).click() },
        marker: () => page.getByRole('dialog', { name: 'Continuity Checker' }),
      },
      {
        name: 'Recent changes',
        open: async () => { await page.getByRole('button', { name: 'Recent changes' }).click() },
        marker: () => page.getByRole('dialog', { name: 'Recent changes' }),
      },
      {
        name: 'Chapter Diff',
        open: async () => { await page.getByTitle('Compare chapters').click() },
        marker: () => page.getByRole('dialog', { name: 'Chapter Diff' }),
      },
      {
        name: 'Help',
        open: async () => { await page.getByRole('button', { name: 'Help' }).click() },
        marker: () => page.getByRole('heading', { name: 'Help' }),
      },
    ]

    for (const c of cases) {
      await c.open()
      await expect(c.marker().first(), `${c.name} should open`).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(c.marker(), `${c.name} should close on Escape`).toHaveCount(0)
    }
  })

  test('Escape closes the Continuity Checker wherever focus is', async ({ page }) => {
    await worldWithChapters(page)

    // The panel used to close off its container's React onKeyDown, which only
    // fires once focus is inside it — and focus was handed over by a
    // `setTimeout(…, 0)`. Press Escape before that runs and nothing happened.
    // It failed about one run in eight under a loaded suite; forcing focus out
    // of the panel reproduces it every time.
    await page.getByRole('button', { name: 'Continuity Checker' }).click()
    const panel = page.getByRole('dialog', { name: 'Continuity Checker' })
    await expect(panel).toBeVisible()

    /*
      Blur inside the poll, not once before it. The panel hands focus over with
      a `setTimeout(…, 0)` — the very race this test exists for — so a single
      blur that lands first is simply undone, focus returns to a DIV, and the
      poll waits out its timeout on a condition nothing will make true again.
      Blurring on each attempt converges the moment the handoff has run.
    */
    await expect.poll(() => page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur()
      return document.activeElement?.tagName
    })).toBe('BODY')

    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)

    // The opposite condition, so this cannot pass on a panel that never opens:
    // it opens again and stays open until the key is pressed.
    await page.getByRole('button', { name: 'Continuity Checker' }).click()
    await expect(panel).toBeVisible()
    await page.waitForTimeout(300)
    await expect(panel).toBeVisible()
  })

  test('every overlay close button has an accessible name', async ({ page }) => {
    await worldWithChapters(page)
    await page.getByTitle('Compare chapters').click()
    await expect(page.getByText('Chapter Diff')).toBeVisible()

    // A bare icon button announces only "button"; the diff header had no text,
    // aria-label or title at all.
    await expect(page.getByRole('button', { name: /close chapter diff/i })).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Recent changes' }).click()
    await expect(page.getByRole('button', { name: /close recent changes/i })).toBeVisible()
  })
})
