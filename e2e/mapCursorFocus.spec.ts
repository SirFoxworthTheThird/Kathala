import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { waitForMapReady, sidebarSection } from './helpers/map'

/**
 * Moving the time cursor on the map pans; it does not pick a place.
 *
 * Each scene can name where it happens, and the bottom bar hands that marker id
 * to the map so the view follows the story. It used to hand it to the same code
 * path the sidebar uses, which both pans *and* opens the location's detail
 * panel. On a desktop that panel is a 18rem column and the mistake reads as a
 * quirk; on a phone it is 85vw, so every tap on the scrubber buried the map
 * under a form for a place the reader had not asked about.
 *
 * Phone viewport, because that is where it is a bug rather than a quirk.
 */
test.use({ viewport: { width: 390, height: 667 } })

const CLOSE_PANEL = 'Close location panel'

/** A world with two places and two scenes, each scene set at one of them. */
async function setupWorld(page: Page): Promise<string> {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Aethel')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

  // Two flat locations — no children, so both markers live on the root layer
  // and neither scene needs a drill-down to be in view.
  await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Generate locations with AI' }).click()
  await page.getByRole('textbox', { name: 'locations JSON' }).fill(JSON.stringify({
    locations: [{ name: 'Northshire' }, { name: 'Southvale' }],
  }))
  await page.getByRole('button', { name: 'Add locations' }).click()
  await waitForMapReady(page)

  await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Create Timeline' }).click()
  await page.getByRole('button', { name: 'Add Chapter' }).first().click()
  await page.getByPlaceholder('Chapter title').fill('The Crossing')
  await page.getByRole('button', { name: 'Add Chapter' }).last().click()
  await page.getByTitle('Open chapter detail').first().click()

  // Scoped to main throughout: the bottom bar carries a tick button titled with
  // each scene, so an unscoped name match hits two elements.
  const main = page.getByRole('main')
  for (const [title, place] of [['First scene', 'Northshire'], ['Second scene', 'Southvale']]) {
    await page.getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByPlaceholder('Scene title').fill(title)
    await page.getByRole('button', { name: 'Add Scene' }).last().click()
    // The location picker lives in the expanded card, and saves on change.
    await main.getByRole('button', { name: title, exact: true }).click()
    // A scene with no setting does not draw the Setting section any more — it
    // is offered as a chip instead, so open it first. (The field was called
    // *Location* here until W23-5 gave one field one name; the empty state is
    // "Nowhere in particular", which is what a scene without a setting is
    // rather than a missing value.)
    await main.getByRole('button', { name: '+ Setting' }).click()
    await main.getByRole('button', { name: 'Nowhere in particular' }).click()
    await page.getByRole('option', { name: place, exact: true }).click()
    await expect(main.getByRole('button', { name: place, exact: true }).first()).toBeVisible()
    await main.getByRole('button', { name: title, exact: true }).click()
  }

  return worldId
}

test('moving the time cursor pans the map without opening a location', async ({ page }) => {
  test.slow() // world setup plus a Leaflet mount

  const worldId = await setupWorld(page)
  await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
  await waitForMapReady(page)

  const panel = page.getByRole('button', { name: CLOSE_PANEL })
  const tick = (title: string) => page.getByTitle(title, { exact: true })
  const cursorReads = (title: string) => expect(page.getByText(title, { exact: true }).first()).toBeVisible()

  // Park the cursor, so that each tap below *changes* the scene the bar names.
  // Waiting for that change is what proves the tap's state update has landed —
  // an absence checked against an update still in flight would pass whatever
  // the code did.
  await tick('First scene').click()
  await cursorReads('First scene')

  // Tapping a scene moves the cursor and leaves the map uncovered.
  await tick('Second scene').click()
  await cursorReads('Second scene')
  await expect(panel).toHaveCount(0)

  await tick('First scene').click()
  await cursorReads('First scene')
  await expect(panel).toHaveCount(0)

  // Asking for a place by name still opens it, on this same viewport — so the
  // absence above is the cursor being quiet, not the panel being unreachable.
  await page.getByRole('button', { name: 'Open map panels' }).click()
  await sidebarSection(page, 'Locations').click()
  await page.getByRole('button', { name: 'Southvale' }).first().click()
  await page.getByRole('button', { name: 'Close map panels' }).click()
  await expect(panel).toBeVisible()
})
