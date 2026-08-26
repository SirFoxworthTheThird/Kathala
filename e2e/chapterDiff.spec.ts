import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * DF-1, DF-2, DF-3 — the Chapter Diff tool.
 *
 * All three come from one design mistake: the tool took its base side from the
 * time cursor and nothing else. That is why its button was hidden until an
 * event was active, why the panel opened with one side unchosen, and why the
 * only thing it could say about two chapters full of prose was that they had no
 * recorded differences.
 */

const SPEC = JSON.stringify({
  world: { name: 'Aethelgard' },
  characters: [{ name: 'Kestrel' }],
  chapters: [
    { title: 'Landfall', events: [{ id: 'e1', title: 'The wreck', characters: ['Kestrel'] }] },
    { title: 'Ashfall', events: [{ id: 'e2', title: 'The long road', characters: ['Kestrel'] }] },
  ],
})

/** One chapter only — nothing to compare it against. */
const LONE = JSON.stringify({
  world: { name: 'Solo' },
  chapters: [{ title: 'Landfall', events: [{ id: 'e1', title: 'The wreck' }] }],
})

async function worldFromSpec(page: Page, spec: string) {
  await resetDB(page)
  await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
  await page.getByLabel('Story spec JSON').fill(spec)
  await page.getByRole('button', { name: 'Import world', exact: true }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
  return page.url().split('/worlds/')[1].split('/')[0]
}

const diffButton = (page: Page) => page.getByTitle('Compare chapters')

test.describe('Chapter Diff', () => {
  test.describe.configure({ timeout: 150_000 })

  test('DF-1: the tool is offered when there are two chapters, cursor or no cursor', async ({ page }) => {
    const worldId = await worldFromSpec(page, SPEC)
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })

    // Presence: with the cursor on "all chapters" — the state the finding
    // measured as showing the button 0 times — it is there.
    await expect(page.locator('[data-chapter-bar]')).toBeVisible({ timeout: 30_000 })
    await expect(diffButton(page)).toBeVisible()

    // Absence, in the same suite: one chapter is nothing to compare, so the
    // button is not offered at all. Vacuity cannot satisfy both.
    const soloId = await worldFromSpec(page, LONE)
    await page.goto(`/#/worlds/${soloId}/timeline`, { waitUntil: 'load' })
    await expect(page.locator('[data-chapter-bar]')).toBeVisible({ timeout: 30_000 })
    await expect(diffButton(page)).toHaveCount(0)
  })

  test('DF-2: both sides open already chosen', async ({ page }) => {
    const worldId = await worldFromSpec(page, SPEC)
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await expect(diffButton(page)).toBeVisible({ timeout: 30_000 })
    await diffButton(page).click()

    const panel = page.getByRole('dialog', { name: 'Chapter Diff' })
    await expect(panel).toBeVisible()

    // With exactly one candidate on each side, neither is left for the user to
    // pick — the panel used to open with "Compare with…" and one real option.
    await expect(panel.getByLabel('Base chapter')).not.toHaveValue('')
    await expect(panel.getByLabel('Chapter to compare against')).not.toHaveValue('')

    // And they are different chapters, so the diff is a real comparison.
    const base = await panel.getByLabel('Base chapter').inputValue()
    const against = await panel.getByLabel('Chapter to compare against').inputValue()
    expect(base).not.toBe(against)

    // The base is a control now, not a readout of wherever the cursor was — and
    // choosing the other chapter as the base moves the comparison off it rather
    // than diffing a chapter against itself.
    await panel.getByLabel('Base chapter').selectOption({ label: 'Ch. 2 — Ashfall' })
    await expect.poll(() => panel.getByLabel('Chapter to compare against').inputValue())
      .not.toBe(await panel.getByLabel('Base chapter').inputValue())
    await expect(panel.getByLabel('Chapter to compare against')).not.toHaveValue('')
  })

  test('DF-3: two chapters with no state recorded are told so, not told they match', async ({ page }) => {
    const worldId = await worldFromSpec(page, SPEC)
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await expect(diffButton(page)).toBeVisible({ timeout: 30_000 })
    await diffButton(page).click()

    const panel = page.getByRole('dialog', { name: 'Chapter Diff' })
    await expect(panel).toBeVisible()

    // The AI import records a snapshot where a character first appears, so
    // "nothing recorded" has to be reached deliberately rather than assumed.
    await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        characterSnapshots: { clear: () => Promise<void> }
        relationshipSnapshots: { clear: () => Promise<void> }
        itemPlacements: { clear: () => Promise<void> }
      }
      await db.characterSnapshots.clear()
      await db.relationshipSnapshots.clear()
      await db.itemPlacements.clear()
    })

    await expect(panel.getByText(/Neither chapter has any state recorded/))
      .toBeVisible({ timeout: 15_000 })
    // It says what it reads, and what it does not.
    await expect(panel.getByText(/Scene prose and word counts are not part of it/)).toBeVisible()
    // The old sentence claimed the chapters were the same.
    await expect(panel.getByText('No recorded differences between these chapters.')).toHaveCount(0)
  })
})
