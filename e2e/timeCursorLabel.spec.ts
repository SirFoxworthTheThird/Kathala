import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * F-5. On a 360px phone the time cursor rendered **no text at all** — a bare
 * clock glyph where the chapter number should be. Measured on the built app
 * with the cursor on Ch.4, the label box was 0px of the 30px it needed at 360,
 * 15/30 at 320, 25/30 at 390, and only whole at 414.
 *
 * The cause was not a squeeze that got worse as the screen narrowed — the
 * numbers are not monotonic, and that is the tell. Two things *arrived* at
 * `min-[360px]`: the decorative clock inside the pill and the clear-cursor X
 * beside it. Both are `shrink-0`, the pill is the only thing in this header
 * that can give, so at exactly 360 the label paid for both. At 320 they were
 * absent and the label kept 15px.
 *
 * **PH-2** enlarged the steppers in this bar and is what makes the header tight
 * enough for this to matter; nothing here shrinks them back.
 */

/*
  A two-digit chapter, deliberately. "Ch.4" is 30px and fits in every layout
  this test could plausibly produce, so a fixture using it would pass against a
  fix that only just works. "Ch.12" is 39px, and most books have more than nine
  chapters.
*/
const TWO_DIGIT = 12
const ONE_DIGIT = 4

async function worldAtAMoment(page: Page, chapterNumber: number) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Ashcorn')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async ({ id, number }: { id: string; number: number }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number, title: 'The Letter', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'The wreck',
      description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })
  }, { id: worldId, number: chapterNumber })

  await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
  await page.waitForTimeout(2000)
  // From "all chapters", stepping forward lands on the first moment.
  await page.getByRole('button', { name: 'Next moment' }).click()
  await page.waitForTimeout(1000)
}

/**
 * How much of the label is actually laid out.
 *
 * Measured on the label box rather than asserted on text, because the text is
 * in the DOM either way — `truncate` clips it, it does not remove it, and a
 * `toHaveText` would have passed against the bug this test is about. The box is
 * the pill's first `span`, blockified by the pill's own `display: flex`, which
 * is what makes `clientWidth` meaningful on it at all.
 *
 * Reached by its `title` rather than by role name: the pill takes its
 * accessible name from its own text, so `getByRole('button', { name: /open
 * timeline/ })` — the obvious spelling — matches nothing at all.
 */
const pillSelector = 'header button[title*="open timeline"]'

const labelBox = (page: Page) =>
  page.locator(pillSelector).locator('span').first()
    .evaluate((el) => ({ shown: el.clientWidth, needed: el.scrollWidth, text: (el.textContent ?? '').trim() }))

const headerOverflow = (page: Page) =>
  page.locator('header').evaluate((el) => el.scrollWidth - el.clientWidth)

test.describe('The time cursor says which chapter you are in, at phone widths', () => {
  test.describe.configure({ timeout: 240_000 })

  for (const width of [360, 390, 414]) {
    test(`the whole label is laid out at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 780 })
      await worldAtAMoment(page, TWO_DIGIT)

      const box = await labelBox(page)
      expect(box.text, 'the pill should be showing this chapter').toContain(`Ch.${TWO_DIGIT}`)
      expect(box.needed, 'a two-digit chapter should need more room than a one-digit one')
        .toBeGreaterThan(30)
      expect(box.shown, `${box.shown}px laid out of the ${box.needed}px "Ch.${TWO_DIGIT}" needs`)
        .toBeGreaterThanOrEqual(box.needed)

      // And the room came from padding, not from pushing the header off screen.
      expect(await headerOverflow(page), 'the header must not scroll sideways').toBeLessThanOrEqual(1)
    })
  }

  /**
   * 320px, where the padding is the whole of the fix.
   *
   * The three breakpoint-scoped trims — the pill's `px-2`→`px-1.5`, the
   * header's `px-3`→`px-2`, the left group's `gap-1.5`→`gap-1` — buy 12px, and
   * at 360 and up the clock leaving already covers the need, so *this* is the
   * width that holds them to account. Reverting any one of the three failed
   * nothing until this test existed, which made three shipped changes that no
   * test defended and a code comment claiming they were needed.
   *
   * A one-digit chapter, because that is what actually fits here: at 320 a
   * two-digit label still lands 33px of the 39 it wants, and the review says so
   * rather than this test pretending otherwise.
   */
  test('a one-digit chapter is whole at 320px, the narrowest width the app supports', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 })
    await worldAtAMoment(page, ONE_DIGIT)

    const box = await labelBox(page)
    expect(box.text).toContain(`Ch.${ONE_DIGIT}`)
    expect(box.shown, `${box.shown}px laid out of the ${box.needed}px "Ch.${ONE_DIGIT}" needs`)
      .toBeGreaterThanOrEqual(box.needed)
    expect(await headerOverflow(page), 'the header must not scroll sideways').toBeLessThanOrEqual(1)
  })

  /**
   * The presence half, and the boundary itself.
   *
   * Without this, "hide everything on a phone" would pass the three tests above
   * — and it is not the fix. The clock comes back when the header has room for
   * it, and the clear-cursor X is deliberately kept at 390, where
   * `e2e/touchTargets.spec.ts` asserts it is present and clear of "next
   * moment". 360 is where it stopped being affordable, not where it stopped
   * being wanted.
   */
  test('the decoration comes back when there is room, and the X keeps its 390 floor', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await worldAtAMoment(page, TWO_DIGIT)

    const pill = page.locator(pillSelector)
    const clock = pill.locator('svg')
    const clearCursor = page.getByRole('button', { name: 'View all chapters' })

    // At 360: no clock, no X — the label has the pill to itself.
    await expect(clock).toBeHidden()
    await expect(clearCursor).toBeHidden()

    // At 390 the X is back, which is the width the touch-target spec pins.
    await page.setViewportSize({ width: 390, height: 780 })
    await page.waitForTimeout(400)
    await expect(clearCursor).toBeVisible()
    await expect(clock, 'the clock is decoration and stays out until sm').toBeHidden()

    // At desktop width both are shown, and the label is still whole.
    await page.setViewportSize({ width: 1280, height: 780 })
    await page.waitForTimeout(400)
    await expect(clock).toBeVisible()
    await expect(clearCursor).toBeVisible()
    const box = await labelBox(page)
    expect(box.shown).toBeGreaterThanOrEqual(box.needed)
    expect(box.text, 'the scene title joins the chapter number when there is room')
      .toContain('The wreck')
  })
})
