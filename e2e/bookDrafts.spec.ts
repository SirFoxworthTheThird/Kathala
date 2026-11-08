import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/*
  Named drafts of the book (editorial-plan.md, R3): a draft saved, the book
  split and edited after it, the two compared — the split named as such, each
  scene opened in the diff — and a scene's prose restored from the draft.
*/

const MANUSCRIPT = [
  '# The Salt Ledger',
  '',
  '## Chapter 1: The Weighing House',
  '',
  'The ferry left at dawn.',
  '',
  'Mira counted the crates.',
  '',
  'There were eleven.',
].join('\n')

async function prose(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<{ text: string }>> }>
    return (await db.sceneTexts.toArray()).map((t) => t.text)
  })
}

test('a draft saved, the book split and edited, compared, and a scene restored from the draft', async ({ page }) => {
  test.setTimeout(120_000)
  await resetDB(page)
  await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
  await page.getByLabel('Manuscript text').fill(MANUSCRIPT)
  await page.getByRole('button', { name: /^Import/ }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.locator('.cm-content')).toContainText('Mira counted the crates.')

  // Saved, named.
  await page.getByRole('main').getByRole('button', { name: 'Drafts', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Drafts of the book' })
  await expect(dialog.getByText('No drafts yet.', { exact: false })).toBeVisible()
  await dialog.getByRole('textbox', { name: 'Name this draft' }).fill('Draft 1, sent to Ana')
  await dialog.getByRole('button', { name: 'Save a draft' }).click()
  const drafts = dialog.getByRole('list', { name: 'Drafts' })
  await expect(drafts.getByRole('listitem')).toHaveCount(1)
  await expect(drafts).toContainText('Draft 1, sent to Ana')
  await expect(drafts).toContainText('12 words')
  await page.keyboard.press('Escape')

  // After it: the scene split before "Mira", and its first line edited.
  await page.locator('.cm-line', { hasText: 'Mira counted the crates.' }).click()
  await page.keyboard.press('Home')
  await page.keyboard.press('ControlOrMeta+Shift+Enter')
  await page.keyboard.type('Counting')
  await page.keyboard.press('Enter')
  await expect.poll(() => prose(page), { timeout: 10_000 }).toHaveLength(2)
  await page.locator('.cm-line', { hasText: 'The ferry left at dawn.' }).click()
  await page.keyboard.press('End')
  await page.keyboard.press('Backspace')
  await page.keyboard.type(', late.')
  await expect.poll(async () => (await prose(page)).join('|'), { timeout: 10_000 }).toContain('The ferry left at dawn, late.')

  // Compared with now: the first scene edited, the second split from it.
  await page.getByRole('main').getByRole('button', { name: 'Drafts', exact: true }).click()
  await drafts.getByRole('button', { name: 'Compare with now' }).click()
  await expect(dialog.getByRole('status')).toContainText('2 scenes changed')
  const changed = dialog.getByRole('list', { name: 'Scenes that changed' })
  await expect(changed.getByRole('listitem')).toHaveCount(2)
  await expect(changed.getByRole('listitem').nth(0)).toContainText('Edited')
  // And the first says why its prose is shorter: its other half is the new scene.
  await expect(changed.getByRole('listitem').nth(0)).toContainText('Split: the rest is now “Counting”')
  await expect(changed.getByRole('listitem').nth(1)).toContainText('Counting')
  await expect(changed.getByRole('listitem').nth(1)).toContainText('Split from “Scene 1”')

  // The first scene's diff: its own words removed and added.
  await changed.getByRole('listitem').nth(0).getByRole('button').click()
  const diff = dialog.getByLabel('What changed in the scene')
  await expect(diff.locator('[data-diff="add"]', { hasText: 'late.' })).toBeVisible()
  await expect(diff.locator('[data-diff="remove"]').first()).toBeVisible()

  // Restored from the draft: its prose is the draft's again, all three paragraphs, and the comparison says so.
  await dialog.getByRole('button', { name: 'Restore this scene from the draft' }).click()
  await page.getByRole('alertdialog').or(page.getByRole('dialog', { name: /Restore this scene/ })).getByRole('button', { name: 'Restore', exact: true }).click()
  await expect.poll(async () => (await prose(page)).sort()).toEqual([
    'Mira counted the crates.\n\nThere were eleven.',
    'The ferry left at dawn.\n\nMira counted the crates.\n\nThere were eleven.',
  ].sort())
  // Only the new scene differs from the draft now — and with its words back in the first, it is no longer that scene's other half.
  await expect(changed.getByRole('listitem')).toHaveCount(1)
  await expect(changed.getByRole('listitem')).toContainText('Counting')
  await expect(changed.getByRole('listitem')).toContainText('Added')
})
