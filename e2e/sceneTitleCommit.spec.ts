import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * The scene title committed on the ✓ and on nothing else.
 *
 * Enter did nothing, and moving on discarded what had been typed with no error
 * and no mark — a retitling pass measured at 34 interactions over 46s saved
 * zero titles. The chapter rename one screen up has honoured Enter and Escape
 * all along, so the writer had already been taught the gesture by the app
 * itself, a hundred pixels away.
 *
 * The three cases are here together because each is the other's control: Enter
 * writes, Escape does not, and neither of those means anything without the
 * blank case, where Enter is deliberately inert.
 */

const START = 'The wreck'

async function chapterWithAScene(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Ashcorn')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async ({ id, title }: { id: string; title: string }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'The Letter', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title,
      description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })
  }, { id: worldId, title: START })
  return worldId
}

/*
  Read the title from the database, not the page. The app's own chrome repeats
  a scene title in the time-cursor pill and along the chapter bar, so a
  page-wide text assertion would be ambiguous before it was wrong.
*/
const storedTitle = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as
    { events: { toArray: () => Promise<Array<{ title: string }>> } }
  return (await db.events.toArray())[0]?.title
})

async function openChapterAndEdit(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
  await page.waitForTimeout(1800)
  await page.getByRole('button', { name: /^Expand/ }).first().click()
  await page.waitForTimeout(900)
  await startEditing(page)
}

async function startEditing(page: Page) {
  await page.getByRole('button', { name: 'Edit title & description' }).click()
  await expect(page.getByRole('textbox', { name: 'Scene title' })).toBeVisible()
}

/** The edit session is over when the way back into it is on screen again. */
const editSessionClosed = (page: Page) =>
  expect(page.getByRole('button', { name: 'Edit title & description' })).toBeVisible()

test.describe('A scene title commits from the keyboard', () => {
  test.describe.configure({ timeout: 240_000 })

  test('Enter writes it; Escape leaves it exactly as it was', async ({ page }) => {
    const worldId = await chapterWithAScene(page)
    await openChapterAndEdit(page, worldId)

    const field = page.getByRole('textbox', { name: 'Scene title' })
    await field.fill('The gate opens')
    await field.press('Enter')

    await expect.poll(() => storedTitle(page), { timeout: 15_000 }).toBe('The gate opens')
    await editSessionClosed(page)

    // Escape is the counterpart, and it must not write. Without this half,
    // "Enter commits" is satisfied by a field that commits on every keystroke.
    await startEditing(page)
    await field.fill('A title nobody asked to keep')
    await field.press('Escape')

    await editSessionClosed(page)
    await page.waitForTimeout(1000)
    expect(await storedTitle(page)).toBe('The gate opens')
  })

  test('and Enter on a blank title is inert, like the Save button beside it', async ({ page }) => {
    const worldId = await chapterWithAScene(page)
    await openChapterAndEdit(page, worldId)

    const field = page.getByRole('textbox', { name: 'Scene title' })
    // The Save button is `disabled={!title.trim()}`, so Enter must agree with
    // it: a scene may be untitled, but it may not be blanked by pressing return
    // over a selection.
    await field.fill('   ')
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
    await field.press('Enter')

    await page.waitForTimeout(1000)
    expect(await storedTitle(page)).toBe(START)
    // Still editing — the session was not ended by a keypress that did nothing.
    await expect(field).toBeVisible()
  })
})
