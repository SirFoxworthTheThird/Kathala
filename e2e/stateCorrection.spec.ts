import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * The panel that takes the answer takes a correction too.
 *
 * A row *with* a state recorded was an inert `<div>` — no role, no tabindex, no
 * handler, and nothing anywhere in the panel to press. A writer whose character
 * had been placed with no location paid seven interactions across three screens
 * to fix it: Timeline → expand → expand → View from here → Characters → the
 * person → Current State → pick → Save. That is the exact cost `quickState.ts`
 * was built to remove; it removed it for *recording* and left it for *fixing*,
 * and fixing is what you do more of.
 *
 * In a browser because the whole finding is whether a control exists on screen.
 */
test.describe('a recorded state can be corrected where it is shown', () => {
  test.describe.configure({ timeout: 240_000 })

  test('from the same panel, keeping the note that was already there', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Corrections')
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
      await db.characters.add({ id: 'marn', worldId: id, name: 'Isko Marn', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
      await db.mapLayers.add({ id: 'l1', worldId: id, parentMapId: null, name: 'Station', description: '', imageId: null, imageWidth: 1000, imageHeight: 1000, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: null, levelLabel: null, createdAt: now, updatedAt: now })
      await db.locationMarkers.add({ id: 'bay', worldId: id, mapLayerId: 'l1', linkedMapLayerId: null, name: 'Bay Nineteen', description: '', x: 10, y: 10, imageId: null, iconType: 'building', tags: [], factionId: null, createdAt: now, updatedAt: now })
      await db.events.add({
        id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'The Body', description: '',
        locationMarkerId: null, involvedCharacterIds: ['marn'], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], tags: [], sortOrder: 0, travelDays: null, inWorldTime: null,
        tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false,
        createdAt: now, updatedAt: now,
      })
      // Recorded, and recorded wrong: no location, but carrying a note that
      // must survive the correction.
      await db.characterSnapshots.add({
        id: 's1', worldId: id, characterId: 'marn', eventId: 'ev1', isAlive: true,
        currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [],
        inventoryNotes: '', statusNotes: 'still holding the retainer', travelModeId: null,
        sortKey: 1, createdAt: now, updatedAt: now,
      })
    }, worldId)

    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)

    const edit = page.getByRole('button', { name: /Change Isko Marn's state in this scene/ })
    await expect(edit).toBeVisible({ timeout: 20_000 })
    await edit.click()

    /*
      The note is the trap. `draftFromSnapshot` deliberately blanks it when the
      state is carried forward from an earlier scene — right for recording, and
      silent deletion when the same form is reused to edit a record written
      here. It must arrive filled in.
    */
    // `exact`, because the chapter's own "Writer's notes for this chapter"
    // textarea is on the same screen and matches a loose /Note/i.
    await expect(page.getByRole('textbox', { name: 'Note', exact: true }))
      .toHaveValue('still holding the retainer')

    /*
      The field is labelled "Where", and a `SelectTrigger` inside a `Field`
      names itself by both the label and its own content — so the trigger
      announces "Where Unknown / not set" until something is chosen.
    */
    await page.getByRole('button', { name: /^Where / }).click()
    await page.getByRole('option', { name: 'Bay Nineteen' }).click()
    // Wait for the listbox to close before pressing Save — its overlay is still
    // up for a beat, and a click that lands on it is swallowed silently.
    await expect(page.getByRole('button', { name: 'Where Bay Nineteen' })).toBeVisible()

    await page.getByRole('button', { name: 'Record state' }).click()
    await expect(page.getByRole('button', { name: 'Record state' })).toHaveCount(0)

    // The correction landed, and the note came through with it. Scoped to the
    // card, since the form's own trigger carried the same words a moment ago.
    await expect(edit).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('main').getByText('Bay Nineteen', { exact: true })).toBeVisible()
    const kept = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { get: (id: string) => Promise<{ statusNotes: string; currentLocationMarkerId: string | null }> }>
      return db.characterSnapshots.get('s1')
    })
    expect(kept.statusNotes).toBe('still holding the retainer')
    expect(kept.currentLocationMarkerId).toBe('bay')
  })

  test('but a reader is offered no such control', async ({ page }) => {
    // The pair. Reading mode makes this panel a readout, so the affordance the
    // test above requires must be absent — otherwise "it is a button" is being
    // asserted about a screen where it is always a button.
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Reader')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    await dismissFirstRunGuide(page)

    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { add: (v: unknown) => Promise<unknown>; update: (id: string, v: unknown) => Promise<unknown> }>
      const now = Date.now()
      await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
      await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      await db.characters.add({ id: 'marn', worldId: id, name: 'Isko Marn', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
      await db.events.add({
        id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'The Body', description: '',
        locationMarkerId: null, involvedCharacterIds: ['marn'], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], tags: [], sortOrder: 0, travelDays: null, inWorldTime: null,
        tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false,
        createdAt: now, updatedAt: now,
      })
      await db.characterSnapshots.add({
        id: 's1', worldId: id, characterId: 'marn', eventId: 'ev1', isAlive: true,
        currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [],
        inventoryNotes: '', statusNotes: 'still holding the retainer', travelModeId: null,
        sortKey: 1, createdAt: now, updatedAt: now,
      })
      await db.worlds.update(id, { readingMode: true })
    }, worldId)

    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)

    await expect(page.getByRole('main').getByText('Isko Marn').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /Change Isko Marn's state in this scene/ })).toHaveCount(0)
  })
})
