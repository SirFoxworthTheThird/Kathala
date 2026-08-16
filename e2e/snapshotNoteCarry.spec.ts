import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { waitForMapReady, sidebarSection } from './helpers/map'
import path from 'path'
import { fileURLToPath } from 'url'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

/**
 * W-1. The map's character panel showed a status note one edit behind.
 *
 * The panel holds its text in local state so typing does not fight the cursor,
 * and re-read it whenever the character or the moment changed. But the record
 * comes from a `useLiveQuery` keyed on that same moment, and it resolves a tick
 * *later* — so stepping the cursor re-read the **outgoing** record and never
 * ran again once the right one arrived. Since the textarea saves on blur, the
 * next blur wrote the previous scene's note into the new scene: prose in the
 * store the writer never typed, in exactly the order writing happens.
 *
 * Two things are needed to see it, and a test missing either one passes with
 * the fix taken out — this spec did, until a mutation caught it:
 *
 * 1. **Two edits.** One edit behind is only visible once there is a previous
 *    edit to be behind.
 * 2. **The blur and the step must be the same gesture** — typing, then clicking
 *    straight on *Next moment*. Tab out first and the save lands before the
 *    cursor moves, so the record the panel is still holding already has the new
 *    text in it and the stale read returns the right answer by luck.
 */

const STATUS = 'What is this character doing in this scene?'

async function worldWithACharacterOnAMap(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Salt')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
  await page.mouse.move(900, 500)
  await page.getByRole('button', { name: 'Upload Map' }).first().click()
  await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
  await page.getByLabel('Map Name').clear()
  await page.getByLabel('Map Name').fill('The Reach')
  await page.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 60_000 })
  await page.waitForTimeout(1500)

  await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'The Letter', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.characters.add({
      id: 'rhun', worldId: id, name: 'Rhun Aldemar', aliases: [], description: '',
      portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: now, updatedAt: now,
    })
    await db.events.bulkAdd([['ev1', 'Rhun finds the letter'], ['ev2', 'Ysolde lies to the harbourmaster']].map(([eid, title], i) => ({
      id: eid, worldId: id, chapterId: 'ch1', timelineId: 'tl', title, description: '', sortOrder: i,
      tags: [], locationMarkerId: null, involvedCharacterIds: ['rhun'], mentionedCharacterIds: [],
      involvedItemIds: [], threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null, isFlashback: false,
      createdAt: now, updatedAt: now,
    })))
  }, worldId)

  await page.reload({ waitUntil: 'load' })
  await waitForMapReady(page)
  await page.waitForTimeout(2000)

  // Park the cursor on the first scene, then open Rhun's panel from the sidebar.
  await page.getByTitle('Rhun finds the letter', { exact: true }).first().click()
  await page.waitForTimeout(800)
  // Characters ships open, so click it only if it is not — clicking regardless
  // closes the section and the row never appears.
  const section = sidebarSection(page, 'Characters')
  if ((await section.getAttribute('aria-expanded')) === 'false') await section.click()
  await page.getByRole('button', { name: 'Rhun Aldemar' }).first().click()
  await expect(page.getByPlaceholder(STATUS)).toBeVisible({ timeout: 15_000 })
  return worldId
}

/** Type into Status and commit it the way the writer does — by leaving the box. */
async function writeStatus(page: Page, text: string) {
  const box = page.getByPlaceholder(STATUS)
  await box.click()
  await box.fill(text)
  // Tab out: the save is on blur, and leaving the field is how a writer commits
  // it. Clicking some other element would work too, but ties the test to the
  // panel's layout.
  await box.press('Tab')
  await page.waitForTimeout(700)
}

const step = async (page: Page, dir: 'Next moment' | 'Previous moment') => {
  await page.getByRole('button', { name: dir }).first().click()
  await page.waitForTimeout(900)
}

/**
 * Type, then move the cursor in the same click — the writer's natural order,
 * and the only one that shows the defect. The click on *Next moment* is what
 * blurs the textarea, so the save and the step race, and the panel re-reads
 * before the save has come back round.
 */
async function typeThenStepForward(page: Page, text: string) {
  const box = page.getByPlaceholder(STATUS)
  await box.click()
  await box.fill(text)
  await page.getByRole('button', { name: 'Next moment' }).first().click()
  await page.waitForTimeout(1200)
}

/** Every status note in the store, by the scene it is filed under. */
const stored = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as
    { characterSnapshots: { toArray: () => Promise<{ eventId: string; statusNotes: string }[]> } }
  const rows = await db.characterSnapshots.toArray()
  return Object.fromEntries(rows.map((r) => [r.eventId, r.statusNotes]))
})

test.describe('The character panel shows the note it is about to save', () => {
  test.describe.configure({ timeout: 240_000 })

  test('after a second edit, stepping forward carries the second, not the first', async ({ page }) => {
    await worldWithACharacterOnAMap(page)

    await writeStatus(page, 'ALPHA: he reads it twice.')
    await step(page, 'Next moment')
    // Carried forward from the scene before, since this one has no record yet.
    await expect(page.getByPlaceholder(STATUS)).toHaveValue('ALPHA: he reads it twice.')

    await step(page, 'Previous moment')

    // The defect in one assertion: this showed ALPHA — one edit behind.
    await typeThenStepForward(page, 'BETA: he decides not to burn it.')
    await expect(page.getByPlaceholder(STATUS)).toHaveValue('BETA: he decides not to burn it.')
  })

  test('and a blur there does not file the previous scene\'s note under this one', async ({ page }) => {
    await worldWithACharacterOnAMap(page)

    await writeStatus(page, 'ALPHA: he reads it twice.')
    await step(page, 'Next moment')
    await step(page, 'Previous moment')
    await typeThenStepForward(page, 'BETA: he decides not to burn it.')

    // Click in and straight back out, changing nothing — the gesture that used
    // to commit the stale text.
    const box = page.getByPlaceholder(STATUS)
    await box.click()
    await box.press('Tab')
    await page.waitForTimeout(900)

    const rows = await stored(page)
    expect(rows['ev1']).toBe('BETA: he decides not to burn it.')
    // Whether the blur wrote a record here at all is not the point; what it must
    // never be is the note from before the last edit.
    if ('ev2' in rows) expect(rows['ev2']).not.toBe('ALPHA: he reads it twice.')
  })
})
