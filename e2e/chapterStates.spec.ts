import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

const LONG_NOTE =
  'Kestrel arrives at the harbor exhausted and half-frozen, clutching the sealed letter she swore to deliver. ' +
  'She argues with the guildmaster about the missing shipment, realises the courier lied to her, and resolves ' +
  'to sail north before dawn despite the storm warnings. Underneath it all she is grieving her brother and ' +
  'hiding the fever that has been building for days.'

const SPEC = JSON.stringify({
  world: { name: 'Aethelgard' },
  characters: [{ name: 'Kestrel', tags: ['protagonist'] }],
  chapters: [
    {
      title: 'Landfall',
      events: [
        { id: 'e1', title: 'The wreck', characters: ['Kestrel'], changes: [{ who: 'Kestrel', note: LONG_NOTE }] },
      ],
    },
  ],
})

test.describe('Chapter detail — Character States', () => {
  // AI-spec world creation plus a route change is ~30s of real work, right on
  // Playwright's default per-test budget.
  test.describe.configure({ timeout: 90_000 })

  test.beforeEach(async ({ page }) => {
    await resetDB(page)
  })

  test('shows a long status note in full without clamping it', async ({ page }) => {
    // Seed a world with a long character status note via the AI spec import.
    await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
    await page.getByLabel('Story spec JSON').fill(SPEC)
    await page.getByRole('button', { name: 'Import world', exact: true }).click()
    await expect(page).toHaveURL(/#\/worlds\//)

    // Open the chapter's detail page.
    await page.getByRole('link', { name: /timeline/i }).click()
    await page.getByTitle('Open chapter detail').first().click()
    await expect(page.getByText('Character States')).toBeVisible()

    // The whole note is rendered (the tail sentence would be hidden if clamped).
    const note = page.getByText(/hiding the fever that has been building for days/)
    await expect(note).toBeVisible()

    // And it is not visually clamped: the paragraph's content is not taller than
    // its rendered box (line-clamp would make scrollHeight exceed clientHeight).
    const overflow = await note.evaluate((el) => el.scrollHeight - el.clientHeight)
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
