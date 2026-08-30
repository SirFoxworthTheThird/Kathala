import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/**
 * OP-5 and CD-2 are the same defect with two symptoms: nothing set the time
 * cursor. The whole app answers "what is true at this exact moment?", so an
 * unset cursor switches every per-moment tool off.
 *
 * The rule itself is unit-tested in src/lib/__tests__/chapterCursor.test.ts.
 * This drives the two places it applies.
 */
test.describe('The time cursor follows you', () => {
  test.describe.configure({ timeout: 150_000 })

  const cursor = (page: import('@playwright/test').Page) => page.locator('header').first()

  test('CD-2: opening a chapter puts you in it, and leaves you where you already were', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Cursor')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]

    await page.evaluate(async ({ worldId }) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<
        string,
        { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }
      >
      const now = Date.now()
      await db.timelines.add({ id: 'tl', worldId, name: 'Main', description: '', color: '#60a5fa', createdAt: now })
      await db.chapters.bulkAdd([1, 2].map((n) => ({
        id: `ch${n}`, worldId, timelineId: 'tl', number: n, title: `Chapter ${n}`,
        synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
      })))
      const base = {
        worldId, timelineId: 'tl', description: '', locationMarkerId: null,
        involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        tags: [], threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
        tension: null, structureBeat: null, status: 'draft', povCharacterId: null,
        isFlashback: false, createdAt: now, updatedAt: now,
      }
      await db.events.bulkAdd([
        { ...base, id: 'a1', chapterId: 'ch1', title: 'Opening', sortOrder: 0 },
        { ...base, id: 'a2', chapterId: 'ch1', title: 'Second scene', sortOrder: 1 },
        { ...base, id: 'b1', chapterId: 'ch2', title: 'Later opening', sortOrder: 0 },
      ])
    }, { worldId })

    // Absence: a fresh world sits on "All chapters".
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await expect(cursor(page)).toContainText('All chapters', { timeout: 30_000 })

    // Presence: opening a chapter lands you on its first moment, so the
    // per-moment tools have something to answer about.
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await expect(cursor(page)).toContainText('Opening', { timeout: 15_000 })
    await expect(cursor(page)).not.toContainText('All chapters')

    // The Writer's Brief was the symptom measured in the review: it opened empty
    // while the chapter was on screen. Asserted as a presence — its no-cursor
    // state is now a scene picker (WB-1) rather than a sentence, so checking for
    // the sentence's absence would prove nothing.
    await page.getByTitle("Writer's Brief").click()
    await expect(page.getByText('Active scene')).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('Escape')

    // Opening a different chapter moves you to that one.
    await page.goto(`/#/worlds/${worldId}/timeline/ch2`, { waitUntil: 'load' })
    await expect(cursor(page)).toContainText('Later opening', { timeout: 15_000 })

    // But a cursor already inside the chapter is left alone — a writer who set
    // it to a scene and then opened that scene's chapter has already said where
    // they want to be. Vacuity cannot satisfy this and the moves above at once.
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await expect(cursor(page)).toContainText('Opening', { timeout: 15_000 })
    // Move on by hand, the way a writer would, then leave and come back: the
    // cursor they set is still theirs. Navigating out to the chapter list and
    // back in remounts the view, so this is a real re-arrival rather than a
    // no-op — and a reload would not do, because the store rehydrates its
    // persisted cursor after the effect has already run and would mask this.
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await expect(cursor(page)).toContainText('Opening', { timeout: 15_000 })
    await page.getByRole('button', { name: 'Next moment' }).click()
    await expect(cursor(page)).toContainText('Second scene', { timeout: 15_000 })

    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await expect(cursor(page)).toContainText('Second scene', { timeout: 15_000 })
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await expect(cursor(page)).toContainText('Second scene', { timeout: 15_000 })
    await expect(cursor(page)).not.toContainText('· Opening')
  })

  test('OP-5: finishing the first-run guide leaves you at the moment it made', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Guided')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    // The guide opens on a blank world. There is no cursor pill at all yet —
    // with no timeline there is nothing to be a moment in.
    await expect(page.getByRole('navigation', { name: 'Wizard progress' })).toBeVisible({ timeout: 30_000 })
    await expect(cursor(page)).not.toContainText('Ch.')

    // Step 1 is headed "Your story begins with a moment" and creates one.
    await page.getByLabel('Timeline name').fill('Main Timeline')
    await page.getByLabel('The first scene').fill('The wreck')
    await page.getByRole('button', { name: 'Create and continue' }).click()

    // The guide chose a moment on the writer's behalf, so the app is now in it —
    // rather than handing back an app that had forgotten.
    await expect(cursor(page)).not.toContainText('All chapters', { timeout: 15_000 })
    await expect(cursor(page)).toContainText('Ch.1')
  })

  test('reading mode is left where the reader is', async ({ page }) => {
    // There the cursor is the reader's own place in the book, so moving it
    // forward to wherever a chapter happened to be opened would hand them the
    // part they have not reached.
    await resetDB(page)
    await page.getByRole('button', { name: 'Library', exact: true }).click()
    await page.getByRole('button', { name: /^Download \(/ }).first().click()
    await expect(page).toHaveURL(/#\/worlds\//, { timeout: 60_000 })
    await page.waitForTimeout(1500)
    const worldId = new URL(page.url()).hash.split('/')[2]

    await page.getByRole('button', { name: 'Next moment' }).click()
    await settle(page)
    const before = await cursor(page).innerText()
    expect(before, 'the reader should be near the start').toContain('Ch.1')

    // Open a chapter the reader has *not* reached. Ungated, this would drag the
    // cursor forward to that chapter's opening scene — handing them the part of
    // the book they came here to avoid.
    const chapterId = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        chapters: { toArray: () => Promise<{ id: string; number: number }[]> }
      }
      const chapters = (await db.chapters.toArray()).sort((a, b) => a.number - b.number)
      return chapters[chapters.length - 1]?.id ?? null
    })
    expect(chapterId, 'the fixture should have chapters').not.toBeNull()

    await page.goto(`/#/worlds/${worldId}/timeline/${chapterId}`, { waitUntil: 'load' })
    await settle(page)
    expect(await cursor(page).innerText(), 'reading mode should not move the reader').toBe(before)
  })
})
