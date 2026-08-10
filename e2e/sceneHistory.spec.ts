import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

// The scene-history dialog drives the real DB revision capture + restore flow.
// (The capture/coalesce/prune/restore logic is unit-tested separately in
// src/db/hooks/__tests__/sceneRevisions.test.ts.)

test.describe('Scene revision history', () => {
  test('captures a prior draft and restores it', async ({ page }) => {
    test.setTimeout(90000)
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Draft World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    // Timeline → one chapter → one event.
    await page.getByRole('link', { name: /timeline/i }).click()
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('One')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await page.getByTitle('Open chapter detail').first().click()
    await page.getByRole('main').getByRole('button', { name: 'Add Event' }).first().click()
    await page.getByPlaceholder('Event title').fill('Scene A')
    await page.getByRole('button', { name: 'Add Event' }).last().click()

    // Expand the event card and write the first draft.
    const main = page.getByRole('main')
    await main.getByText('Scene A', { exact: true }).click()
    const editor = main.getByPlaceholder(/Write or paste this scene/)
    await editor.fill('The quick brown fox.')
    await editor.blur()

    // Wait for the first draft to be *stored*, not just typed. A revision is
    // only captured when there is existing prose to snapshot, so revising
    // before the first save lands leaves nothing to capture and no History
    // button — which is how this test failed under a loaded suite while
    // passing on its own.
    await expect.poll(() => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        sceneTexts: { toArray: () => Promise<{ text: string }[]> }
      }
      return (await db.sceneTexts.toArray()).map((s) => s.text)
    }), { timeout: 15_000 }).toContain('The quick brown fox.')

    // Revise it — this captures the first draft as a version.
    await editor.fill('The quick red fox.')
    await editor.blur()

    // Open history and restore the earlier draft.
    await main.getByRole('button', { name: /History \(/ }).click()
    await expect(page.getByRole('heading', { name: 'Scene history' })).toBeVisible({ timeout: 30000 })
    await page.getByRole('button', { name: 'Restore', exact: true }).click()
    await page.getByRole('button', { name: 'Restore' }).last().click() // confirm

    // The editor is back to the first draft.
    await expect(editor).toHaveValue('The quick brown fox.')
  })

  test('separates a deletion from the insertion replacing it', async ({ page }) => {
    // A deletion is usually followed immediately by its replacement with no
    // whitespace between, so unpadded highlights ran together: "years, and it
    // showed." then "years." rendered as one unreadable string.
    test.setTimeout(90000)
    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Diff World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    await page.getByRole('link', { name: /timeline/i }).click()
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('One')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await page.getByTitle('Open chapter detail').first().click()
    await page.getByRole('main').getByRole('button', { name: 'Add Event' }).first().click()
    await page.getByPlaceholder('Event title').fill('Scene A')
    await page.getByRole('button', { name: 'Add Event' }).last().click()

    const main = page.getByRole('main')
    await main.getByText('Scene A', { exact: true }).click()
    const editor = main.getByPlaceholder(/Write or paste this scene/)
    // The first draft must be committed before the second replaces it, or no
    // revision is captured and there is no history to open. That commit is a
    // debounced autosave with no observable of its own, so a pause is the right
    // instrument here — the flake was having none at all, not having one that
    // was too short.
    await editor.fill('The gate had not been opened in nine years, and it showed.')
    await editor.blur()
    await page.waitForTimeout(2000)

    await editor.fill('The gate had not been opened in nine years.')
    await editor.blur()

    const history = main.getByRole('button', { name: /History \(/ })
    await expect(history, 'revising a scene should capture the earlier draft').toBeVisible({ timeout: 30000 })
    await history.click()
    await expect(page.getByRole('heading', { name: 'Scene history' })).toBeVisible({ timeout: 30000 })

    const geo = await page.evaluate(() => {
      const pills = Array.from(
        document.querySelectorAll('[role="dialog"] .whitespace-pre-wrap span span')
      ).map((s) => {
        const r = s.getBoundingClientRect()
        return { text: (s.textContent || '').trim(), left: r.left, right: r.right, top: Math.round(r.top) }
      })
      let minGap = Infinity
      for (let i = 1; i < pills.length; i++) {
        if (pills[i].top !== pills[i - 1].top) continue // different lines don't abut
        minGap = Math.min(minGap, pills[i].left - pills[i - 1].right)
      }
      return { count: pills.length, texts: pills.map((p) => p.text), minGap }
    })

    // The two runs are highlighted separately...
    expect(geo.texts, 'the changed runs should be highlighted').toContain('years, and it showed.')
    expect(geo.texts).toContain('years.')
    // ...and do not touch, so they read as two blocks rather than one string.
    expect(geo.minGap, `adjacent highlights are ${geo.minGap}px apart`).toBeGreaterThan(0)
  })
})
