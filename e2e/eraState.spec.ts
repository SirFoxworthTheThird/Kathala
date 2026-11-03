import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/**
 * People stay in their era (`src/lib/stateEngine.ts`), driven on the book that
 * found the problem: writer run 10's *The Cold Choir*, three timelines braided
 * chapter by chapter, set in 1 BL (The Mercy), 311 AL (The Compact) and 742 AL
 * (The Quiet). Its scene revisions are left out of the fixture; everything
 * else is the book as the writer exported it.
 *
 * What the writer saw, and what each test asserts the opposite of:
 * - the map at Ch. 21 (742 AL) put Isidor and Mother Calloway, of 311 AL, at
 *   the Hall of Muster: hand-offs had written them states at 742 AL scenes,
 *   which the writer later deleted by hand (the write is fixed and has its own
 *   test, `handoffEras.test.ts`). Here the map says they are not of this era,
 *   rather than merely unplaced;
 * - the Writer's Brief at Ch. 3 (742 AL) listed Aurel Kesh "age 783" and four
 *   more from the other eras;
 * - the Arc grid carried Neve Castellan (311 AL) into every column of 1 BL;
 * - Cast Balance had Sefa Lund "drop out for 14 chapters mid-story";
 * - the checker reported 43 people "in a scene before they were born", and
 *   the Torque Key, carried 1 BL to 311 AL to 742 AL, outside its declared
 *   timelines five times.
 *
 * Each absence is paired with a presence in the same test, at a scene of the
 * other era or on the same screen, so a screen that shows nobody cannot pass.
 */

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/cold-choir.pwk')

async function openTheBook(page: Page): Promise<string> {
  await resetDB(page)
  await page.locator('input[type="file"][accept=".pwk,.pwb,application/json"]').setInputFiles(FIXTURE)
  await expect(page.getByRole('heading', { name: 'The Cold Choir' })).toBeVisible({ timeout: 60_000 })
  // The heading can show a moment before the import navigates into the world.
  await expect(page).toHaveURL(/#\/worlds\/[^/]+/)
  return page.url().split('/worlds/')[1].split('/')[0]
}

/** Put the time cursor on a scene by clicking it in the chapter bar, as a writer does. */
async function cursorAt(page: Page, worldId: string, scene: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`)
  await settle(page)
  await page.getByTitle(scene, { exact: true }).first().click()
  // The cursor pill names the scene it is on.
  await expect(page.getByTitle(`— ${scene} (open timeline)`, { exact: false })).toBeVisible()
}

const castBody = (page: Page) => page.locator('[data-sidebar-section-body="Characters"]')

test.describe('A book in eras: people stay in their own', () => {
  test.describe.configure({ timeout: 240_000 })

  test('the map and the Writer’s Brief show only the people of the cursor’s era', async ({ page }) => {
    const worldId = await openTheBook(page)

    // Ch. 21, 742 AL. The 311 AL people are not on the map, and the list says why.
    await cursorAt(page, worldId, 'Waking')
    await page.goto(`/#/worlds/${worldId}/maps`)
    const body = castBody(page)
    await expect(body.getByText(/^On the map \(5\)$/)).toBeVisible({ timeout: 30_000 })
    for (const name of ['Isidor Kesh-Amaury', 'Mother Calloway']) {
      await expect(body.getByRole('button', { name: new RegExp(`^${name}`) })).toContainText('Not in this era')
    }
    await expect(body.getByRole('button', { name: /^Oshun Teague/ })).toContainText('The Choir')

    // Ch. 20, 311 AL: the same two are at the Hall of Muster, where the book left them.
    await cursorAt(page, worldId, "Rhee's Choice")
    await page.goto(`/#/worlds/${worldId}/maps`)
    await expect(body.getByText(/^On the map \(6\)$/)).toBeVisible({ timeout: 30_000 })
    for (const name of ['Isidor Kesh-Amaury', 'Mother Calloway']) {
      await expect(body.getByRole('button', { name: new RegExp(`^${name}`) })).toContainText('Hall of Muster')
    }
    await expect(body.getByRole('button', { name: /^Oshun Teague/ })).toContainText('Not in this era')

    // The Brief at Ch. 3, 742 AL: its two, with their ages, and no one older by centuries.
    await cursorAt(page, worldId, "Pelican's Debt")
    await page.getByTitle("Writer's Brief").click()
    const brief = page.getByRole('dialog', { name: "Writer's Brief" })
    // The Characters section, not the POV line above it, which names Osh too.
    const cast = brief.getByText('Characters', { exact: true }).locator('xpath=../..')
    await expect(cast.getByText('Oshun Teague', { exact: true })).toBeVisible()
    await expect(cast.getByText('· age 46')).toBeVisible()
    await expect(cast.getByText('Kit Aranda', { exact: true })).toBeVisible()
    for (const name of ['Aurel Kesh', 'Neve Castellan', 'Ilse Varga', 'Jory Mbeki', 'Hal Oduya']) {
      await expect(cast.getByText(name, { exact: true })).toHaveCount(0)
    }
    await page.keyboard.press('Escape')

    // …and at Ch. 20, 311 AL, the Brief lists that era's people instead.
    await cursorAt(page, worldId, "Rhee's Choice")
    await page.getByTitle("Writer's Brief").click()
    await expect(cast.getByText('Neve Castellan', { exact: true })).toBeVisible()
    await expect(cast.getByText('Oshun Teague', { exact: true })).toHaveCount(0)
  })

  test('the Arc grid, Cast Balance and the checker read each era on its own', async ({ page }) => {
    const worldId = await openTheBook(page)

    // Arc grid, chapters grouped by timeline: Neve (311 AL) in her own columns, not in 1 BL's.
    await page.goto(`/#/worlds/${worldId}/arc`)
    await settle(page)
    const neve = page.getByRole('row').filter({ has: page.getByText('Neve Castellan', { exact: true }) }).first()
    const headers = (await page.getByRole('columnheader').allInnerTexts()).map((h) => h.replace(/\s+/g, ' ').trim())
    const cells = neve.getByRole('gridcell')
    const column = (title: string) => headers.filter((h) => /^Ch\. \d+ /.test(h)).indexOf(title) + 1
    // Ch. 4 and 19 are the Mercy's (1 BL), after Neve's first records in book order; Ch. 2 and 20 the Compact's.
    for (const mercy of ['Ch. 4 The Air Budget', 'Ch. 19 Landfall']) {
      expect(column(mercy)).toBeGreaterThan(0)
      await expect(cells.nth(column(mercy))).toHaveAttribute('aria-label', /No state recorded/)
    }
    await expect(cells.nth(column('Ch. 2 The Hall of Muster'))).toContainText('Alive')
    await expect(cells.nth(column('Ch. 20 Tricentennial'))).toContainText('Hall of Muster')

    // Cast Balance: a silence is counted in the chapters of one's own era.
    await page.goto(`/#/worlds/${worldId}`)
    await settle(page)
    const sefa = page.getByText('Sefa Lund', { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded-md")][1]')
    await expect(sefa).toContainText('drops out for 4 chapters mid-story')
    await expect(page.getByText(/drops out for 1[0-9] chapters/)).toHaveCount(0)

    // The checker dates each scene from its own timeline's start.
    await page.getByTitle('Continuity Checker').click()
    const checker = page.getByRole('dialog').filter({ hasText: 'Continuity Checker' })
    // Loaded: the one item the book shows before anybody holds it is listed.
    await expect(checker.getByText('"Obedient Flight Recorder" used before acquired in Ch. 20')).toBeVisible({ timeout: 30_000 })
    await expect(checker.getByText(/before they were born/)).toHaveCount(0)
    // The Torque Key's chain, 1 BL to 311 AL to 742 AL, is its history, not five anachronisms.
    await expect(checker.getByText(/"The Torque Key"/)).toHaveCount(0)
  })

  test('a thing’s state carried from another era says where it was last known', async ({ page }) => {
    const worldId = await openTheBook(page)

    // The Muster Roll is damaged in the Mercy's Ch. 13 (1 BL) and again in the Compact's Ch. 20 (311 AL).
    const roll = (p: Page) => p.getByRole('link', { name: /^The Muster Roll/ })
    await cursorAt(page, worldId, 'Thieves') // Ch. 18, 742 AL: nothing in its own era yet
    await page.goto(`/#/worlds/${worldId}/items`)
    await expect(roll(page)).toContainText('(last known in The Mercy)')
    await cursorAt(page, worldId, 'Waking') // Ch. 21: the Compact's Ch. 20 is the later, by in-world time
    await page.goto(`/#/worlds/${worldId}/items`)
    await expect(roll(page)).toContainText('(last known in The Compact)')
    await cursorAt(page, worldId, 'The Warden') // Ch. 19, 1 BL: its own era's record, said as this scene's
    await page.goto(`/#/worlds/${worldId}/items`)
    await expect(roll(page)).toContainText('damaged')
    await expect(roll(page)).not.toContainText('last known in')

    // A place: the Obedient recorded damaged at Ch. 20 (311 AL), seen from 742 AL.
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, {
        toArray: () => Promise<Array<Record<string, string>>>; add: (v: unknown) => Promise<unknown>
      }>
      const obedient = (await db.locationMarkers.toArray()).find((m) => m.name === 'The Obedient')!
      const scene = (await db.events.toArray()).find((e) => e.title === "Rhee's Choice")!
      await db.locationSnapshots.add({
        id: 'obedient-damaged', worldId: id, locationMarkerId: obedient.id, eventId: scene.id,
        status: 'damaged', notes: '', createdAt: Date.now(), updatedAt: Date.now(),
      })
    }, worldId)
    const placeState = async (scene: string) => {
      await cursorAt(page, worldId, scene)
      await page.goto(`/#/worlds/${worldId}/maps`)
      await settle(page)
      // The Locations section starts folded; its rows are the sidebar's, not the map's own labels.
      await page.getByRole('button', { name: /^Locations \d+$/ }).click()
      await page.locator('[data-sidebar-section-body="Locations"]').getByRole('button', { name: /^The Obedient/ }).click()
      await expect(page.getByText('State at this scene', { exact: true })).toBeVisible({ timeout: 20_000 })
    }
    await placeState('Waking')
    await expect(page.getByText('Last known in The Compact: nothing is recorded for it in this era yet.')).toBeVisible()
    await placeState("Rhee's Choice")
    await expect(page.getByText(/^Last known in /)).toHaveCount(0)
  })

  test('a state written into an era its person is never in is listed, and removed in one click', async ({ page }) => {
    const worldId = await openTheBook(page)
    // The kind of record run 10's hand-offs wrote: Isidor (311 AL) at Ch. 21, 742 AL.
    const count = () => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, string>>> }>
      return (await db.characterSnapshots.toArray()).filter((s) => s.id === 'isidor-in-742').length
    })
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, {
        toArray: () => Promise<Array<Record<string, string>>>; add: (v: unknown) => Promise<unknown>
      }>
      const isidor = (await db.characters.toArray()).find((c) => c.name === 'Isidor Kesh-Amaury')!
      const scene = (await db.events.toArray()).find((e) => e.title === 'Waking')!
      await db.characterSnapshots.add({
        id: 'isidor-in-742', worldId: id, characterId: isidor.id, eventId: scene.id, isAlive: true,
        currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [], inventoryNotes: '',
        statusNotes: '', travelModeId: null, createdAt: Date.now(), updatedAt: Date.now(),
      })
    }, worldId)
    expect(await count()).toBe(1)

    await page.goto(`/#/worlds/${worldId}`)
    await settle(page)
    await page.getByTitle('Continuity Checker').click()
    const checker = page.getByRole('dialog').filter({ hasText: 'Continuity Checker' })
    const row = checker.getByText('Isidor Kesh-Amaury has a state in The Quiet, an era they are in no scene of')
    await expect(row).toBeVisible({ timeout: 30_000 })
    // His own era's states are not listed.
    await expect(checker.getByText(/^Isidor Kesh-Amaury has a state in The Compact/)).toHaveCount(0)
    // The only state of its kind in the book, so the only button of its name.
    const remove = checker.getByRole('button', { name: 'Remove this state' })
    await expect(remove).toHaveCount(1)
    await remove.click()
    await expect(row).toHaveCount(0)
    await expect.poll(count).toBe(0)
  })

  test('an item kept in its era shows no condition from another', async ({ page }) => {
    const worldId = await openTheBook(page)
    const roll = (p: Page) => p.getByRole('link', { name: /^The Muster Roll/ })
    // The map's item list reads one item at a time (`useItemSnapshot`); its dot is titled with the condition.
    const onTheMap = async () => {
      await page.goto(`/#/worlds/${worldId}/maps`)
      await page.getByRole('button', { name: /^Items\b/ }).click()
      return page.locator('[data-sidebar-section-body="Items"]').getByRole('button', { name: /^The Muster Roll/ }).locator('span[title]')
    }
    // Ch. 18, 742 AL: the Mercy's damage (1 BL) carries, as a thing's does by default.
    await cursorAt(page, worldId, 'Thieves')
    await page.goto(`/#/worlds/${worldId}/items`)
    await expect(roll(page)).toContainText('(last known in The Mercy)')
    await expect(await onTheMap()).toHaveAttribute('title', 'damaged')
    await page.goto(`/#/worlds/${worldId}/items`)

    await roll(page).click()
    await page.getByRole('main').getByRole('button', { name: 'Edit', exact: true }).click()
    const keep = page.getByRole('checkbox', { name: /condition stays in its era/i })
    await expect(keep).not.toBeChecked()
    await keep.check()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)

    await page.goto(`/#/worlds/${worldId}/items`)
    await expect(roll(page)).toBeVisible()
    await expect(roll(page)).not.toContainText('damaged')
    await expect(roll(page)).not.toContainText('last known in')
    await expect(await onTheMap()).toHaveAttribute('title', 'intact')
    // Ch. 19, 1 BL: in its own era it is still damaged.
    await cursorAt(page, worldId, 'The Warden')
    await page.goto(`/#/worlds/${worldId}/items`)
    await expect(roll(page)).toContainText('damaged')
  })

  test('known before the story is filed at the first scene of the person’s own era', async ({ page }) => {
    const worldId = await openTheBook(page)
    await page.goto(`/#/worlds/${worldId}/knowledge`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('button', { name: /Hal Oduya informed on Jory Mbeki/ }).first().click()
    await settle(page)
    await page.getByRole('button', { name: 'Character…', exact: true }).click()
    await page.getByRole('option', { name: 'Isidor Kesh-Amaury', exact: true }).click()
    await page.getByRole('button', { name: 'Learns it at…', exact: true }).click()
    await page.getByRole('option', { name: 'Before the story (from the first scene)', exact: true }).click()
    await page.getByRole('button', { name: 'Record who learns it' }).click()
    // Isidor is of 311 AL: the Compact's first scene, Ch. 2, not the book's — the Mercy's Ch. 1, three centuries earlier.
    // This fact's reveal: the book already files Isidor as knowing another fact
    // before the story, at the Mercy's Ch. 1 by the old rule, and which of the
    // two a lookup by person met first went by the new record's random id.
    const filedAt = () => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, unknown>>> }>
      const isidor = (await db.characters.toArray()).find((c) => c.name === 'Isidor Kesh-Amaury')!
      const fact = (await db.knowledgeFacts.toArray()).find((f) => f.title === 'Hal Oduya informed on Jory Mbeki')!
      const reveal = (await db.knowledgeReveals.toArray()).find((r) => r.characterId === isidor.id && r.factId === fact.id && r.beforeStory)
      return (await db.events.toArray()).find((e) => e.id === reveal?.eventId)?.title ?? null
    })
    await expect.poll(filedAt).toBe('The Muster Roll')
  })
})
