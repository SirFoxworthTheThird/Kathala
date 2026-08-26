import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { downloadLibraryBook, DEFAULT_BOOK } from './helpers/library'
import { settle } from './helpers/settle'

/**
 * Reported from use: *in reading mode, on the map, if I select a character I'm
 * able to change some information.*
 *
 * Reproduced on a freshly downloaded *Philosopher's Stone* — `readingMode: true`
 * on the world record — by opening a character from the map sidebar, typing in
 * the Status box and tabbing away. The snapshot was written to the database. The
 * panel had no gate at all: not the alive toggle, the status note, the travel
 * mode, the inventory, nor the journey's waypoint order and notes. The location
 * panel beside it has been gated all along.
 *
 * Two more leaks came out of looking: the sidebar's **Place on the map**
 * crosshair was offered while reading, and the write it leads to was ungated —
 * dragging a character onto a marker checked the gate, tap-to-place did not, and
 * both end in the same function.
 *
 * Every test here ends at the database. A control that is hidden but still
 * reachable, or a panel that stops rendering a box while something else writes
 * the same field, would pass an assertion about the DOM alone.
 */

const READER_TYPED = 'A READER TYPED THIS'

/** Reading mode arrives with the world — this is the path a reader takes. */
async function libraryWorldOnItsMap(page: Page) {
  await resetDB(page)
  await downloadLibraryBook(page, DEFAULT_BOOK)
  await settle(page)

  // The premise, asserted rather than assumed: if the world did not arrive in
  // reading mode, everything below would be testing the writing app.
  const reading = await page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      { worlds: { toArray: () => Promise<Array<{ readingMode?: boolean }>> } }
    return (await db.worlds.toArray())[0]?.readingMode === true
  })
  expect(reading, 'a library world should arrive in reading mode').toBe(true)

  await page.getByRole('link', { name: /maps/i }).first().click()
  // The nav rail expands on hover and covers the sidebar underneath.
  await page.mouse.move(900, 500)
  await page.waitForTimeout(4000)
}

/** Open the first character listed in the map sidebar. */
async function openFirstCharacter(page: Page) {
  const row = page.getByRole('button', { name: /^Dudley Dursley/ }).first()
  await row.click({ timeout: 30_000 })
  await page.waitForTimeout(1500)
}

const snapshotState = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    characterSnapshots: { toArray: () => Promise<Array<{ statusNotes: string; isAlive: boolean }>> }
    characterMovements: { toArray: () => Promise<unknown[]> }
  }
  const snaps = await db.characterSnapshots.toArray()
  return {
    count: snaps.length,
    typed: snaps.filter((s) => s.statusNotes === 'A READER TYPED THIS').length,
    dead: snaps.filter((s) => !s.isAlive).length,
    movements: (await db.characterMovements.toArray()).length,
  }
})

test.describe('Reading mode on the map', () => {
  test.describe.configure({ timeout: 300_000 })

  test('a character panel shows the record and offers no way to rewrite it', async ({ page }) => {
    await libraryWorldOnItsMap(page)
    const before = await snapshotState(page)
    await openFirstCharacter(page)

    // The panel is open and showing this character — without this the absences
    // below would pass on a panel that never appeared.
    const panel = page.getByText('Dudley Dursley').first()
    await expect(panel).toBeVisible()

    // Nothing to type into, nothing to press.
    await expect(page.getByPlaceholder('What is this character doing in this scene?')).toHaveCount(0)
    await expect(page.getByPlaceholder('Inventory notes...')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^(Alive|Deceased)$/ })).toHaveCount(0)
    await expect(page.getByTitle('Remove from inventory')).toHaveCount(0)
    await expect(page.getByTitle('Move up')).toHaveCount(0)

    // And the record is exactly as it was.
    expect(await snapshotState(page)).toEqual(before)
  })

  /**
   * The presence half. Reading mode is meant to *show* the state — where they
   * are, whether they are alive — and every assertion above is satisfied by a
   * panel that renders nothing at all, which would be a different bug.
   */
  test('and it still tells the reader what is recorded', async ({ page }) => {
    await libraryWorldOnItsMap(page)
    await openFirstCharacter(page)

    /*
      Unanchored on purpose. The badge is a span holding an icon and the word,
      so its text node carries a leading space from the JSX and `/^Alive$/`
      matches nothing — which is how this assertion first failed against a fix
      that was working. The *absence* half in the test above uses the accessible
      name, where the same word is trimmed, and test four proves that locator
      finds a real button when the gate is off.
    */
    await expect(page.getByText(/Alive|Deceased/).first()).toBeVisible()
    // Where they are, which is the reason to open this panel on a map.
    await expect(page.getByText('Number Four, Privet Drive').first()).toBeVisible()
    // And the author's own note is shown, rather than an empty box to fill in.
    await expect(page.getByText('Status')).toBeVisible()
  })

  /**
   * Tap-to-place: arm the crosshair in the sidebar, tap a location, and the
   * character's snapshot and trail are rewritten. Dragging checked the gate and
   * this did not, so the control is gone **and** the write behind it refuses.
   */
  test('a character cannot be placed on the map', async ({ page }) => {
    await libraryWorldOnItsMap(page)
    const before = await snapshotState(page)

    await expect(page.getByRole('button', { name: /^Place .* on the map$/ })).toHaveCount(0)
    // Tapping a location is the other half of that gesture, and with nothing
    // armed it must select rather than move anybody.
    await page.locator('.leaflet-marker-icon').first().click({ timeout: 30_000 }).catch(() => {})
    await page.waitForTimeout(1000)
    expect(await snapshotState(page)).toEqual(before)

    /*
      What this test does **not** reach is the guard now inside
      `placeCharacterAtMarker` itself. Both ways in are closed above — the
      crosshair is gone and the canvas is `readOnly` — so from the UI the
      function is unreachable while reading, and the guard is there for the next
      caller rather than for this one. Said plainly instead of implied by a test
      that would have to fake a click on a control that is not rendered.
    */
  })

  /**
   * The same panel with the gate off, which is what stops all of the above
   * passing on a panel that is broken for everybody. Reading mode is a world
   * setting, so turning it off is the reader's own escape hatch.
   */
  test('with reading mode off, the controls are back', async ({ page }) => {
    await libraryWorldOnItsMap(page)
    await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        worlds: {
          toArray: () => Promise<Array<{ id: string }>>
          update: (id: string, patch: Record<string, unknown>) => Promise<unknown>
        }
      }
      const w = (await db.worlds.toArray())[0]
      await db.worlds.update(w.id, { readingMode: false })
    })
    await page.reload({ waitUntil: 'load' })
    await page.mouse.move(900, 500)
    await page.waitForTimeout(4000)
    await openFirstCharacter(page)

    await expect(page.getByPlaceholder('What is this character doing in this scene?')).toBeVisible()
    await expect(page.getByRole('button', { name: /^(Alive|Deceased)$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Place .* on the map$/ }).first()).toBeVisible()

    // And it writes, which is the whole difference between the two modes.
    await page.getByPlaceholder('What is this character doing in this scene?').fill(READER_TYPED)
    await page.keyboard.press('Tab')
    await expect.poll(() => snapshotState(page).then((s) => s.typed), { timeout: 15_000 }).toBe(1)
  })
})
