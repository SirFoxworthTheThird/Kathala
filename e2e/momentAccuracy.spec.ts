import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'
import { waitForMapReady, sidebarSection } from './helpers/map'
import path from 'path'
import { fileURLToPath } from 'url'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

/**
 * Two findings from the writer run, both of them the app describing a moment
 * other than the one you are on.
 *
 * **WRUN-4** — the dashboard's alive/dead split counted `character.isAlive`,
 * the record's end-of-book flag, sitting directly beside a time cursor. On the
 * shipped *Dracula* it read *14 alive, 11 dead* at chapter one, where six of
 * those eleven are still alive, and the identical figure at chapter
 * twenty-seven. It also never moved when a writer marked someone deceased,
 * because Current State writes the snapshot and not the flag.
 *
 * **WRUN-5** — the map panels named the moment by its *chapter*, so two scenes
 * of one chapter gave byte-identical headers for two different records. Every
 * snapshot these panels edit is per scene.
 */

const CAST = 'Characters in your cast'

async function worldWithADeath(page: Page) {
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
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'What the Water Kept', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.characters.bulkAdd([['rhun', 'Rhun Aldemar'], ['marren', 'Marren Vane']].map(([cid, name]) => ({
      id: cid, worldId: id, name, aliases: [], description: '', portraitImageId: null,
      tags: [], isAlive: true, color: null, createdAt: now, updatedAt: now,
    })))
    await db.events.bulkAdd([['ev1', 'Rhun finds the letter'], ['ev2', 'Marren does not come home']].map(([eid, title], i) => ({
      id: eid, worldId: id, chapterId: 'ch1', timelineId: 'tl', title, description: '', sortOrder: i,
      tags: [], locationMarkerId: null, involvedCharacterIds: ['rhun', 'marren'], mentionedCharacterIds: [],
      involvedItemIds: [], threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null, isFlashback: false,
      createdAt: now, updatedAt: now,
    })))
    // Marren is alive in the first scene and dead in the second. Her character
    // record still says alive — which is exactly what Current State leaves
    // behind, and what the dashboard used to count.
    await db.characterSnapshots.bulkAdd([
      { id: 'cs1', worldId: id, characterId: 'marren', eventId: 'ev1', isAlive: true,
        currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [],
        inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: now, updatedAt: now },
      { id: 'cs2', worldId: id, characterId: 'marren', eventId: 'ev2', isAlive: false,
        currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [],
        inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: now, updatedAt: now },
    ])
  }, worldId)
  return worldId
}

/**
 * The dashboard's cast tile, as one string.
 *
 * Read off the whole tile button: the count, the words and the split are
 * separate elements, so a text lookup for the label alone lands on a fragment
 * and its parent is not the tile.
 */
async function castLine(page: Page) {
  const tile = page.getByRole('button', { name: new RegExp(CAST) })
  return (await tile.first().innerText()).replace(/\s+/g, ' ').trim()
}

const stepTo = async (page: Page, title: string) => {
  await page.getByTitle(title, { exact: true }).first().click()
  await page.waitForTimeout(900)
}

/**
 * Park the cursor on a scene and reload.
 *
 * Used on the dashboard, which carries no scene ticks to click — and the way
 * the cursor is moved is not what either test is about, only what the screen
 * makes of it once it has moved.
 */
async function cursorAt(page: Page, worldId: string, eventId: string) {
  await page.evaluate(({ eid, wid }: { eid: string; wid: string }) => {
    const raw = localStorage.getItem('plotweave-ui')
    const st = raw ? JSON.parse(raw) : { state: {}, version: 0 }
    st.state.activeEventId = eid
    st.state.activeWorldId = wid
    st.state.eventByWorld = { ...(st.state.eventByWorld ?? {}), [wid]: eid }
    localStorage.setItem('plotweave-ui', JSON.stringify(st))
  }, { eid: eventId, wid: worldId })
  await page.reload({ waitUntil: 'load' })
  await settle(page)
}

test.describe('The app describes the moment you are on', () => {
  test.describe.configure({ timeout: 240_000 })

  test('the cast split follows the cursor instead of the last page', async ({ page }) => {
    const worldId = await worldWithADeath(page)
    await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
    await settle(page)

    // Before she dies: nobody is dead, and the split says so.
    await cursorAt(page, worldId, 'ev1')
    await expect.poll(() => castLine(page)).toContain('2 alive')
    expect(await castLine(page)).not.toContain('dead')

    // After: the same cast, the same records, a different moment.
    await cursorAt(page, worldId, 'ev2')
    await expect.poll(() => castLine(page)).toContain('1 dead')
    expect(await castLine(page)).toContain('1 alive')
  })

  test('two scenes of one chapter do not give the same panel header', async ({ page }) => {
    const worldId = await worldWithADeath(page)

    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    await page.mouse.move(900, 500)
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
    await page.getByLabel('Map Name').clear()
    await page.getByLabel('Map Name').fill('The Reach')
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 60_000 })
    await settle(page)
    await waitForMapReady(page)

    await stepTo(page, 'Rhun finds the letter')
    const section = sidebarSection(page, 'Characters')
    if ((await section.getAttribute('aria-expanded')) === 'false') await section.click()
    await page.getByRole('button', { name: 'Rhun Aldemar' }).first().click()

    // The panel's second line: kind, then the moment it is showing.
    const subtitle = () => page.getByText(/^character ·/i).first().innerText()

    const atFirst = await subtitle()
    await stepTo(page, 'Marren does not come home')
    const atSecond = await subtitle()

    // The finding, in one assertion: these used to be byte-identical.
    expect(atSecond).not.toBe(atFirst)

    /*
      And WRUN-7 rides along, because `innerText` reports text as rendered and
      `capitalize` used to sit on this whole line. The scene titles below are
      the writer's own words: title-casing would give "Rhun Finds The Letter",
      so an exact match is the assertion.

      Checked here rather than on the chapter title, which this header no longer
      shows at all now that it names the scene — a test of that would be a test
      of nothing.
    */
    expect(atFirst).toContain('Rhun finds the letter')
    expect(atSecond).toContain('Marren does not come home')
  })
})
