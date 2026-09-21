import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * Current State answers the question the character page is open for.
 *
 * A blind reader run clicked **Current State** on Mercédès four times and stayed
 * on Overview every time. `tabCounts` had no `state` key, so `hasTab('state')`
 * was `(undefined ?? 0) > 0` — false for every reader — and `activeTab` fell
 * back to overview while the trigger went on rendering.
 *
 * The cost is not only a dead control. *Where is she now, is she still alive*
 * is the question a reader opens a character for mid-book, and without this tab
 * the page is one whole-book sentence and a History list.
 */

const tab = (page: Page, name: string | RegExp) => page.getByRole('tab', { name })

async function openFirstCharacter(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('main').getByRole('link').first().click()
  await settle(page)
}

test.beforeEach(async ({ page }) => { await resetDB(page) })

test('a reader can open Current State, and it stays open', async ({ page }) => {
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openFirstCharacter(page, worldId)

  const state = tab(page, 'Current State')
  await expect(state).toBeVisible()
  await state.click()

  // Selected, and still selected — the failure was a snap back to Overview.
  await expect(state).toHaveAttribute('aria-selected', 'true')
  await expect(tab(page, 'Overview')).toHaveAttribute('aria-selected', 'false')
  await page.waitForTimeout(500)
  await expect(state, 'and it did not bounce back a moment later')
    .toHaveAttribute('aria-selected', 'true')
})

test('reading offers fewer tabs than writing, but never fewer than the two that say who this is', async ({ page }) => {
  /*
    The pair, on one character, so neither half can be satisfied alone.

    CH-3's rule stands: a tab with nothing behind it is a finding to a writer and
    a dead end to a reader, so reading must offer *fewer*. But Overview and
    Current State answer "who is this again", which is the whole reason the page
    is open, so they are offered whatever their counts.

    Comparing the same character in both modes rather than naming a tab: the
    first version of this asserted Goals was absent on Alice's first character,
    who turns out to have two. The rule is about the relationship between the
    two sets, not about any particular book's cast.
  */
  const worldId = await downloadLibraryBook(page, 'Alice\u2019s Adventures in Wonderland')
  await settle(page)
  await openFirstCharacter(page, worldId)
  const characterUrl = page.url()

  /*
    Without the count badge. A trigger reads "History 2", and the same tab reads
    a different count in the other mode, so comparing the raw text compares
    numbers rather than which tabs are offered.
  */
  const tabNames = async () => (await page.getByRole('tab').allInnerTexts())
    .map((t) => t.replace(/\s+/g, ' ').replace(/\s*\d+$/, '').trim())
  const reading = await tabNames()
  expect(reading, 'the two that are always offered').toEqual(
    expect.arrayContaining(['Overview', 'Current State']),
  )

  await page.evaluate(async (id) => {
    const db = (window as unknown as { __pwdb?: {
      worlds: { update: (id: string, changes: Record<string, unknown>) => Promise<number> }
    } }).__pwdb
    await db!.worlds.update(id, { readingMode: false })
  }, worldId)
  await page.goto(characterUrl, { waitUntil: 'load' })
  await settle(page)
  const writing = await tabNames()

  expect(writing.length, `reading ${reading.length}, writing ${writing.length}`)
    .toBeGreaterThan(reading.length)
  for (const name of reading) {
    expect(writing, `${name} is offered to a writer too`).toContain(name)
  }
  expect(writing, 'and Current State is among them').toEqual(
    expect.arrayContaining(['Overview', 'Current State']),
  )
})

test('the Goals tab hides what the reader has not reached, and counts what it shows', async ({ page }) => {
  /*
    A-5. A blind reader run met **Goals 2** on the tab above a panel reading
    *No goals yet*. `GoalsTab` filtered by `hasReached`; the badge was built
    from the unfiltered hook. The gate was right in both places and only the
    count disagreed.

    The fix moves the gate into `useGoalsForCharacter`, so both readers of the
    list get the same list — and that is exactly why this test must assert the
    *gating* rather than the agreement. The first version checked only that the
    badge matched the panel, and a mutant that ungated the hook passed it: with
    one source, both go wrong together and still agree. Asserting a hidden goal
    stays hidden is what kills that.
  */
  const worldId = await downloadLibraryBook(page, 'The Count of Monte Cristo')
  await settle(page)

  // A character with a goal the reader has reached and one they have not, so
  // both halves have something to be true about.
  const pick = await page.evaluate(`(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('KathalaDB')
    req.onsuccess = () => {
      const db = req.result
      const read = (s) => new Promise((r) => {
        const q = db.transaction(s, 'readonly').objectStore(s).getAll()
        q.onsuccess = () => r(q.result)
      })
      Promise.all([read('events'), read('chapters'), read('characterGoals')])
        .then(([events, chapters, goals]) => {
          const num = new Map(chapters.map((c) => [c.id, c.number]))
          const key = new Map(events.map((e) => [e.id, (num.get(e.chapterId) ?? 0) + e.sortOrder / 1e6]))
          const cursorId = JSON.parse(localStorage.getItem('kathala-ui') || '{}')?.state?.activeEventId
          const cursor = key.get(cursorId)
          if (cursor === undefined) return reject(new Error('the book did not open at a scene'))
          const byCharacter = new Map()
          for (const g of goals) {
            if (!byCharacter.has(g.characterId)) byCharacter.set(g.characterId, [])
            byCharacter.get(g.characterId).push(g)
          }
          for (const [characterId, list] of byCharacter) {
            const shown = list.filter((g) => !g.startEventId || (key.get(g.startEventId) ?? -Infinity) <= cursor)
            const hidden = list.filter((g) => g.startEventId && (key.get(g.startEventId) ?? -Infinity) > cursor)
            if (shown.length && hidden.length) {
              return resolve({ characterId, shownCount: shown.length, shown: shown[0].text, hidden: hidden[0].text })
            }
          }
          reject(new Error('no character has both a reached goal and an unreached one'))
        })
    }
  }))()`) as { characterId: string; shownCount: number; shown: string; hidden: string }

  await page.goto(`/#/worlds/${worldId}/characters/${pick.characterId}?tab=goals`, { waitUntil: 'load' })
  await settle(page)

  const panel = page.getByRole('tabpanel')
  await expect(panel.getByText(pick.shown, { exact: false }),
    'the goal the reader has reached is shown').toBeVisible()
  await expect(panel.getByText(pick.hidden, { exact: false }),
    'the goal they have not reached is not').toHaveCount(0)
  await expect(panel.getByText('No goals yet'),
    'and the panel is not empty behind a badge with a number on it').toHaveCount(0)

  /*
    `textContent`, not `innerText`: the count sits in an element `innerText`
    does not report — the tab's accessible name is "Goals 1" while its rendered
    text is "Goals" — so parsing `innerText` read every badge as zero and an
    earlier version of this failed against a working fix.
  */
  const tab = page.getByRole('tab', { name: /^Goals/ })
  const badge = Number((await tab.evaluate((el) => el.textContent ?? '')).replace(/[^0-9]/g, '') || '0')
  expect(badge, 'the badge counts the goals the panel shows, not all of them').toBe(pick.shownCount)
})
