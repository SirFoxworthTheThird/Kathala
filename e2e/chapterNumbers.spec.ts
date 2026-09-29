import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * A chapter's number is chosen, not assigned.
 *
 * It is suggested — one past the highest — and the writer may type any. A taken
 * number puts the chapter there and moves the rest up; the dialog says which
 * before anything is written. The chapters here are numbered 1, 2 and **4**, so
 * the suggestion (5) and the old rule, one past the count (4, taken), disagree.
 *
 * The plan and the write are tested without a browser, in `chapterNumbering`
 * and `createChapterAt`. What only a browser can say is whether the dialog shows
 * the writer the truth before they commit to it.
 */
async function timelineOf124(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Numbers')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    for (const [cid, n, t] of [['c1', 1, 'Low Water'], ['c2', 2, 'The Stair'], ['c4', 4, 'The Verdict']] as const) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: 'tl', number: n, title: t, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }
  }, worldId)
  return worldId
}

const numbering = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as
    { chapters: { toArray: () => Promise<Array<{ number: number; title: string }>> } }
  return (await db.chapters.toArray()).sort((a, b) => a.number - b.number).map((c) => `${c.number}:${c.title}`)
})

test.describe('choosing a chapter number', () => {
  test.describe.configure({ timeout: 240_000 })

  test('the dialog suggests the next free number and says what a taken one moves', async ({ page }) => {
    const worldId = await timelineOf124(page)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)

    await page.getByRole('main').getByRole('button', { name: 'Add Chapter' }).first().click()
    const dialog = page.getByRole('dialog')
    const number = dialog.getByLabel('Number')
    const note = dialog.locator('#chapter-number-note')

    // One past the highest — not one past the count, which is 4 and taken.
    await expect(number).toHaveValue('5')
    await expect(note).toHaveText('The next free number.')

    // A taken number is not an error; it is said before it happens.
    await number.fill('2')
    await expect(note).toHaveText('Goes in at 2. Chapter 2 becomes 3.')

    // Not a number a chapter can have: said, and the dialog will not take it.
    await number.fill('2.5')
    await expect(note).toHaveText('A whole number — 0 for a prologue.')
    await dialog.getByLabel('Title').fill('The Clerk')
    await expect(dialog.getByRole('button', { name: 'Add Chapter' })).toBeDisabled()

    await number.fill('2')
    await expect(dialog.getByRole('button', { name: 'Add Chapter' })).toBeEnabled()
    await dialog.getByRole('button', { name: 'Add Chapter' }).click()

    await expect.poll(() => numbering(page), { timeout: 15_000 })
      .toEqual(['1:Low Water', '2:The Clerk', '3:The Stair', '4:The Verdict'])
  })

  test('the suggestion keeps up with chapters that arrive while the dialog is open, until the writer types one', async ({ page }) => {
    const worldId = await timelineOf124(page)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'Add Chapter' }).first().click()
    const dialog = page.getByRole('dialog')
    const number = dialog.getByLabel('Number')
    await expect(number).toHaveValue('5')

    // A chapter lands after the dialog opened — as one does when the page is
    // still loading, or straight after the last chapter was added.
    const land = (id: string, n: number, title: string) => page.evaluate(async ([cid, num, t, wid]) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { chapters: { add: (v: unknown) => Promise<unknown> } }
      const now = Date.now()
      await db.chapters.add({ id: cid, worldId: wid, timelineId: 'tl', number: num, title: t, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }, [id, n, title, worldId] as const)
    await land('c5', 5, 'The Appeal')
    await expect(number).toHaveValue('6')
    await expect(dialog.locator('#chapter-number-note')).toHaveText('The next free number.')

    // Once the writer has typed a number it is theirs, and a chapter landing does not change it.
    await number.fill('3')
    await land('c6', 6, 'The Sentence')
    await page.waitForTimeout(500)
    await expect(number).toHaveValue('3')
  })

  test('a free number moves nobody', async ({ page }) => {
    const worldId = await timelineOf124(page)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)

    await page.getByRole('main').getByRole('button', { name: 'Add Chapter' }).first().click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Number').fill('3')
    await expect(dialog.locator('#chapter-number-note')).toHaveText('Goes in at 3.')
    await dialog.getByLabel('Title').fill('Between')
    await dialog.getByRole('button', { name: 'Add Chapter' }).click()

    await expect.poll(() => numbering(page), { timeout: 15_000 })
      .toEqual(['1:Low Water', '2:The Stair', '3:Between', '4:The Verdict'])
  })
})
