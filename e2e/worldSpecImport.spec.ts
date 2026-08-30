import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

const SPEC = JSON.stringify({
  format: 'plotweave-spec',
  version: 1,
  world: { name: 'Aethelgard', description: 'A storm-wracked archipelago.' },
  characters: [
    { name: 'Kestrel', tags: ['protagonist'] },
    { name: 'Vane' },
  ],
  factions: [{ name: 'The Tide Wardens', members: ['Kestrel'] }],
  chapters: [
    {
      title: 'Landfall', synopsis: 'Kestrel reaches the outer isles.',
      events: [
        { id: 'e1', title: 'The wreck', characters: ['Kestrel'], changes: [{ who: 'Kestrel', note: 'Washed ashore.' }] },
      ],
    },
    {
      title: 'The Warden’s Bargain',
      events: [
        { id: 'e2', title: 'A deal is struck', characters: ['Kestrel', 'Vane'] },
      ],
    },
  ],
}, null, 2)

test.describe('Generate World from AI (spec import)', () => {
  test.beforeEach(async ({ page }) => {
    await resetDB(page)
  })

  test('imports a pasted story spec into a new world', async ({ page }) => {
    await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
    await expect(page.getByRole('heading', { name: 'Generate World from AI' })).toBeVisible()

    // The import button is disabled until a valid spec is pasted.
    const importBtn = page.getByRole('button', { name: 'Import world', exact: true })
    await expect(importBtn).toBeDisabled()

    await page.getByLabel('Story spec JSON').fill(SPEC)

    // Live preview reflects the parsed spec.
    await expect(page.getByText(/2 characters · 2 chapters · 2 scenes/)).toBeVisible()
    await expect(importBtn).toBeEnabled()

    await importBtn.click()
    await expect(page).toHaveURL(/#\/worlds\//)
    await expect(page.getByText('Aethelgard').first()).toBeVisible()

    // The imported characters are present.
    await page.getByRole('link', { name: /characters/i }).click()
    await expect(page.getByText('Kestrel')).toBeVisible()
    await expect(page.getByText('Vane')).toBeVisible()
  })

  test('shows an error for invalid JSON', async ({ page }) => {
    await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
    await page.getByLabel('Story spec JSON').fill('{ not valid json')
    await expect(page.getByText(/isn.t valid JSON/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Import world', exact: true })).toBeDisabled()
  })
})
