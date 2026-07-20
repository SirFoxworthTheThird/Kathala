import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

test.describe('Generate a section with AI', () => {
  test('adds new characters and updates an existing one in place', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Aethel')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

    // Seed one existing character so we can prove a match is updated, not duplicated.
    await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Aria Vale')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Aria Vale')).toBeVisible()

    // Open the AI dialog and paste a result that includes the existing name.
    await page.getByRole('button', { name: 'Generate with AI' }).click()
    const json = JSON.stringify({
      characters: [
        { name: 'Aria Vale', description: 'A cunning thief.' }, // matches the seed → updated
        { name: 'Bran Holt', description: 'A grizzled captain.' },
        { name: 'Mira Sol', aliases: ['The Spark'] },
      ],
    })
    await page.getByRole('textbox', { name: 'characters JSON' }).fill(json)
    await expect(page.getByText(/Ready to import 3 characters/)).toBeVisible()

    await page.getByRole('button', { name: 'Add characters' }).click()

    // Result banner: 2 added, 1 updated.
    await expect(page.getByText(/Added 2 characters/)).toBeVisible()
    await expect(page.getByText(/updated 1/)).toBeVisible()

    await page.getByRole('button', { name: 'Done' }).click()

    // The two new characters are on the roster; the seed is updated, not duplicated.
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
    await expect(page.getByText(/Ready to import 2 items/)).toBeVisible()

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
    await expect(page.getByText(/Ready to import 1 faction/)).toBeVisible()

    await page.getByRole('button', { name: 'Add factions' }).click()
    await expect(page.getByText(/Added 1 faction/)).toBeVisible()

    await page.getByRole('button', { name: 'Done' }).click()

    // The faction is listed, and opening it shows the linked member.
    await page.getByText('The Harbor Watch').first().click()
    await expect(page.getByText('Aria Vale')).toBeVisible()
    await expect(page.getByText('Captain')).toBeVisible()
  })

  test('adds pasted relationships between existing characters', async ({ page }) => {
    test.slow() // the relationships graph mounts a heavy ReactFlow canvas
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Aethel')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

    // Seed two characters so the relationship has endpoints.
    await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
    for (const name of ['Aria Vale', 'Bran Holt']) {
      await page.getByRole('button', { name: 'Add Character' }).first().click()
      await page.getByPlaceholder('Character name').fill(name)
      await page.getByRole('button', { name: 'Add Character' }).last().click()
      await expect(page.getByText(name)).toBeVisible()
    }

    await page.goto(`/#/worlds/${worldId}/relationships`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Generate with AI' }).click()
    const json = JSON.stringify({
      relationships: [
        { a: 'Aria Vale', b: 'Bran Holt', label: 'allies', strength: 'strong', sentiment: 'positive' },
        { a: 'Aria Vale', b: 'Ghost', label: 'haunts' }, // unknown endpoint — skipped
      ],
    })
    await page.getByRole('textbox', { name: 'relationships JSON' }).fill(json)
    await expect(page.getByText(/Ready to import 2 relationships/)).toBeVisible()

    await page.getByRole('button', { name: 'Add relationships' }).click()
    await expect(page.getByText(/Added 1 relationship.*1 unchanged/)).toBeVisible()

    await page.getByRole('button', { name: 'Done' }).click()

    // The new edge is labelled on the graph.
    await expect(page.getByText('allies').first()).toBeVisible()
  })

  test('adds pasted lore pages grouped into categories', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Aethel')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

    await page.goto(`/#/worlds/${worldId}/lore`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Generate with AI' }).click()
    const json = JSON.stringify({
      lore: [
        { category: 'Magic', title: 'The Weave', body: 'How magic flows.' },
        { category: 'History', title: 'The Sundering', body: 'The great split.' },
      ],
    })
    await page.getByRole('textbox', { name: 'lore pages JSON' }).fill(json)
    await expect(page.getByText(/Ready to import 2 lore pages/)).toBeVisible()

    await page.getByRole('button', { name: 'Add lore pages' }).click()
    await expect(page.getByText(/Added 2 lore pages/)).toBeVisible()

    await page.getByRole('button', { name: 'Done' }).click()

    // The pages and their categories are listed.
    await expect(page.getByText('The Weave')).toBeVisible()
    await expect(page.getByText('The Sundering')).toBeVisible()
  })

  test('adds pasted knowledge facts to the current world', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Aethel')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

    await page.goto(`/#/worlds/${worldId}/knowledge`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Generate with AI' }).click()
    const json = JSON.stringify({
      knowledge: [
        { title: 'The king is dead', description: 'Only a few know.' },
        { title: 'The heir is illegitimate' },
      ],
    })
    await page.getByRole('textbox', { name: 'facts JSON' }).fill(json)
    await expect(page.getByText(/Ready to import 2 facts/)).toBeVisible()

    await page.getByRole('button', { name: 'Add facts' }).click()
    await expect(page.getByText(/Added 2 facts/)).toBeVisible()

    await page.getByRole('button', { name: 'Done' }).click()
    await expect(page.getByText('The king is dead')).toBeVisible()
    await expect(page.getByText('The heir is illegitimate')).toBeVisible()
  })

  test('generates a location tree onto an auto-created map', async ({ page }) => {
    test.slow() // rendering the generated map mounts a Leaflet canvas
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Aethel')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

    // Maps view starts empty; generate a small tree.
    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Generate locations with AI' }).click()
    const json = JSON.stringify({
      locations: [
        { name: 'Aethelgard', type: 'region', children: [
          { name: 'Ironhold', type: 'city' },
          { name: 'Greywood', type: 'town' },
        ]},
      ],
    })
    await page.getByRole('textbox', { name: 'locations JSON' }).fill(json)
    await expect(page.getByText(/Ready to import 3 locations/)).toBeVisible()

    // Applying draws the placeholder image on a real canvas and saves the map.
    // As soon as the first map exists the empty state is replaced by the map
    // view (unmounting this dialog), so the map's own toolbar is the signal that
    // generation succeeded — reaching it also proves the canvas path worked.
    await page.getByRole('button', { name: 'Add locations' }).click()
    await expect(page.getByRole('button', { name: 'AI Locations' })).toBeVisible({ timeout: 15_000 })

    // Re-opening from the toolbar, the prompt now lists the places that exist,
    // so the AI extends the tree instead of repeating it.
    await page.getByRole('button', { name: 'AI Locations' }).click()
    const promptBlock = page.locator('pre')
    await expect(promptBlock).toContainText('ALREADY IN THIS WORLD')
    await expect(promptBlock).toContainText('Aethelgard')
    await expect(promptBlock).toContainText('Ironhold')

    // A stray "Locations" wrapper root is unwrapped, not counted/created:
    // this 3-node payload (Locations + 2 children) imports as just 2 places.
    await page.getByRole('textbox', { name: 'locations JSON' }).fill(JSON.stringify({
      locations: [{ name: 'Locations', children: [{ name: 'New Region' }, { name: 'Another Region' }] }],
    }))
    await expect(page.getByText(/Ready to import 2 locations/)).toBeVisible()
  })
})
