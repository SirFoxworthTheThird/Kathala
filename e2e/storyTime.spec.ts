import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { downloadLibraryBook } from './helpers/library'
import { parkCursor } from './helpers/cursor'
import { settle } from './helpers/settle'

/*
  Story time against telling order (issue #703), on *Dracula*: a book told in
  letters and journals, which goes back 52 days to Lucy's letter and comes back
  to 4 November with Mina and Van Helsing at the Vampire Tombs, having left them
  at Fundu. A writer sees both, draws the path, moves through the blocks by
  keyboard and opens a scene; the Continuity Checker reports the return. A
  reader sees nothing past their place. docs/records/story-time-plan.md.
*/

const blocks = (page: Page) => page.locator('[data-block]')
const block = (page: Page, start: string) => page.locator(`[data-block][aria-label^="${start}"]`)
const summary = (page: Page) => page.getByText(/\d+ scenes · /)

async function dracula(page: Page, reading: boolean): Promise<string> {
  await resetDB(page)
  const id = await downloadLibraryBook(page, 'Dracula')
  if (!reading) await page.evaluate(async (wid) => {
    await (window as unknown as { __pwdb: { worlds: { update: (k: string, v: object) => Promise<unknown> } } }).__pwdb.worlds.update(wid, { readingMode: false })
  }, id)
  return id
}

test('a writer sees the telling jump back, a day come back to elsewhere, and opens a scene', async ({ page }) => {
  const id = await dracula(page, false)
  await page.goto(`/#/worlds/${id}/arc`)
  await settle(page)

  // The Arc opens in telling order; the switch takes it to story time, in the address.
  await page.getByRole('button', { name: 'Story time', exact: true }).click()
  await expect(page).toHaveURL(/arc\?.*time=story/)
  await expect(summary(page)).toHaveText('84 scenes · 4 jumps back · 2 returns to a day elsewhere')
  await expect(page.getByRole('button', { name: 'Days', exact: true })).toHaveAttribute('aria-pressed', 'true')

  // Lucy's letter, the 13th scene told, is set 52 days before the 12th.
  await expect(block(page, '13. Lucy Writes of Three Proposals')).toHaveAttribute('aria-label', /9 May, 1893.*Lucy Westenra, jumps back 52 days, at The Crescent/)
  await expect(block(page, '12. A Last Attempt at Escape').first()).not.toHaveAttribute('aria-label', /jumps back/)

  // Back on 4 November at the Vampire Tombs, having been left at Fundu: both of them, and not the scene before.
  const back = page.locator('[data-block][aria-label^="81. The Vampire Women Destroyed"][aria-label*="back on this day somewhere else"]')
  await expect(back).toHaveCount(2)
  await expect(back.first()).toHaveAttribute('aria-label', /4 November.*at Vampire Tombs/)
  await expect(page.locator('[data-block][aria-label^="80. "][aria-label*="back on this day somewhere else"]')).toHaveCount(0)

  // The path is drawn on request, with its steps back in time marked.
  await expect(page.getByTestId('story-time-path')).toHaveCount(0)
  await page.getByRole('button', { name: 'Path' }).click()
  await expect(page.getByTestId('story-time-path').locator('line[data-back]').first()).toBeAttached()
  expect(await page.getByTestId('story-time-path').locator('line:not([data-back])').count()).toBeGreaterThan(0)

  // One tab stop, in telling order: Home, End and the arrows.
  const first = blocks(page).first()
  await expect(first).toHaveAttribute('tabindex', '0')
  expect(await page.locator('[data-block][tabindex="0"]').count()).toBe(1)
  await first.focus()
  const focused = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '')
  await page.keyboard.press('End')
  expect(await focused()).toMatch(/^84\. /)
  await page.keyboard.press('Home')
  expect(await focused()).toMatch(/^1\. Eastward by Rail, 3 May/)
  await page.keyboard.press('ArrowRight')
  expect(await focused()).toMatch(/^2\. Warnings at Bistritz/)

  // Zoom: years is narrower than days.
  const width = () => page.getByTestId('story-time').evaluate((el) => el.scrollWidth)
  const atDays = await width()
  await page.getByRole('button', { name: 'Years', exact: true }).click()
  await expect.poll(width).toBeLessThan(atDays)

  // Lanes: Seward goes when taken off, and comes back.
  const seward = page.locator('[data-block][aria-label*=", Dr John Seward"]')
  expect(await seward.count()).toBeGreaterThan(0)
  await page.getByRole('button', { name: /^Lanes \(8 of \d+\)$/ }).click()
  await page.getByRole('checkbox', { name: /Dr John Seward/ }).uncheck()
  await expect(seward).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Lanes \(7 of \d+\)$/ })).toBeVisible()
  await page.getByRole('checkbox', { name: /Dr John Seward/ }).check()
  expect(await seward.count()).toBeGreaterThan(0)

  // Threads and POV are lanes too, and the kind carries back to the grid.
  await page.getByRole('button', { name: 'Threads', exact: true }).click()
  await expect(page).toHaveURL(/lanes=threads/)
  await expect(seward).toHaveCount(0)
  expect(await blocks(page).count()).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Telling order', exact: true }).click()
  await expect(page).not.toHaveURL(/time=story/)
  await expect(page.getByText(/\d+ threads? · \d+ ch/)).toBeVisible()
  await page.getByRole('button', { name: 'Story time', exact: true }).click()
  await page.getByRole('button', { name: 'Characters', exact: true }).click()

  // A block opens its scene.
  await block(page, '13. Lucy Writes of Three Proposals').click()
  await expect(page).toHaveURL(new RegExp(`/worlds/${id}/manuscript/dracula-chapter-5`))
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kathala-ui') ?? '{}').state?.activeEventId)).toBe('dracula-event-13')

  // The Continuity Checker reports the return.
  await page.getByTitle('Continuity Checker').click()
  const checker = page.getByRole('dialog').filter({ hasText: 'Continuity Checker' })
  await expect(checker.getByText('Back on a day somewhere else').first()).toBeVisible()

  // A scene with no date of its own is shown as undated, where the telling puts it, and counted.
  await page.keyboard.press('Escape')
  await page.evaluate(async () => {
    await (window as unknown as { __pwdb: { events: { update: (k: string, v: object) => Promise<unknown> } } }).__pwdb.events.update('dracula-event-13', { inWorldTime: null, isFlashback: true })
  })
  await page.goto(`/#/worlds/${id}/arc?time=story`)
  await settle(page)
  await expect(summary(page)).toContainText('1 undated')
  await expect(block(page, '13. Lucy Writes of Three Proposals')).toHaveAttribute('aria-label', /undated/)
  await expect(block(page, '12. A Last Attempt at Escape').first()).not.toHaveAttribute('aria-label', /undated/)
})

test('a reader sees nothing past their place', async ({ page }) => {
  const id = await dracula(page, true)
  await page.goto(`/#/worlds/${id}/arc?time=story`)
  await parkCursor(page, 'dracula-event-13')
  await settle(page)

  await expect(summary(page)).toHaveText('13 scenes · 1 jump back')
  await expect(block(page, '13. Lucy Writes of Three Proposals')).toHaveAttribute('aria-label', /jumps back 52 days/)
  await expect(page.locator('[data-block][aria-label^="14. "]')).toHaveCount(0)
  // Seward is first on stage in the 14th scene: no lane for him yet.
  await expect(page.locator('[data-block][aria-label*=", Dr John Seward"]')).toHaveCount(0)

  // One scene on, the 14th and Seward are there.
  await parkCursor(page, 'dracula-event-14')
  await settle(page)
  await expect(summary(page)).toHaveText('14 scenes · 1 jump back')
  await expect(page.locator('[data-block][aria-label^="14. Seward Turns to Renfield"][aria-label*=", Dr John Seward"]')).toHaveCount(1)
})
