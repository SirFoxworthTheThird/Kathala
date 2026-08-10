import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * Chapter detail had 13 unnamed buttons out of 20. Every scene card carries the
 * same row of icons — move earlier, move later, expand, delete — and none of
 * them had an accessible name, so a screen reader announced "button, button,
 * button, button" four times over per scene.
 *
 * This asserts the property rather than the markup of any one button, so it
 * keeps holding as cards gain controls. `e2e/buttonNames.spec.ts` does the same
 * for the screens covered by the earlier pass.
 */
test.describe('Chapter detail button names', () => {
  test.describe.configure({ timeout: 120_000 })

  test('every control on a scene card says what it does and which scene', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Named')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]

    const seeded = await page.evaluate(async ({ worldId }) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<
        string,
        { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }
      >
      const now = Date.now()
      await db.timelines.add({ id: 'tl', worldId, name: 'Main', description: '', color: '#60a5fa', createdAt: now })
      await db.chapters.add({
        id: 'ch1', worldId, timelineId: 'tl', number: 1, title: 'One',
        synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
      })
      const titles = ['The letter arrives', 'Hallow End burns', '']
      await db.events.bulkAdd(titles.map((t, i) => ({
        id: `ev${i}`, worldId, chapterId: 'ch1', timelineId: 'tl', title: t, description: '',
        locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        tags: [], threadIds: [], motifIds: [], sortOrder: i, travelDays: null, inWorldTime: null,
        tension: null, structureBeat: null, status: 'draft', povCharacterId: null,
        isFlashback: false, createdAt: now, updatedAt: now,
      })))
      return titles.length
    }, { worldId })
    expect(seeded, 'the seeding seam should be present in an e2e build').toBe(3)

    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await expect(page.getByRole('button', { name: /The letter arrives/ }).first())
      .toBeVisible({ timeout: 30_000 })

    // The property: nothing in the main region is a button with no name.
    const unnamed = await page.getByRole('main').getByRole('button').evaluateAll((els) =>
      els
        .filter((e) => !(e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || '').trim())
        .map((e) => e.outerHTML.slice(0, 120)),
    )
    expect(unnamed, `unnamed buttons on chapter detail:\n${unnamed.join('\n')}`).toEqual([])

    // Named is not enough — with three scenes on the page, four buttons all
    // called "Move earlier" are no more use than four with no name at all.
    await expect(page.getByRole('button', { name: 'Move “The letter arrives” later' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Move “Hallow End burns” earlier' })).toBeVisible()
    // Delete moved behind a per-scene menu (EV-5), which has to distinguish
    // itself the same way the arrows do — and the item inside it names the
    // scene too, since that is what a screen reader reads on the way to it.
    const sceneMenu = page.getByRole('button', { name: 'More actions for “Hallow End burns”' })
    await expect(sceneMenu).toBeVisible()
    // An untitled scene still gets a name that distinguishes it from a titled one.
    await expect(page.getByRole('button', { name: 'More actions for this untitled scene' })).toBeVisible()
    await sceneMenu.click()
    await expect(page.getByRole('menuitem', { name: 'Delete scene' })).toBeVisible()
    await page.keyboard.press('Escape')
    // Including its own title button, which otherwise renders an empty span and
    // is the one card on the page a screen reader could say nothing about.
    await expect(page.getByRole('button', { name: 'Untitled scene', exact: true })).toBeVisible()

    // And the names drive the control, so they are attached to the right button:
    // the second scene moved earlier becomes the first, whose "move earlier" is
    // disabled. Vacuity cannot satisfy this and the assertions above at once.
    await expect(page.getByRole('button', { name: 'Move “The letter arrives” earlier' })).toBeDisabled()
    await page.getByRole('button', { name: 'Move “Hallow End burns” earlier' }).click()
    await expect(page.getByRole('button', { name: 'Move “Hallow End burns” earlier' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Move “The letter arrives” earlier' })).toBeEnabled()
  })

  test('the corkboard status pill is a real control, reachable and operable', async ({ page }) => {
    // Filed as CB-1 — "the status pill is not a button". It is a select with an
    // accessible name, overlaid on the pill; the original probe looked for
    // role=button and found nothing. This pins the behaviour so the finding
    // cannot be re-raised from the same measurement.
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Pinned')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]

    await page.evaluate(async ({ worldId }) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<
        string,
        { add: (v: unknown) => Promise<unknown> }
      >
      const now = Date.now()
      await db.timelines.add({ id: 'tl', worldId, name: 'Main', description: '', color: '#60a5fa', createdAt: now })
      await db.chapters.add({
        id: 'ch1', worldId, timelineId: 'tl', number: 1, title: 'One',
        synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
      })
      await db.events.add({
        id: 'ev0', worldId, chapterId: 'ch1', timelineId: 'tl', title: 'A scene', description: '',
        locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        tags: [], threadIds: [], motifIds: [], sortOrder: 0, travelDays: null, inWorldTime: null,
        tension: null, structureBeat: null, status: 'draft', povCharacterId: null,
        isFlashback: false, createdAt: now, updatedAt: now,
      })
    }, { worldId })

    await page.goto(`/#/worlds/${worldId}/corkboard`, { waitUntil: 'load' })
    const pill = page.getByLabel('Scene status').first()
    await expect(pill).toBeVisible({ timeout: 30_000 })

    // It starts as Draft, changes to Final, and the card says so.
    await expect(pill).toHaveValue('draft')
    await pill.selectOption('final')
    await expect(pill).toHaveValue('final')
    await expect(page.getByText('Final').first()).toBeVisible()

    // Reachable from the keyboard, which is the part the finding was about.
    expect(await pill.evaluate((el) => { el.focus(); return document.activeElement === el })).toBe(true)
  })
})
