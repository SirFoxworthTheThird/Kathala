import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav, onCards } from './helpers/nav'

/**
 * TL-4: a chapter row named the chapter and repeated prose the author already
 * wrote, without saying how much chapter was in it. The roll-up maths is
 * unit-tested in `src/lib/__tests__/chapterProgress.test.ts`; this drives the
 * row that shows it, against real scene prose. (The Corkboard's columns, CB-3
 * and CB-4, went with the Corkboard.)
 */

/** A world with one timeline and one chapter, left on the chapter detail screen. */
async function seedChapter(page: Page, worldName: string, statuses: string[]) {
  await resetDB(page)

  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill(worldName)
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  await page.getByRole('link', { name: /manuscript/i }).click()

  await onCards(page)
  await settleNav(page)
  await page.getByRole('button', { name: 'Create Timeline' }).click()
  await page.getByRole('button', { name: 'Add Chapter' }).first().click()
  await page.getByPlaceholder('Chapter title').fill('Alpha')
  await page.getByRole('button', { name: 'Add Chapter' }).last().click()

  await page.getByTitle('Open chapter detail').first().click()
  const titles = ['Opening', 'Closing']
  for (let i = 0; i < titles.length; i++) {
    await page.getByRole('main').getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByPlaceholder('Scene title').fill(titles[i])
    await page.getByRole('button', { name: 'Add Scene' }).last().click()
    await expect(page.getByText(titles[i]).first()).toBeVisible()
  }
  /*
    The status each scene is at. Picked in the Add Scene dialog while there was
    one; a scene is made from its title alone now, and the status is set on its
    card. Written directly, because this spec is about what the roll-up shows,
    not about the control that sets a scene's status.
  */
  await page.evaluate(async ({ titles, statuses }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as {
      events: { toArray: () => Promise<Array<{ id: string; title: string }>>; update: (id: string, c: object) => Promise<unknown> }
    }
    const all = await db.events.toArray()
    for (let i = 0; i < titles.length; i++) {
      const ev = all.find((e) => e.title === titles[i])
      if (ev) await db.events.update(ev.id, { status: statuses[i].toLowerCase() })
    }
  }, { titles, statuses })
}

/** Write prose into the named scene from the chapter detail screen. */
async function writeScene(page: Page, title: string, prose: string) {
  const main = page.getByRole('main')
  await main.getByRole('button', { name: title, exact: true }).click()
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
  test('the row says how much chapter there is', async ({ page }) => {
    test.setTimeout(120000)
    await seedChapter(page, 'Count World', ['Draft', 'Draft'])

    const main = page.getByRole('main')

    // ── Before any prose ────────────────────────────────────────────────────
    // The chapter has scenes but no words, so it says so — "0 words" on a
    // freshly outlined chapter would be noise.
    await page.getByRole('link', { name: /manuscript/i }).click()
    await onCards(page)
    await settleNav(page)
    await expect(main.getByText('2 scenes', { exact: true })).toBeVisible({ timeout: 30000 })
    // No length yet. The absence half; the presence half below is the same
    // row, so it cannot be passing vacuously.
    await expect(main.getByText(/^2 scenes · \d+ words?$/)).toHaveCount(0)

    // ── Write one scene ─────────────────────────────────────────────────────
    await page.getByRole('link', { name: /manuscript/i }).click()
    await onCards(page)
    await settleNav(page)
    await page.getByTitle('Open chapter detail').first().click()
    await writeScene(page, 'Opening', 'One two three four five six.')

    // ── After ───────────────────────────────────────────────────────────────
    await page.getByRole('link', { name: /manuscript/i }).click()
    await onCards(page)
    await settleNav(page)
    // Retried: the row updates when the blur-triggered save reaches the store.
    await expect(main.getByText('2 scenes · 6 words', { exact: true }))
      .toBeVisible({ timeout: 30000 })
  })

  test('the status rolls up to the least-advanced scene', async ({ page }) => {
    test.setTimeout(120000)
    // One finished scene and one barely started: the chapter is not finished.
    await seedChapter(page, 'Status World', ['Final', 'Idea'])

    const main = page.getByRole('main')
    await page.getByRole('link', { name: /manuscript/i }).click()
    await onCards(page)
    await settleNav(page)

    const pill = main.getByTitle('Least advanced of 2 scenes: Idea')
    await expect(pill).toBeVisible({ timeout: 30000 })
    await expect(pill).toHaveText('Idea')
    // It does not claim the whole chapter is at that stage...
    await expect(main.getByTitle('Every scene is Idea')).toHaveCount(0)
    // ...and it does not report the finished scene as the chapter's state.
    await expect(main.getByTitle(/Final$/)).toHaveCount(0)

    // Bring the lagging scene up to Final on its own card and the chapter reads
    // Final, with the sentence changing to match — the presence half of both
    // absences above.
    await page.getByTitle('Open chapter detail').first().click()
    await main.getByRole('button', { name: 'Closing', exact: true }).click()
    const final = main.getByRole('button', { name: 'Final', exact: true })
    await final.click()
    // Read it back rather than trusting the click: the assertion that matters is on the row.
    await expect(final).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('link', { name: /manuscript/i }).click()

    await onCards(page)
    await settleNav(page)
    const whole = main.getByTitle('Every scene is Final')
    await expect(whole).toBeVisible({ timeout: 30000 })
    await expect(whole).toHaveText('Final')
    await expect(main.getByTitle(/^Least advanced/)).toHaveCount(0)
  })
})
