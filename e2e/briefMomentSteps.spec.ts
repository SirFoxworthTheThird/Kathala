import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * WRUN-12. The Writer's Brief is a reference panel *about a moment*, and had no
 * way to change that moment.
 *
 * The panel is modal — a `w-80` dialog over a dismissing backdrop — so while it
 * is open the time cursor's own controls are inert. Its scene rows were `<li>`s
 * with no handler, listed and chevroned and highlighting the active one, and
 * its whole-world picker rendered only while there was *no* cursor. So reading a
 * run of scenes meant close, step, reopen: the run measured **17 interactions
 * for six scenes** where six would do.
 *
 * Deliberately *not* fixed by making the panel non-modal. That would touch a
 * pattern shared by a dozen screens, and would still have to stay modal on a
 * phone where the panel is 92vw. The panel walks the book itself instead.
 *
 * Both tests count interactions, because the finding was a cost and a fix that
 * did not lower it would not be a fix.
 */

const BRIEF = "Writer's Brief"

async function threeChapterWorld(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Salt')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.bulkAdd([1, 2].map((n) => ({
      id: `ch${n}`, worldId: id, timelineId: 'tl', number: n, title: `Chapter ${n}`,
      synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
    })))
    // Two scenes per chapter, so the walk crosses a boundary — the case that
    // used to force the close/step/reopen.
    const scenes: [string, string, number][] = [
      ['ev1', 'ch1', 0], ['ev2', 'ch1', 1], ['ev3', 'ch2', 0], ['ev4', 'ch2', 1],
    ]
    await db.events.bulkAdd(scenes.map(([eid, chapterId, sortOrder], i) => ({
      id: eid, worldId: id, chapterId, timelineId: 'tl', title: `Scene ${i + 1}`,
      description: '', sortOrder, tags: [], locationMarkerId: null,
      involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })))
  }, worldId)

  await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
  await settle(page)
  return worldId
}

const brief = (page: Page) => page.getByRole('dialog', { name: BRIEF })

/** Which scene the brief says it is describing. */
async function briefScene(page: Page) {
  const current = brief(page).locator('[aria-current="true"]')
  return (await current.first().innerText()).replace(/\s+/g, ' ').trim()
}

test.describe('The Writer’s Brief can walk the book without being closed', () => {
  test.describe.configure({ timeout: 240_000 })

  test('its own controls step the cursor across a chapter boundary', async ({ page }) => {
    await threeChapterWorld(page)

    // One open…
    await page.getByTitle(BRIEF).click()
    await expect(brief(page)).toBeVisible()
    // Scoped to the dialog: the chapter bar carries a tick titled with each
    // scene, and while the brief is open the backdrop makes it unclickable —
    // which is the finding itself.
    await brief(page).getByRole('button', { name: 'Scene 1' }).click()
    await expect.poll(() => briefScene(page)).toContain('Scene 1')

    // …then three steps, the third of which crosses from Ch.1 into Ch.2.
    for (const expected of ['Scene 2', 'Scene 3', 'Scene 4']) {
      await brief(page).getByRole('button', { name: 'Next moment' }).click()
      await expect.poll(() => briefScene(page)).toContain(expected)
      // The point of the finding: the panel never closed to do it.
      await expect(brief(page)).toBeVisible()
    }

    // And back the way it came.
    await brief(page).getByRole('button', { name: 'Previous moment' }).click()
    await expect.poll(() => briefScene(page)).toContain('Scene 3')
    await expect(brief(page)).toBeVisible()
  })

  test('the scene rows are controls, and the ends of the book are quiet', async ({ page }) => {
    await threeChapterWorld(page)
    await page.getByTitle(BRIEF).click()
    await expect(brief(page)).toBeVisible()

    // The rows looked like controls and did nothing. Clicking one moves the
    // cursor, which is what the chevron was promising.
    await brief(page).getByRole('button', { name: 'Scene 3' }).click()
    await expect.poll(() => briefScene(page)).toContain('Scene 3')

    // Within the chapter, its sibling is listed and also clickable.
    await brief(page).getByRole('button', { name: 'Scene 4' }).click()
    await expect.poll(() => briefScene(page)).toContain('Scene 4')

    // At the last moment of the book there is nowhere further to go, and the
    // control says so rather than doing nothing when pressed.
    await expect(brief(page).getByRole('button', { name: 'Next moment' })).toBeDisabled()
    await expect(brief(page).getByRole('button', { name: 'Previous moment' })).toBeEnabled()
  })
})
