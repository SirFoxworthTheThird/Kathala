import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * A scene is one card, on the whole book and on its chapter.
 *
 * The whole book had a row of its own — a title, a dot, and a summary that
 * opened into a description and an "Edit in chapter detail" button — while the
 * chapter had the card. Two components for one scene looked nothing alike and
 * could not be fixed in one place. The whole book now shows the chapter's card,
 * so writing is possible from either, and what the row alone could do (the
 * cursor button, the open button, the selection box) the card does too.
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
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Low Water', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    let i = 0
    for (const title of ['The assize rises', 'Teodora at the table']) {
      i++
      await db.events.add({
        id: `e${i}`, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
    }
  }, worldId)
  return worldId
}

/** The whole book, with chapter 1 opened in the list. */
async function wholeBook(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
  await settle(page)
  const main = page.getByRole('main')
  await main.getByRole('button', { name: /^Ch\. 1 — Low Water/ }).click()
  await expect(main.getByRole('button', { name: 'Teodora at the table', exact: true })).toBeVisible()
  return main
}

const cursor = (page: Page) => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('kathala-ui') ?? '{}').state?.activeEventId ?? null } catch { return null }
})

test.describe('one scene card', () => {
  test('the whole book writes the scene in place', async ({ page }) => {
    const worldId = await book(page)
    const main = await wholeBook(page, worldId)
    const editor = main.getByPlaceholder(/Write or paste this scene/)

    // Closed, there is no editor; opened, there is one — on the whole book.
    await expect(editor).toHaveCount(0)
    await main.getByRole('button', { name: 'Teodora at the table', exact: true }).click()
    await expect(editor).toHaveCount(1)
    await expect(page).toHaveURL(/\/timeline$/)

    const prose = 'She had the table in front of her, and it had never been paid.'
    await editor.fill(prose)
    await editor.blur()
    await expect.poll(() => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        sceneTexts: { toArray: () => Promise<{ eventId: string; text: string }[]> }
      }
      return (await db.sceneTexts.toArray()).map((s) => `${s.eventId}:${s.text}`)
    }), { timeout: 15_000 }).toContain(`e2:${prose}`)
  })

  test('a card on the whole book opens its chapter', async ({ page }) => {
    const worldId = await book(page)
    const main = await wholeBook(page, worldId)
    await main.getByRole('button', { name: 'Open the chapter holding “Teodora at the table”' }).click()
    await expect(page).toHaveURL(/\/timeline\/c1$/)
  })

  test('View from here moves the cursor from a card in the open chapter', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/timeline/c1`, { waitUntil: 'load' })
    await settle(page)
    const main = page.getByRole('main')

    // Arriving puts the cursor on the chapter's first scene, so the second is
    // the one a button has to move it to.
    await expect.poll(() => cursor(page)).toBe('e1')
    await main.getByRole('button', { name: 'Teodora at the table', exact: true }).click()
    await expect.poll(() => cursor(page), 'opening a card leaves the cursor').toBe('e1')

    await main.getByRole('button', { name: 'View from here' }).click()
    await expect.poll(() => cursor(page)).toBe('e2')
    // The card's own button; the chapter's row says Viewing too, for the chapter.
    await expect(main.getByTitle('The time cursor is on this scene')).toBeDisabled()
    await expect(main.getByTitle('The time cursor is on this scene')).toHaveText('Viewing')
  })
})
