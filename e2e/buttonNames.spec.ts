import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * Every visible control announces itself.
 *
 * An icon-only button with no text, `aria-label` or `title` is announced as
 * just "button". The chapter row's delete control was one, and **PH-4** called
 * it "the only nameless control on the entire timeline screen" — which was not
 * true when it was written. Expand a chapter and every scene row brings three
 * more: move earlier, move later, delete. The sweep could not see them because
 * it built a world with no scenes at all, so no row ever rendered and
 * `toEqual([])` could not fail on that class (**WRUN-6**).
 *
 * Hence the second test. A sweep that only visits the state it was written for
 * is a sweep that certifies its own blind spot.
 */
test.describe('Button names', () => {
  test.describe.configure({ timeout: 180_000 })

  /** Visible controls carrying no accessible name at all. */
  async function nameless(page: Page): Promise<string[]> {
    return page.locator('button, [role="button"]').evaluateAll((els) =>
      els
        .filter((e) => {
          const r = e.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) return false
          return (e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || '').trim() === ''
        })
        .map((e) => {
          const r = e.getBoundingClientRect()
          return `${Math.round(r.width)}x${Math.round(r.height)} at ${Math.round(r.x)},${Math.round(r.y)} — ${e.className.toString().slice(0, 60)}`
        }))
  }

  test('the timeline and its chapter rows', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Named')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    await page.getByRole('link', { name: /timeline/i }).click()
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('The Vanishing Glass')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await expect(page.getByText('The Vanishing Glass').first()).toBeVisible()

    // The control that prompted this: destructive, and previously anonymous.
    // It sits behind a per-row menu now (TL-3), which has to carry a name of
    // its own — one saying which row it acts on.
    const menu = page.getByRole('button', { name: 'More actions for chapter 1' })
    await expect(menu).toBeVisible()
    await menu.click()
    await expect(page.getByRole('menuitem', { name: /delete chapter/i })).toBeVisible()
    await page.keyboard.press('Escape')

    const bad = await nameless(page)
    expect(bad, `controls announcing only "button":\n${bad.join('\n')}`).toEqual([])
  })

  test('and the scene rows inside an expanded chapter', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Named')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]

    // Seeded rather than clicked through: this test is about what a scene row
    // renders, and three scenes make the move-earlier and move-later controls
    // reachable rather than disabled at both ends of a list of one.
    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }>
      const now = Date.now()
      await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
      await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'The Vanishing Glass', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      await db.events.bulkAdd(['The snake speaks', 'A letter for Harry', 'The hut on the rock'].map((title, i) => ({
        id: `ev${i + 1}`, worldId: id, chapterId: 'ch1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [],
        involvedItemIds: [], threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
        structureBeat: null, status: 'draft', povCharacterId: null, tension: null, isFlashback: false,
        createdAt: now, updatedAt: now,
      })))
    }, worldId)

    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await page.waitForTimeout(1500)
    await page.getByRole('main').getByRole('button', { name: /^Ch\. 1/ }).first().click()

    // The rows are open — checked before sweeping, because a sweep of a screen
    // that never rendered them is exactly the hole this test exists to close.
    await expect(page.getByRole('button', { name: 'Move The snake speaks later' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete A letter for Harry' })).toBeVisible()

    const bad = await nameless(page)
    expect(bad, `controls announcing only "button":\n${bad.join('\n')}`).toEqual([])
  })
})
