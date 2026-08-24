import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * In the chapter-detail Character States panel, a cast member with no recorded
 * state at that scene rendered as "Corvin …" — measured at a 57px box holding
 * 72px of text, in a 296px column, because the italic note beside it was
 * `shrink-0` and the name was not. The name is the part you are scanning for.
 *
 * Reproduced here at the width the finding was measured at, with a name long
 * enough to need the room. A short name in a wide column fits either way, which
 * is why this is its own spec rather than an assertion bolted onto an existing
 * one — that version passed with the old layout still in place.
 */

const LONG_NAME = 'Corvin Ashe of the Marrow'

async function sceneWithUnrecordedCast(page: Page): Promise<string> {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Crush')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async ([id, name]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'corvin', worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'The seal breaks',
      description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: ['corvin'], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })
  }, [worldId, LONG_NAME])
  return worldId
}

test.describe('a cast member without state keeps their name', () => {
  test.describe.configure({ timeout: 180_000 })

  test('the name is not crushed by the note beside it', async ({ page }) => {
    // The width the finding was measured at.
    await page.setViewportSize({ width: 1024, height: 900 })
    const worldId = await sceneWithUnrecordedCast(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await page.waitForTimeout(1500)

    const row = page.locator('[data-cast-without-state="corvin"]')
    await expect(row).toBeVisible({ timeout: 20_000 })

    // Presence: the note still says what it always said.
    await expect(row.getByText('no state recorded')).toBeVisible()

    // And the measurement the finding is made of: the name fits its own box.
    const nameBox = row.locator('span.font-medium').first()
    await expect(nameBox).toHaveText(LONG_NAME)
    const { scrollWidth, clientWidth } = await nameBox.evaluate((el) => ({
      scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
    }))
    expect(scrollWidth, `name overflowed: ${scrollWidth}px of text in a ${clientWidth}px box`)
      .toBeLessThanOrEqual(clientWidth + 1)
  })
})
