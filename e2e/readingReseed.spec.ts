import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * A book that arrives again arrives readable.
 *
 * A reader validating the Library found that Alice's Adventures in Wonderland
 * and The Turn of the Screw stopped moving the chapter in the bar below the
 * prose — and that the bar named no chapter at all.
 *
 * Both halves are one cause. `null` in `eventByWorld` means *all chapters*, a
 * deliberate full reveal, so `cursorForScene` refuses to move it and
 * `SingleTrack` renders no readout (it is guarded on `activeEvent`, and a null
 * cursor resolves to none). Seeding is what should put a fresh book at its
 * opening instead — but `seedReadingPosition` skips any world whose key is
 * merely *present*, and a stored `null` is present.
 *
 * Library worlds carry fixed ids, so that key outlives the world itself:
 * reveal-all on a book, delete it, download it again, and the new copy inherits
 * the old copy's `null`. Reading mode is then permanently inert for that book,
 * silently, and re-downloading — the obvious thing to try — cannot fix it.
 *
 * Both seeding call sites are arrival paths (a Library download, a `.pwk`
 * import), never "open a world I already have", so a stale reveal-all has no
 * claim on a copy that has just landed.
 */

const scroller = (page: Page) => page.locator('div.flex-1.overflow-auto').first()

/** The bar's own "Ch.N · Title" readout — not the prose's "Ch. N — Title". */
const barReadout = (page: Page) => page.getByText(/Ch\.\d+ · /).first()

async function openBook(page: Page) {
  await page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Read', exact: true }).click()
  await settle(page)
}

/** Record a reveal-all against a world id, as the confirm does. */
async function revealAllFor(page: Page, worldId: string) {
  await page.evaluate((id) => {
    const raw = localStorage.getItem('kathala-ui')
    const st = raw ? JSON.parse(raw) : { state: {}, version: 0 }
    st.state = st.state ?? {}
    st.state.eventByWorld = { ...(st.state.eventByWorld ?? {}), [id]: null }
    localStorage.setItem('kathala-ui', JSON.stringify(st))
  }, worldId)
}

test.beforeEach(async ({ page }) => { await resetDB(page) })

const BOOKS: [title: string, worldId: string][] = [
  ['Alice’s Adventures in Wonderland', 'alice-wonderland-world'],
  ['The Turn of the Screw', 'turn-of-the-screw-world'],
]

for (const [title, worldId] of BOOKS) {
  test(`${title} reads again after a reveal-all and a re-download`, async ({ page }) => {
    // The state a reader is left in by choosing "all chapters" — which survives
    // deleting the world, because the id is fixed in the catalogue.
    await page.goto('/#/', { waitUntil: 'load' })
    await revealAllFor(page, worldId)
    // The store hydrates from localStorage at load and writes it back on every
    // change, so a key written into an already-running page is simply
    // overwritten. Reload so the store actually starts holding it — without
    // this the test passes for the wrong reason, which it did on first run.
    await page.reload({ waitUntil: 'load' })
    await settle(page)

    await downloadLibraryBook(page, title)
    await settle(page)
    await openBook(page)

    await scroller(page).evaluate((el) => { el.scrollTop = (el.scrollHeight - el.clientHeight) * 0.6 })
    await page.waitForTimeout(1500)

    await expect(barReadout(page), 'the bar names the chapter being read').toBeVisible()

    const cursor = await page.evaluate(() => {
      const raw = localStorage.getItem('kathala-ui')
      return raw ? (JSON.parse(raw) as { state: { activeEventId: string | null } }).state.activeEventId : null
    })
    expect(cursor, 'the cursor is somewhere in the book rather than "all chapters"').not.toBeNull()
  })
}

test('a reader who chose all chapters on the book they are holding keeps it', async ({ page }) => {
  /*
    The presence beside the absence. The fix must not turn reveal-all into a
    setting that undoes itself: the guard being relaxed is only about a world
    *arriving*, so a choice made on the copy in hand has to survive reloads and
    revisits, and only a fresh arrival may overrule it.
  */
  const [title, worldId] = BOOKS[0]
  await downloadLibraryBook(page, title)
  await settle(page)

  await revealAllFor(page, worldId)
  await page.reload({ waitUntil: 'load' })
  await settle(page)
  await openBook(page)
  await page.waitForTimeout(800)

  const cursor = await page.evaluate(() => {
    const raw = localStorage.getItem('kathala-ui')
    return raw ? (JSON.parse(raw) as { state: { activeEventId: string | null } }).state.activeEventId : null
  })
  expect(cursor, 'all chapters is still all chapters').toBeNull()
})
