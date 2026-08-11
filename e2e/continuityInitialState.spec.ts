import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * HB-1, the Highbarrow review's strongest finding.
 *
 * > *"Its action opened the chapter but did not take the writer to a state
 * > form or offer a one-click initial snapshot… A writer must already
 * > understand PlotWeave's delta model, move the time cursor, leave the scene,
 * > open each character, find Current State, and save a record. For a group
 * > scene, this becomes repetitive and easy to miss."*
 *
 * Their acceptance criterion is the shape of these tests: create the first
 * state without leaving, and watch the warning clear. The ensemble case gets
 * its own test, because "eight buttons instead of one" would have answered the
 * letter of the finding and not the complaint.
 *
 * The issue and its fix payload are unit-tested in
 * `src/lib/__tests__/computeIssues.test.ts`; what is driven here is that the
 * button writes a record and the panel notices.
 */

const CAST = ['Foxworth', 'Barnaby', 'Vargan']

async function ensembleScene(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Highbarrow')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]

  await page.evaluate(async ({ id, cast }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({
      id: 'tl1', worldId: id, name: 'Main', description: '',
      color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now,
    })
    await db.chapters.add({
      id: 'ch1', worldId: id, timelineId: 'tl1', number: 1, title: 'Chapter 1',
      synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
    })
    await db.characters.bulkAdd(cast.map((name, i) => ({
      id: `c${i}`, worldId: id, name, aliases: [], description: '',
      portraitImageId: null, tags: [], isAlive: true, color: null,
      createdAt: now, updatedAt: now,
    })))
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl1',
      title: 'Seven Specialists Return', description: '', sortOrder: 0, tags: [],
      locationMarkerId: null, involvedCharacterIds: cast.map((_, i) => `c${i}`),
      mentionedCharacterIds: [], involvedItemIds: [], threadIds: [], motifIds: [],
      travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: null, tension: null, isFlashback: false,
      createdAt: now, updatedAt: now,
    })
  }, { id: worldId, cast: CAST })

  await page.goto(`/#/worlds/${worldId}`)
  await page.waitForTimeout(800)
  await page.getByTitle('Continuity Checker').click()
  await expect(page.getByText('Continuity Checker')).toBeVisible()
  return worldId
}

/** How many snapshots exist, read from the store rather than inferred. */
function snapshotCount(page: Page) {
  return page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      { characterSnapshots: { count: () => Promise<number> } }
    return db.characterSnapshots.count()
  })
}

const warnings = (page: Page) => page.getByText(/appears before any snapshot record/)

test.describe('Recording an initial state from the continuity warning', () => {
  test.describe.configure({ timeout: 180_000 })

  test('one character: the button writes the record and the warning goes', async ({ page }) => {
    await ensembleScene(page)

    // Presence first, so the disappearance below means something.
    await expect(warnings(page)).toHaveCount(CAST.length)
    expect(await snapshotCount(page), 'nothing recorded yet').toBe(0)

    const fixes = page.getByRole('button', { name: 'Record initial state here' })
    await expect(fixes).toHaveCount(CAST.length)
    await fixes.first().click()

    // One record written, one warning fewer — and the writer never left.
    await expect.poll(() => snapshotCount(page)).toBe(1)
    await expect(warnings(page)).toHaveCount(CAST.length - 1)
    await expect(page.getByText('Continuity Checker')).toBeVisible()
  })

  test('the ensemble: one control clears the run', async ({ page }) => {
    await ensembleScene(page)
    await expect(warnings(page)).toHaveCount(CAST.length)

    // The complaint was the repetition, so the batch is the fix for it.
    await page.getByRole('button', { name: `Record initial state for all ${CAST.length}` }).click()

    await expect.poll(() => snapshotCount(page)).toBe(CAST.length)
    await expect(warnings(page)).toHaveCount(0)
  })

  test('a suppressed row is left out of the batch, not quietly fixed with it', async ({ page }) => {
    await ensembleScene(page)
    await expect(warnings(page)).toHaveCount(CAST.length)

    // Suppress the first row. Suppressing says "I know, and I mean it" — the
    // batch must respect that rather than write the record anyway.
    await page.getByRole('button', { name: 'Suppress this issue' }).first().click()
    await page.getByTitle('Confirm suppress').click()
    await expect(warnings(page)).toHaveCount(CAST.length - 1)

    // Turn the suppressed row back on. This is the case the batch's own filter
    // exists for, and the only one: with the toggle off the section has already
    // dropped suppressed rows before the batch sees them, so a mutation
    // removing that filter survived until this test drove the toggle.
    await page.getByRole('button', { name: `Show 1 suppressed` }).click()
    await expect(warnings(page)).toHaveCount(CAST.length)

    // The count on the button is the evidence: two, not three, even though all
    // three rows are on screen.
    await page.getByRole('button', { name: `Record initial state for all ${CAST.length - 1}` }).click()
    await expect.poll(() => snapshotCount(page)).toBe(CAST.length - 1)

    // …and the one held back is still without a record, which is the half that
    // a batch reading straight off the group would have got wrong.
    const suppressedHasNoState = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { characterSnapshots: { toArray: () => Promise<{ characterId: string }[]> } }
      const rows = await db.characterSnapshots.toArray()
      return !rows.some((r) => r.characterId === 'c0')
    })
    expect(suppressedHasNoState, 'the suppressed character should still have no state').toBe(true)
  })

  test('the batch control is absent when there is nothing to batch', async ({ page }) => {
    const worldId = await ensembleScene(page)

    // Absence paired with presence: at three it is offered…
    await expect(page.getByRole('button', { name: /^Record initial state for all/ })).toHaveCount(1)

    // …and at one it is not, because the row already carries its own button.
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { update: (id: string, changes: object) => Promise<unknown> }>
      await db.events.update('ev1', { involvedCharacterIds: ['c0'], worldId: id })
    }, worldId)

    await expect(warnings(page)).toHaveCount(1)
    await expect(page.getByRole('button', { name: /^Record initial state for all/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Record initial state here' })).toHaveCount(1)
  })
})
