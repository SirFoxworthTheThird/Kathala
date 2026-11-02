import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/*
  Part G, writer A3: "Find & replace turns line breaks into spaces, so I split
  those paragraphs again by hand on the Page." Its replacements held no line
  break of their own; the paragraphs around them were joined.
*/

const MANUSCRIPT = [
  '# The Long Road',
  '',
  '## Chapter 1: Departure',
  '',
  'Mira left before dawn.',
  '',
  'The road belonged to her now.',
  '',
  'She did not look back.',
].join('\n')

async function proseOf(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<{ text: string }>> }>
    return (await db.sceneTexts.toArray()).map((s) => s.text)
  })
}

test('find & replace with the Page open keeps the paragraphs', async ({ page }) => {
  test.setTimeout(90_000)
  await resetDB(page)
  await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
  await page.getByLabel('Manuscript text').fill(MANUSCRIPT)
  await page.getByRole('button', { name: /^Import/ }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]

  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.locator('.cm-content')).toContainText('Mira left before dawn.')
  const before = await proseOf(page)
  expect(before.join('\n')).toContain('Mira left before dawn.\n\nThe road')

  // What A3 did: put a new paragraph in by replacing a line with two.
  await page.getByRole('button', { name: /Find & replace/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('Find…').fill('The road belonged to her now.')
  await dialog.getByPlaceholder('Replace with…').fill('The road belonged to her now.\n\nIt always had.')
  await dialog.getByRole('button', { name: 'Replace all' }).click()
  await expect(dialog.getByText(/Replaced 1 occurrence/)).toBeVisible()
  await page.keyboard.press('Escape')

  await expect.poll(async () => (await proseOf(page)).join('\n')).toContain('It always had.')
  expect((await proseOf(page)).join('\n'))
    .toContain('Mira left before dawn.\n\nThe road belonged to her now.\n\nIt always had.\n\nShe did not look back.')
  // The Page shows it as its own paragraph, not run on after the last.
  await expect(page.locator('.cm-line', { hasText: 'It always had.' })).toHaveText('It always had.')
  await expect(page.locator('.cm-line', { hasText: 'The road belonged' })).toHaveText('The road belonged to her now.')
})

test('find spans a paragraph break', async ({ page }) => {
  test.setTimeout(90_000)
  await resetDB(page)
  await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
  await page.getByLabel('Manuscript text').fill(MANUSCRIPT)
  await page.getByRole('button', { name: /^Import/ }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.goto(`/#/worlds/${worldId}/manuscript?view=read`, { waitUntil: 'load' })

  await page.getByRole('button', { name: /Find & replace/ }).click()
  const dialog = page.getByRole('dialog')
  // Across the break: found. Joined with a space instead: not there to find.
  await dialog.getByPlaceholder('Find…').fill('dawn.\n\nThe road')
  await expect(dialog.getByText(/1 match in 1 scene/)).toBeVisible()
  await dialog.getByPlaceholder('Find…').fill('dawn. The road')
  await expect(dialog.getByText('No matches.')).toBeVisible()
})
