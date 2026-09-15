import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * A reader can set the type, and it stays set.
 *
 * The model is unit-tested in `src/lib/__tests__/readingType.test.ts` — the
 * ladder, the clamping, the repair of a stored value from an older build. What
 * needs a browser is the half that arithmetic cannot answer: whether the chosen
 * setting actually reaches the paragraphs, whether it survives a reload, and
 * whether it stays out of the author's way on the draft screen.
 */

const prose = (page: Page) => page.locator('[data-scene-event-id] p').first()
const controls = (page: Page) => page.getByRole('group', { name: 'How the book is set' })

async function openBook(page: Page) {
  await page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Read', exact: true }).click()
  await settle(page)
}

/** What the prose is actually set in, as the browser resolves it. */
const setIn = (page: Page) => prose(page).evaluate((el) => {
  const s = getComputedStyle(el.parentElement as HTMLElement)
  return { fontSize: s.fontSize, lineHeight: s.lineHeight, fontFamily: s.fontFamily }
})

test.beforeEach(async ({ page }) => { await resetDB(page) })

test('the reader can make the book bigger, and it reaches the prose', async ({ page }) => {
  await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page)

  await expect(controls(page)).toBeVisible()
  const before = await setIn(page)
  expect(before.fontSize, 'the default is the size the screen always used').toBe('15px')

  await page.getByRole('button', { name: 'Larger text' }).click()
  await page.getByRole('button', { name: 'Larger text' }).click()
  await expect.poll(async () => (await setIn(page)).fontSize).toBe('19px')

  await page.getByRole('button', { name: 'Smaller text' }).click()
  await expect.poll(async () => (await setIn(page)).fontSize).toBe('17px')
})

test('the ladder stops at both ends rather than pretending to go on', async ({ page }) => {
  await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page)

  // At the smallest, which is where it starts.
  await expect(page.getByRole('button', { name: 'Smaller text' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Larger text' })).toBeEnabled()

  // Click only while it is still offered. Clicking a disabled button does not
  // fail fast — Playwright waits for it to become enabled and times out, which
  // is what the first version of this did.
  const larger = page.getByRole('button', { name: 'Larger text' })
  for (let i = 0; i < 8 && await larger.isEnabled(); i += 1) await larger.click()
  await expect(page.getByRole('button', { name: 'Larger text' })).toBeDisabled()
  await expect.poll(async () => (await setIn(page)).fontSize).toBe('26px')
})

test('the face and the spacing are the reader’s, and all of it survives a reload', async ({ page }) => {
  await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page)

  const themeFace = (await setIn(page)).fontFamily
  await page.getByRole('button', { name: 'Sans' }).click()
  await page.getByRole('button', { name: 'Airy' }).click()
  await page.getByRole('button', { name: 'Larger text' }).click()

  const chosen = await setIn(page)
  expect(chosen.fontFamily, 'the sans face overruled the theme’s').not.toBe(themeFace)
  expect(chosen.fontFamily).toContain('sans-serif')
  expect(chosen.fontSize).toBe('17px')
  // 17px at the airy leading of 1.9.
  expect(Math.round(parseFloat(chosen.lineHeight))).toBe(Math.round(17 * 1.9))

  await page.reload({ waitUntil: 'load' })
  await settle(page)
  await openBook(page)
  expect(await setIn(page), 'the reader is not asked to set it again').toEqual(chosen)

  // And it is the reader's, not the book's: a different book opens the same way.
  await downloadLibraryBook(page, 'The Turn of the Screw')
  await settle(page)
  await openBook(page)
  expect((await setIn(page)).fontSize).toBe('17px')
})

test('a writer drafting the same manuscript keeps the fixed setting', async ({ page }) => {
  /*
    The absence beside the presences, on the same book with the same prose —
    an empty world would have no paragraphs to measure and would pass however
    the condition were written.

    The draft screen is where an author judges line lengths and scene sizes, and
    a reader's preference silently resetting that is the author's tool changing
    under them.
  */
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page)
  await page.getByRole('button', { name: 'Larger text' }).click()
  await page.getByRole('button', { name: 'Larger text' }).click()
  await expect.poll(async () => (await setIn(page)).fontSize).toBe('19px')

  await page.evaluate(async (id) => {
    const db = (window as unknown as { __pwdb?: {
      worlds: { update: (id: string, changes: Record<string, unknown>) => Promise<number> }
    } }).__pwdb
    await db!.worlds.update(id, { readingMode: false })
  }, worldId)
  await page.reload({ waitUntil: 'load' })
  await settle(page)
  await page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Manuscript', exact: true }).click()
  await settle(page)

  await expect(page.locator('[data-scene-event-id]').first(), 'the same prose').toBeVisible()
  await expect(controls(page), 'no reader controls while drafting').toHaveCount(0)
  expect((await setIn(page)).fontSize, 'and the draft is set as it always was').toBe('15px')
})
