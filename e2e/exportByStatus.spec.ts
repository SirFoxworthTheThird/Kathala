import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * Sending a draft out without the scenes that are not ready.
 *
 * The compile could already drop scenes with no prose; it could not drop
 * scenes that had prose the writer did not want read yet. The filtering itself
 * is unit-tested on all four compilers — what needs a browser is that the
 * control exists, that the preview obeys it, and that the default is still the
 * whole draft for anybody who never opens the menu.
 */
test.describe('exporting only the scenes that are ready', () => {
  test.describe.configure({ timeout: 240_000 })

  test('the preview drops the unready scenes, and keeps them by default', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Submission')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    await dismissFirstRunGuide(page)

    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
      await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      // Two scenes with prose, at opposite ends of the progression.
      for (const [evId, title, status] of [['e1', 'Polished', 'final'], ['e2', 'Rough', 'draft']] as const) {
        await db.events.add({
          id: evId, worldId: id, chapterId: 'ch1', timelineId: 'tl', title, description: '',
          locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
          threadIds: [], motifIds: [], tags: [], sortOrder: evId === 'e1' ? 0 : 1, travelDays: null,
          inWorldTime: null, tension: null, structureBeat: null, status, povCharacterId: null,
          isFlashback: false, createdAt: now, updatedAt: now,
        })
      }
      await db.sceneTexts.add({ id: 'st1', worldId: id, eventId: 'e1', text: 'Polished prose here.', wordCount: 3, createdAt: now, updatedAt: now })
      await db.sceneTexts.add({ id: 'st2', worldId: id, eventId: 'e2', text: 'Unready prose here.', wordCount: 3, createdAt: now, updatedAt: now })
    }, worldId)

    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)

    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 20_000 })

    /*
      The counts beside the button describe *this export*, not the book — so
      they are what the filter is observable through, and asserting on them is
      asserting the thing a writer actually reads before pressing Download.

      Default first, and it is the half that matters most: an export nobody
      configured is the whole written draft, exactly as before this existed.
    */
    const extent = dialog.locator('[data-export-extent]')
    await expect(extent).toContainText('2 scenes')
    await expect(extent).toContainText('6 words')

    await dialog.getByRole('button', { name: /^Scenes to include/ }).click()
    await page.getByRole('option', { name: 'Final only', exact: true }).click()
    await expect(extent).toContainText('1 scene')
    await expect(extent).toContainText('3 words')

    // And back again, so the control is a filter rather than a one-way door.
    await dialog.getByRole('button', { name: /^Scenes to include/ }).click()
    await page.getByRole('option', { name: 'Every scene', exact: true }).click()
    await expect(extent).toContainText('2 scenes')
  })
})
