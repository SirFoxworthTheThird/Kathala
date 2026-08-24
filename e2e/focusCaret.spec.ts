import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * Focus mode focused the textarea and left the caret at index 0, so the first
 * thing a writer typed went to the **top** of their own draft. Measured on a
 * 1,602-character scene: `selectionStart 0`. You enter Focus mode to carry on
 * writing, so the caret belongs where the writing stopped.
 */

const PROSE = 'The towpath was slick with the morning and Mira kept to the inside of it.'

async function sceneWithProse(page: Page): Promise<string> {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Caret World')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async ([id, prose]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'The Letter', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'The wreck',
      description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })
    await db.sceneTexts.add({
      id: 'st1', worldId: id, eventId: 'ev1', text: prose,
      wordCount: prose.split(' ').length, createdAt: now, updatedAt: now,
    })
  }, [worldId, PROSE])
  return worldId
}

test.describe('Focus mode picks up where the writing stopped', () => {
  test.describe.configure({ timeout: 180_000 })

  test('puts the caret at the end of the draft, not the top', async ({ page }) => {
    const worldId = await sceneWithProse(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await page.waitForTimeout(1500)

    await page.getByRole('button', { name: /^Expand/ }).first().click()
    await page.waitForTimeout(700)
    await page.getByRole('main').getByRole('button', { name: 'Focus' }).click()

    const focusArea = page.getByPlaceholder('Write…')
    await expect(focusArea).toBeVisible()
    await expect(focusArea).toHaveValue(PROSE)

    // The measurement the finding is about.
    const caret = await focusArea.evaluate((el) => (el as HTMLTextAreaElement).selectionStart)
    expect(caret).toBe(PROSE.length)

    // And what that means for the writer: typing continues the draft rather
    // than prepending to it. Either half alone is satisfied by the bug —
    // a caret at 0 still "focuses", and an appended value could be a fluke.
    await page.keyboard.type(' She did not stop.')
    await expect(focusArea).toHaveValue(`${PROSE} She did not stop.`)
  })
})
