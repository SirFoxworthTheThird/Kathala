import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * F-7. Chapter Diff rendered a changed status note into two `truncate
 * max-w-[120px]` cells side by side, inside a 672px dialog — so a note ran out
 * of room after about a fifth of itself, with no `title` and no way to open it.
 * The panel said a note had changed and would not say to what.
 *
 * The two halves have to be asserted together. "Show the whole note" alone is
 * satisfied by removing the cap and letting the text run out of the dialog, and
 * "do not overflow" alone is satisfied by the truncation that was there. So:
 * every character of both notes is laid out, **and** nothing scrolls sideways.
 */

const BEFORE =
  'Keeping to her room since the funeral, and refusing to see anyone but the housekeeper, who reports she has not eaten.'
const AFTER =
  'Downstairs again, thinner, and civil to her brother for the first time since the reading of the will — though she still will not go near the east wing.'

async function twoChaptersWithANoteChange(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Highbarrow')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async (seed: { id: string; before: string; after: string }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }>
    const now = Date.now()
    const id = seed.id
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.bulkAdd([1, 2].map((n) => ({
      id: `ch${n}`, worldId: id, timelineId: 'tl', number: n, title: `Chapter ${n}`,
      synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
    })))
    await db.characters.add({
      id: 'anne', worldId: id, name: 'Anne Vesper', aliases: [], description: '',
      portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: now, updatedAt: now,
    })
    await db.events.bulkAdd([1, 2].map((n) => ({
      id: `ev${n}`, worldId: id, chapterId: `ch${n}`, timelineId: 'tl', title: `Scene ${n}`,
      description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: ['anne'], mentionedCharacterIds: [], involvedItemIds: [], threadIds: [],
      motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    })))
    /*
      Snapshots hang off the *event*, not the chapter — the diff reads each
      chapter's last scene — and `sortKey` is chapter number × 10 000 + the
      scene's position, as the type documents. Only the note differs between
      the two, so it is the one row the panel has to render.
    */
    await db.characterSnapshots.bulkAdd([
      { id: 'snap1', worldId: id, characterId: 'anne', eventId: 'ev1', sortKey: 10_000, isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [], inventoryNotes: '', statusNotes: seed.before, travelModeId: null, createdAt: now, updatedAt: now },
      { id: 'snap2', worldId: id, characterId: 'anne', eventId: 'ev2', sortKey: 20_000, isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [], inventoryNotes: '', statusNotes: seed.after, travelModeId: null, createdAt: now, updatedAt: now },
    ])
  }, { id: worldId, before: BEFORE, after: AFTER })

  await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
  await expect(page.locator('[data-chapter-bar]')).toBeVisible({ timeout: 30_000 })
  await page.getByTitle('Compare chapters').click()
  const panel = page.getByRole('dialog', { name: 'Chapter Diff' })
  await expect(panel).toBeVisible()
  await page.waitForTimeout(1200)
  return panel
}

/** Is every line of this element's text actually laid out inside its box? */
const clipping = (locator: ReturnType<Page['locator']>) =>
  locator.evaluate((el) => ({
    overflowX: el.scrollWidth - el.clientWidth,
    overflowY: el.scrollHeight - el.clientHeight,
    text: (el.textContent ?? '').trim(),
  }))

test.describe('Chapter Diff shows a changed note in full', () => {
  test.describe.configure({ timeout: 180_000 })

  test('both versions are laid out whole, and the dialog does not scroll sideways', async ({ page }) => {
    const panel = await twoChaptersWithANoteChange(page)

    // The row exists at all — without this the two measurements below would be
    // taken on an empty page and pass for the wrong reason.
    await expect(panel.getByText('Anne Vesper')).toBeVisible()
    await expect(panel.getByText('notes', { exact: true })).toBeVisible()

    for (const [label, text] of [['before', BEFORE], ['after', AFTER]] as const) {
      const cell = panel.locator('span', { hasText: text }).last()
      const measured = await clipping(cell)
      expect(measured.text, `the ${label} note should be present in full`).toContain(text)
      expect(measured.overflowX, `the ${label} note should not be cut off sideways`).toBeLessThanOrEqual(1)
      expect(measured.overflowY, `the ${label} note should not be cut off vertically`).toBeLessThanOrEqual(1)
    }

    /*
      The other half. Letting the note run at its natural width would satisfy
      everything above and push the dialog's content past its own edge, which is
      a worse bug than the truncation — so the panel is measured too.
    */
    const panelOverflow = await panel.evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(panelOverflow, 'the dialog must not scroll sideways').toBeLessThanOrEqual(1)
    const bodyOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(bodyOverflow, 'the page must not scroll sideways either').toBeLessThanOrEqual(1)
  })
})
