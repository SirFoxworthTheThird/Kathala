import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * Part D1: the Page offers, beneath the header of the scene the caret is in,
 * whoever its prose has speaking twice or more and its header does not name —
 * the one kind of suggestion that was right often enough on the Library's books
 * to offer (`scripts/suggest-probe.ts`). One key adds them to the header, as
 * if typed, and the scene's cast is recorded; another sets them aside, and
 * they are not offered for that scene again.
 *
 * Paired throughout: a scene where somebody is named twice and never speaks
 * offers nothing, and nor does one where the speaker is in the header already.
 */

const BRUNO_SPEAKS = '“The tide is turning,” said Bruno. Ann looked at the water. “Not yet,” Bruno replied.'
const ANN_SPEAKS = '“Hold the line,” Ann cried. The rope went taut. “Now,” said Ann.'
const NAMED_ONLY = 'They thought of Bruno, who was in Lisbon. Bruno would have known the way.'
const ONCE = '“Here,” said Ann, and nobody answered.'

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Tidewater')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ({ id, scenes }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Low Water', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    let i = 0
    for (const [eid, title, text] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 10, updatedAt: now })
    }
    for (const [cid, name] of [['bruno', 'Bruno Vale'], ['ann', 'Ann Bell']]) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
  }, { id: worldId, scenes: [['e1', 'The Quay', BRUNO_SPEAKS], ['e2', 'The Rope', ANN_SPEAKS], ['e3', 'Lisbon', NAMED_ONLY], ['e4', 'Alone', ONCE]] })
  return worldId
}

async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}

/** The caret into a scene's prose, by a line of it. */
const into = (page: Page, prose: string) => page.locator('.cm-line', { hasText: prose.slice(0, 20) }).click()
const suggestion = (page: Page) => page.getByRole('group', { name: 'Suggested for this scene’s header' })
const cast = (page: Page, id: string) => page.evaluate(async (eid) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as { events: { get: (k: string) => Promise<{ involvedCharacterIds: string[] }> } }
  return (await db.events.get(eid)).involvedCharacterIds
}, id)

test('the one speaking in a scene is offered, and one key puts them in its header and its cast', async ({ page }) => {
  test.setTimeout(120_000)
  const worldId = await book(page)
  await openPage(page, worldId)

  // Named twice and never speaking: nothing offered.
  await into(page, NAMED_ONLY)
  await page.waitForTimeout(800)
  await expect(suggestion(page)).toHaveCount(0)

  // Speaking twice: offered, by the name the header writes.
  await into(page, BRUNO_SPEAKS)
  await expect(suggestion(page)).toContainText('@@Bruno Vale')
  // Ann speaks there once, by name: not offered.
  await expect(suggestion(page)).not.toContainText('Ann Bell')
  expect(await cast(page, 'e1')).toEqual([])

  await page.keyboard.press('Alt+Enter')
  await expect.poll(() => cast(page, 'e1')).toEqual(['bruno'])
  await expect(page.locator('.cm-line', { hasText: '@@Bruno Vale' })).toHaveCount(1)
  // In the header now: not offered again.
  await page.waitForTimeout(800)
  await expect(suggestion(page)).toHaveCount(0)
  // And the prose is as it was.
  await expect(page.locator('.cm-line', { hasText: BRUNO_SPEAKS.slice(0, 20) })).toHaveCount(1)
})

test('set aside, a suggestion is not offered for that scene again, and nothing is written', async ({ page }) => {
  test.setTimeout(120_000)
  const worldId = await book(page)
  await openPage(page, worldId)

  await into(page, ANN_SPEAKS)
  await expect(suggestion(page)).toContainText('@@Ann Bell')
  await suggestion(page).getByRole('button', { name: 'Not here' }).click()
  await expect(suggestion(page)).toHaveCount(0)
  expect(await cast(page, 'e2')).toEqual([])

  // After a reload too — a document loaded again, not a route gone to: the same hash is no reload — while another scene's own suggestion is still offered.
  await page.reload({ waitUntil: 'load' })
  await openPage(page, worldId)
  await into(page, ANN_SPEAKS)
  await page.waitForTimeout(800)
  await expect(suggestion(page)).toHaveCount(0)
  await into(page, BRUNO_SPEAKS)
  await expect(suggestion(page)).toContainText('@@Bruno Vale')
  // Its button takes it as the key does.
  await suggestion(page).getByRole('button', { name: 'Add to header' }).click()
  await expect.poll(() => cast(page, 'e1')).toEqual(['bruno'])
})
