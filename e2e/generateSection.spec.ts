import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

test.describe('Generate a section with AI', () => {
  test('adds pasted characters to the current world, skipping duplicates', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Aethel')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

    // Seed one existing character so we can prove duplicates are skipped.
    await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Aria Vale')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Aria Vale')).toBeVisible()

    // Open the AI dialog and paste a result that includes the existing name.
    await page.getByRole('button', { name: 'Generate with AI' }).click()
    const json = JSON.stringify({
      characters: [
        { name: 'Aria Vale', description: 'dupe — should be skipped' },
        { name: 'Bran Holt', description: 'A grizzled captain.' },
        { name: 'Mira Sol', aliases: ['The Spark'] },
      ],
    })
    await page.getByRole('textbox', { name: 'characters JSON' }).fill(json)
    await expect(page.getByText(/Ready to add 3 characters/)).toBeVisible()

    await page.getByRole('button', { name: 'Add characters' }).click()

    // Result banner: 2 added, 1 skipped.
    await expect(page.getByText(/Added 2 characters · skipped 1 already present/)).toBeVisible()

    await page.getByRole('button', { name: 'Done' }).click()

    // The two new characters are on the roster; the seed is still unique.
    await expect(page.getByText('Bran Holt')).toBeVisible()
    await expect(page.getByText('Mira Sol')).toBeVisible()
    await expect(page.getByText('Aria Vale')).toHaveCount(1)
  })

  test('adds pasted items to the current world', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Aethel')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

    await page.goto(`/#/worlds/${worldId}/items`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Generate with AI' }).click()
    const json = JSON.stringify({
      items: [
        { name: 'Excalibur', icon: 'weapon', description: 'A famous sword.' },
        { name: 'Healing Draught', icon: 'potion' },
      ],
    })
    await page.getByRole('textbox', { name: 'items JSON' }).fill(json)
    await expect(page.getByText(/Ready to add 2 items/)).toBeVisible()

    await page.getByRole('button', { name: 'Add items' }).click()
    await expect(page.getByText(/Added 2 items/)).toBeVisible()

    await page.getByRole('button', { name: 'Done' }).click()
    await expect(page.getByText('Excalibur')).toBeVisible()
    await expect(page.getByText('Healing Draught')).toBeVisible()
  })

  test('adds pasted factions and links members to existing characters', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Aethel')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

    // Seed a character so the faction has a member to link.
    await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Aria Vale')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Aria Vale')).toBeVisible()

    await page.goto(`/#/worlds/${worldId}/factions`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Generate with AI' }).click()
    const json = JSON.stringify({
      factions: [
        { name: 'The Harbor Watch', description: 'City guard', members: [{ name: 'Aria Vale', role: 'Captain' }, 'Unknown Person'] },
      ],
    })
    await page.getByRole('textbox', { name: 'factions JSON' }).fill(json)
    await expect(page.getByText(/Ready to add 1 faction/)).toBeVisible()

    await page.getByRole('button', { name: 'Add factions' }).click()
    await expect(page.getByText(/Added 1 faction/)).toBeVisible()

    await page.getByRole('button', { name: 'Done' }).click()

    // The faction is listed, and opening it shows the linked member.
    await page.getByText('The Harbor Watch').first().click()
    await expect(page.getByText('Aria Vale')).toBeVisible()
    await expect(page.getByText('Captain')).toBeVisible()
  })
})
