import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/*
  Notes on the prose (editorial-plan.md, R1): a note made on words chosen on
  the Page is marked on them, follows them through edits around them and a
  reload, is resolved and reopened, and — its words rewritten — is kept,
  unplaced, with the quote it was made on.
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

async function openPage(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
  await page.getByLabel('Manuscript text').fill(MANUSCRIPT)
  await page.getByRole('button', { name: /^Import/ }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.locator('.cm-content')).toContainText('The road belonged to her now.')
  return worldId
}

/** Choose a whole line of prose, as a writer would: click into it, Home, Shift+End. */
async function chooseLine(page: Page, text: string) {
  await page.locator('.cm-line', { hasText: text }).click()
  await page.keyboard.press('Home')
  await page.keyboard.press('Shift+End')
}

const saved = (page: Page) => expect(page.locator('[data-save-state]')).toHaveAttribute('data-save-state', 'saved')

test('a note on chosen words follows them, survives a reload, and is resolved, reopened and kept unplaced', async ({ page }) => {
  test.setTimeout(120_000)
  await openPage(page)
  const notes = page.getByRole('complementary', { name: 'Notes' })
  const mark = page.locator('.cm-prose-note')

  // Nothing chosen, nothing to note: the button waits for words.
  const add = page.getByRole('button', { name: 'Add note' })
  await expect(add).toBeDisabled()
  await chooseLine(page, 'The road belonged to her now.')
  await expect(add).toBeEnabled()
  await add.click()

  const form = notes.getByRole('form', { name: 'New note' })
  await expect(form).toContainText('The road belonged to her now.')
  await form.getByRole('textbox', { name: 'Note' }).fill('Whose road? Say so.')
  await form.getByRole('button', { name: 'Save note' }).click()
  await expect(form).toHaveCount(0)

  // Marked on its words, and counted.
  await expect(mark).toHaveText('The road belonged to her now.')
  await expect(page.getByRole('button', { name: 'Notes · 1' })).toBeVisible()
  const card = notes.getByRole('listitem').filter({ hasText: 'Whose road? Say so.' })
  await expect(card).toContainText('The road belonged to her now.')
  await expect(card).toContainText('Ch. 1')

  // Edits before it and after it: the mark stays on its words.
  await page.locator('.cm-line', { hasText: 'Mira left before dawn.' }).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Rain had come in the night.')
  await page.locator('.cm-line', { hasText: 'She did not look back.' }).click()
  await page.keyboard.press('Home')
  await page.keyboard.type('Still, ')
  await expect(mark).toHaveText('The road belonged to her now.')
  await saved(page)

  // A reload: the note is a record, and its mark is drawn again from it.
  await page.reload({ waitUntil: 'load' })
  await page.getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.locator('.cm-content')).toContainText('Rain had come in the night.')
  await expect(mark).toHaveText('The road belonged to her now.')

  // Clicking the mark opens the note.
  await expect(notes).toHaveCount(0)
  await mark.click()
  await expect(notes).toBeVisible()
  const opened = notes.getByRole('listitem').filter({ hasText: 'Whose road? Say so.' })
  await expect(opened).toHaveClass(/ring-2/)

  // Resolved: off the page and out of the open list, and there under Resolved. Reopened: back.
  await opened.getByRole('button', { name: 'Resolve' }).click()
  await expect(mark).toHaveCount(0)
  await expect(notes.getByText('No notes match.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Notes', exact: true })).toBeVisible()
  await notes.getByRole('button', { name: /^Show / }).click()
  await page.getByRole('option', { name: 'Resolved' }).click()
  const resolved = notes.getByRole('listitem').filter({ hasText: 'Whose road? Say so.' })
  await expect(resolved).toContainText('Resolved')
  await resolved.getByRole('button', { name: 'Reopen' }).click()
  await expect(mark).toHaveText('The road belonged to her now.')

  // Its words rewritten: no mark, and the note kept with the quote it was made on.
  await chooseLine(page, 'The road belonged to her now.')
  await page.keyboard.type('Nobody had asked her where she was going.')
  await saved(page)
  await expect(mark).toHaveCount(0)
  await notes.getByRole('button', { name: /^Show / }).click()
  await page.getByRole('option', { name: 'All' }).click()
  const unplaced = notes.getByRole('listitem').filter({ hasText: 'Whose road? Say so.' })
  await expect(unplaced).toContainText('Unplaced')
  await expect(unplaced).toContainText('The road belonged to her now.')
  await expect(unplaced.getByRole('button', { name: 'Go to it' })).toHaveCount(0)
})

test('going to a note chooses its words on the page, and an edit inside them keeps it there', async ({ page }) => {
  test.setTimeout(120_000)
  await openPage(page)
  await chooseLine(page, 'She did not look back.')
  await page.keyboard.press('ControlOrMeta+Alt+m')
  const notes = page.getByRole('complementary', { name: 'Notes' })
  await notes.getByRole('textbox', { name: 'Note' }).fill('Earn this.')
  await notes.getByRole('button', { name: 'Save note' }).click()
  const mark = page.locator('.cm-prose-note')
  await expect(mark).toHaveText('She did not look back.')

  // One word inside it retyped: still the same passage, marked where it is now.
  await page.locator('.cm-line', { hasText: 'She did not look back.' }).click()
  await page.keyboard.press('End')
  for (let i = 0; i < 'back.'.length; i++) await page.keyboard.press('Backspace')
  await page.keyboard.type('behind.')
  await expect(mark).toHaveText('She did not look behind.')
  await saved(page)
  const card = notes.getByRole('listitem').filter({ hasText: 'Earn this.' })
  await expect(card).toContainText('edited since')

  // Go to it: its words chosen on the page.
  await page.locator('.cm-line', { hasText: 'Mira left before dawn.' }).click()
  await card.getByRole('button', { name: 'Go to it' }).click()
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('She did not look behind.')

  // Answered: the note moves onto its words as they are now, and says so no longer.
  await card.getByRole('button', { name: 'Reply' }).click()
  await card.getByRole('textbox', { name: 'Reply' }).fill('Done — it is earned in ch. 3.')
  await card.getByRole('button', { name: 'Reply', exact: true }).last().click()
  await expect(card.getByRole('list', { name: 'Replies' })).toContainText('Me: Done — it is earned in ch. 3.')
  await expect(card).not.toContainText('edited since')
  await expect.poll(() => page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<{ quote: string }>> }>
    return (await db.proseNotes.toArray()).map((n) => n.quote)
  })).toEqual(['She did not look behind.'])

  // Deleted: gone from the panel and the page.
  await card.getByRole('button', { name: 'Delete' }).click()
  await expect(notes.getByRole('listitem')).toHaveCount(0)
  await expect(mark).toHaveCount(0)
  await expect(notes).toContainText('No notes yet.')
})
