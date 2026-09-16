import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

// The bottom bar in a multi-timeline world: a scope selector that switches
// between one timeline and a merged view, and a read-through Play for the merge.
// The ordering maths is unit-tested in src/lib/__tests__/combinedTimeline.test.ts;
// these drive the real bar.

const settleNav = (page: Page) => page.mouse.move(700, 400).then(() => page.waitForTimeout(150))

/** Two timelines, each with one chapter + event. Leaves the app on the timeline. */
async function setupTwoTimelines(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Braided')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  const main = page.getByRole('main')
  const gotoTimeline = async () => { await page.getByRole('link', { name: /timeline/i }).first().click(); await settleNav(page) }
  const addEvent = async (title: string) => {
    await main.getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByPlaceholder('Scene title').fill(title)
    await page.getByRole('button', { name: 'Add Scene' }).last().click()
  }
  const addChapter = async (title: string) => {
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill(title)
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
  }

  await gotoTimeline()
  await page.getByRole('button', { name: 'Create Timeline' }).click()
  await addChapter('The Meeting')
  await page.getByTitle('Open chapter detail').first().click()
  await addEvent('A stolen glance')
  await gotoTimeline()
  await page.getByRole('button', { name: 'New Timeline' }).click()
  await addChapter('The Siege')
  await page.getByTitle('Open chapter detail').first().click()
  await addEvent('Ash writes home')
  await gotoTimeline()
}

test('the bottom bar scope selector switches between one timeline and all', async ({ page }) => {
  test.setTimeout(90000)
  await setupTwoTimelines(page)

  // Defaults to the merged view (chapter order), showing both timelines' scenes.
  const scope = page.getByLabel('Timeline bar scope')
  await expect(scope).toHaveValue('all-chapter')
  await expect(page.getByTitle('A stolen glance', { exact: true })).toBeVisible()
  await expect(page.getByTitle('Ash writes home', { exact: true })).toBeVisible()

  // Focus one timeline → the other timeline's scene drops out of the bar.
  //
  // This used to check the play button's title here as a proxy for "the single
  // track is in use", since merged mode labels it "Play all timelines on the
  // map". The transport controls live on the map now, so the proxy is gone from
  // this screen; the label distinction it stood for is checked on the map in
  // `playerOnMapOnly.spec.ts`, and the scene set below is the direct evidence.
  await scope.selectOption('Main Timeline')
  await expect(page.getByTitle('A stolen glance', { exact: true })).toBeVisible()
  await expect(page.getByTitle('Ash writes home', { exact: true })).toHaveCount(0)

  // Back to a merged view (chronological) → both scenes return.
  await scope.selectOption('all-chrono')
  await expect(page.getByTitle('A stolen glance', { exact: true })).toBeVisible()
  await expect(page.getByTitle('Ash writes home', { exact: true })).toBeVisible()
})

test('the merged view plays every timeline on the map, following each event', async ({ page }) => {
  test.setTimeout(90000)
  await setupTwoTimelines(page)

  await expect(page.getByLabel('Timeline bar scope')).toHaveValue('all-chapter')

  /*
    On the map, where the transport controls are.

    This used to press play on the Timeline and assert the URL turned into the
    map — playback carried you there to show you what it was doing. The controls
    live on the map now, so that jump has nothing left to do and is gone with
    it. What the test is actually for survives unchanged: merged playback walks
    the cursor across *both* timelines.
  */
  const worldId = new URL(page.url()).hash.split('/')[2]
  await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
  await expect(page.getByLabel('Timeline bar scope')).toHaveValue('all-chapter')
  await page.getByTitle('Play all timelines on the map').click()

  // Advancing the cursor from the first timeline's scene ("A stolen glance")
  // into the second timeline's ("Ash writes home"); the bar stays visible.
  await expect(page.getByText('Ash writes home', { exact: true })).toBeVisible({ timeout: 15000 })
})

test('every control in the chapter bar is big enough to hit', async ({ page }) => {
  /*
    A-10. `Clear selection` was 16x16 and sat 18px from `Hide the chapter bar`
    at 17x17, at the bottom-left of every screen — and one of the two drops the
    reader's place in the book. WCAG 2.5.8 asks for 24.

    Measuring every button on the screen turned up a pair the run had not
    reported and which matter more: the scene steppers, at **14x14**, the
    control a reader uses most.

    The moment pips are excluded on purpose. They are a scrubber — adjacent
    segments in a strip — and 2.5.8 allows an undersized target where an
    equivalent control meets the minimum, which is what the steppers are.
  */
  await resetDB(page)
  const worldId = await downloadLibraryBook(page, 'Dracula')
  await settle(page)
  await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
  await settle(page)

  const names = [
    'Clear where you have read to',
    'Hide the chapter bar',
    'Previous scene in this chapter',
    'Next scene in this chapter',
  ]

  for (const name of names) {
    const control = page.getByRole('button', { name, exact: true })
    await expect(control, `${name} is on screen`).toBeVisible()
    const box = await control.boundingBox()
    expect(box, `${name} has a box`).not.toBeNull()
    expect(Math.round(box!.width), `${name} is at least 24 wide`).toBeGreaterThanOrEqual(24)
    expect(Math.round(box!.height), `${name} is at least 24 tall`).toBeGreaterThanOrEqual(24)
  }

  /*
    And the label says what it costs. "Clear selection" told a reader nothing
    about the thing being cleared being how far they had read.
  */
  await expect(page.getByRole('button', { name: 'Clear selection', exact: true }),
    'the old label is gone').toHaveCount(0)
})

