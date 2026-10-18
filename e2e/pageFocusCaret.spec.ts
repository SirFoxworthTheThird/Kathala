import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * S-1 from writer run 4: the time cursor jumped back to Ch. 1's first scene.
 *
 * The Page is focused from code — `element.focus()`, as a script does, and as
 * assistive technology can — while the selection is somewhere outside it.
 * Chromium then puts the selection at the start of the editor. CodeMirror
 * undoes that, but only when the selection arrives within 200ms of the focus,
 * and on a busy page it did not: the caret went to the top of the book, the
 * Page took that for the writer moving there, and the time cursor and the
 * chapter followed. The next keystroke would have gone into chapter 1's
 * heading. The page is kept busy here for 300ms after the focus, which is what
 * a re-render after the panel's edits did in the writer's run.
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Salt Assize')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Low Water', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c2', worldId: id, timelineId: 'tl', number: 2, title: 'High Tide', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const scenes = [['e1', 'The assize rises', 'The court sat.', 'c1'], ['e2', 'Teodora at the table', 'She counted.', 'c1'], ['e3', 'The flood', 'Water came.', 'c2']] as const
    let i = 0
    for (const [eid, title, text, cid] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: cid, timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 3, updatedAt: now })
    }
    // The foundling the book comes to call Tobias.
    await db.characters.add({ id: 'teo', worldId: id, name: 'Teodora Vance', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'fnd', worldId: id, name: 'The Foundling', description: '', aliases: ['Tobias'], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
  }, worldId)
  return worldId
}

async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}


const cursor = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('kathala-ui') ?? '{}').state?.activeEventId ?? null)

/** Focus out of the editor, the selection in the panel's text, then the editor focused from code on a busy page. */
async function focusFromCode(page: Page, busyMs: number) {
  // The panel's heading is where the selection goes, and the panel follows the caret's chapter a moment after the URL does.
  await expect(page.getByRole('heading', { name: 'The flood' })).toBeVisible()
  await page.evaluate((ms) => {
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    const heading = [...document.querySelectorAll('h1, h2, h3, h4')].find((h) => !h.closest('.cm-content') && h.textContent?.trim())!
    window.getSelection()!.collapse(heading.firstChild ?? heading, 0)
    ;(document.querySelector('.cm-content') as HTMLElement).focus()
    const until = Date.now() + ms
    while (Date.now() < until) { /* the page busy, as after a re-render */ }
  }, busyMs)
  await page.waitForTimeout(800)
}

test('the Page focused from code keeps its caret, and the time cursor stays', async ({ page }) => {
  test.setTimeout(120_000)
  const worldId = await book(page)
  await openPage(page, worldId)
  await page.locator('.cm-line', { hasText: 'Water came.' }).first().click()
  await page.keyboard.press('End')
  await expect.poll(() => cursor(page)).toBe('e3')
  await expect(page).toHaveURL(/manuscript\/c2/)

  await focusFromCode(page, 300)
  expect(await cursor(page)).toBe('e3')
  await expect(page).toHaveURL(/manuscript\/c2/)
  // And the caret is where it was: the next word goes after "Water came.", not into chapter 1's heading.
  await page.keyboard.type(' Then more.')
  await expect(page.locator('.cm-line', { hasText: 'Water came. Then more.' })).toHaveCount(1)
  await expect(page.locator('.cm-line').first()).toHaveText('# Low Water')

  // A click is the writer moving, focus or not: it still takes the cursor to the scene clicked.
  await page.locator('.cm-line', { hasText: 'The court sat.' }).first().click()
  await expect.poll(() => cursor(page)).toBe('e1')
  await expect(page).toHaveURL(/manuscript\/c1/)
})
