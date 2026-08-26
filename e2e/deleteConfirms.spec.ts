import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * HB-2d, the half that had to come with it.
 *
 * Making hover-revealed controls tappable on a phone is only safe if what they
 * do is recoverable, and two of the seven fired on the click itself: a saved
 * scene version, and a thread or motif in the cadence panels. Behind a
 * deliberate hover that was survivable; drawn permanently on a touch device it
 * would be one stray tap from destroying a draft nothing else keeps a copy of.
 *
 * Both now ask first. Each test cancels and checks the record is still there,
 * because a confirm that appears and then deletes anyway would satisfy a test
 * that only looked for the dialog.
 */

async function worldWithAScene(page: Page) {
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
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'The Letter', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'The wreck',
      description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })
    // Two saved versions, so History has something to list.
    await db.sceneRevisions.bulkAdd([
      { id: 'rev1', worldId: id, eventId: 'ev1', text: 'The first draft of the wreck.', wordCount: 6, createdAt: now - 20_000 },
      { id: 'rev2', worldId: id, eventId: 'ev1', text: 'The second draft of the wreck.', wordCount: 6, createdAt: now - 10_000 },
    ])
  }, worldId)
  return worldId
}

const revisionCount = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as
    { sceneRevisions: { toArray: () => Promise<unknown[]> } }
  return (await db.sceneRevisions.toArray()).length
})

test.describe('Deletes that used to fire on the click now ask first', () => {
  test.describe.configure({ timeout: 240_000 })

  test('a saved scene version', async ({ page }) => {
    const worldId = await worldWithAScene(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)

    // The draft section — and its History button — live inside the expanded
    // scene, so open the row first.
    await page.getByRole('button', { name: /^Expand/ }).first().click()
    await settle(page)
    await page.getByRole('button', { name: /^History \(2\)/ }).click()
    const history = page.getByRole('dialog')
    await expect(history).toBeVisible()
    expect(await revisionCount(page)).toBe(2)

    /*
      Hover the *row*, not the control: on a desktop the delete is
      `pointer-events: none` until `group-hover` lifts it, so Playwright cannot
      hover the button itself — it is not there to be hovered yet. The point of
      this test is what the click does, not how the control is revealed.
    */
    const row = history.locator('.group').first()
    const del = page.getByRole('button', { name: 'Delete this version' }).first()
    await row.hover()
    await del.click()

    // It asks. Nothing has gone yet.
    await expect(page.getByText('Delete this version?')).toBeVisible()
    expect(await revisionCount(page)).toBe(2)

    // Backing out keeps it — the half that stops "a dialog appeared" passing
    // for a confirm that deletes regardless.
    await page.getByRole('button', { name: 'Cancel' }).click()
    await settle(page)
    expect(await revisionCount(page)).toBe(2)

    // And confirming does the thing.
    await row.hover()
    await del.click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect.poll(() => revisionCount(page)).toBe(1)
  })

  test('a plot thread in the cadence panel', async ({ page }) => {
    const worldId = await worldWithAScene(page)
    await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
    await settle(page)

    await page.getByRole('button', { name: 'New thread' }).click()
    await page.getByPlaceholder(/Thread name/).fill('The Rebellion')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('The Rebellion').first()).toBeVisible()

    // Same reason as above: hover the row, which is what lifts the gate.
    const row = page.locator('.group').filter({ hasText: 'The Rebellion' }).first()
    const del = page.getByRole('button', { name: 'Delete thread The Rebellion' }).first()
    await row.hover()
    await del.click()

    await expect(page.getByText('Delete thread?')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await settle(page)
    // Still there, because the question was declined.
    await expect(page.getByText('The Rebellion').first()).toBeVisible()
  })
})
