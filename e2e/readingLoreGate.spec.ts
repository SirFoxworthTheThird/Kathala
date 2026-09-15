import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * **R4a.** A blind reader run opened *Dracula*'s Lore screen at chapter 7 —
 * cursor on *"A Sailor Disappears"* — and was shown 11 of the world's 14 pages,
 * among them that a victim may rise and feed after death, that crucifixes,
 * garlic and consecrated wafers work, and that there is a group of "hunters".
 * Those are chapters 10, 12–16 and 22. At chapter 7 the reader knows only that
 * the Count climbs walls and casts no reflection.
 *
 * Every page had `visibleFromEventId: null`, and `hasReached(null)` is `true`,
 * so the only thing holding lore back was `linksRevealed` — whether the
 * characters a page happens to link to have been met. A proxy, and one that
 * fails open in the one place a reader goes to ask what the rules of this world
 * are.
 *
 * `libraryLoreGating.test.ts` holds the rule that every shipped page names a
 * scene. This drives the reader's own cursor through the real gate, because a
 * field being set is not the same as a page being withheld.
 */

/** Put the reader at a scene, the way returning to a part-read book does. */
/**
 * Put the reader at a scene, and make sure they arrived.
 *
 * The store hydrates from localStorage at load and writes it back on every
 * change, so a write into a page that is still running can be overwritten
 * before the reload picks it up. When that happened the cursor stayed at
 * chapter one, `Castle Dracula` was correctly hidden as a chapter-two page, and
 * the test failed looking like a gate bug — the saved snapshot showed the pill
 * still reading "Ch.1 · Eastward by Rail".
 *
 * That was diagnosed once as a render-timing asymmetry and "fixed" by raising a
 * timeout, which changed nothing: the page was never going to appear, because
 * the reader was never moved. So the write is verified, and repeated if it was
 * lost.
 */
async function readAt(page: Page, eventId: string) {
  const write = async () => {
    await page.evaluate((eid: string) => {
      const raw = localStorage.getItem('plotweave-ui')
      const st = raw ? JSON.parse(raw) : { state: {}, version: 0 }
      st.state.activeEventId = eid
      if (st.state.eventByWorld) for (const k of Object.keys(st.state.eventByWorld)) st.state.eventByWorld[k] = eid
      localStorage.setItem('plotweave-ui', JSON.stringify(st))
    }, eventId)
    await page.reload({ waitUntil: 'load' })
    await settle(page)
    return page.evaluate(() => {
      const raw = localStorage.getItem('plotweave-ui')
      return raw ? (JSON.parse(raw) as { state: { activeEventId: string | null } }).state.activeEventId : null
    })
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await write() === eventId) return
  }
  throw new Error(`could not put the reader at ${eventId}: the store kept overwriting it`)
}

/** The four pages the reader named, with the chapter each belongs to. */
const SPOILERS = [
  'The Un-Dead State',
  'Vampire Powers and Limits',
  'Consecrated Protection',
  'Carfax and Purfleet',
]

test.describe("Dracula's lore at the reader's own cursor", () => {
  test.describe.configure({ timeout: 180_000 })

  test('holds back what chapter 7 has not told, and gives it up later', async ({ page }) => {
    await resetDB(page)
    const worldId = await downloadLibraryBook(page, 'Dracula')
    await page.goto(`/#/worlds/${worldId}/lore`, { waitUntil: 'load' })
    await settle(page)

    // Chapter 7, "A Sailor Disappears" — the cursor in the run's screenshot.
    await readAt(page, 'dracula-event-19')
    const main = page.getByRole('main')

    /*
      Presence first, so the absences below cannot pass on an empty screen —
      which is exactly how this would fail if the reveal points were wrong in
      the other direction and buried the lot.
    */
    await expect(main.getByText('The Epistolary Method')).toBeVisible({ timeout: 30_000 })
    // The same wait as its sibling, for symmetry rather than for a reason: the
    // flake this was once blamed on never had anything to do with timing. See
    // `readAt` above.
    await expect(main.getByText('Castle Dracula')).toBeVisible({ timeout: 30_000 })

    for (const title of SPOILERS) {
      await expect(main.getByText(title), `${title} is later than chapter 7`).toHaveCount(0)
    }

    /*
      And the other half: withheld, not missing. Read on to the end of the
      hunt and every one of them is there — a gate that never opens is a
      deletion wearing a gate's name.
    */
    await readAt(page, 'dracula-event-71')
    for (const title of SPOILERS) {
      await expect(page.getByRole('main').getByText(title), `${title} should be readable by chapter 24`)
        .toBeVisible({ timeout: 30_000 })
    }
  })
})
