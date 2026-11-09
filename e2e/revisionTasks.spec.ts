import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/*
  Revision tasks (editorial-plan.md, R5): an editor's letter pasted in, split,
  merged where it said one thing twice, and added; a task linked to a chapter
  and found in that chapter's panel; a task added there; and tasks made from a
  note on the prose and from an AI audit's finding, each with the way back to
  where it came from.
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
  '## Chapter 2: The Gate',
  '',
  'She did not look back.',
].join('\n')

const LETTER = [
  'Dear Mira,',
  '',
  'Pacing',
  '- The opening in chapter 1 is slow.',
  '- Start with the road.',
  '- Chapter 2 ends too soon: give the gate a page.',
  '',
  'Best,',
  'Ines',
].join('\n')

async function imported(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
  await page.getByLabel('Manuscript text').fill(MANUSCRIPT)
  await page.getByRole('button', { name: /^Import/ }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  return page.url().split('/worlds/')[1].split('/')[0]
}

const dashboard = async (page: Page, worldId: string) => {
  await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
  return page.getByRole('region', { name: 'Revisions' })
}

test('a letter split into tasks, merged and added; a task linked to a chapter, found in its panel, and one added there', async ({ page }) => {
  test.setTimeout(120_000)
  const worldId = await imported(page)
  let revisions = await dashboard(page, worldId)
  await expect(revisions).toContainText('paste an editor’s letter')

  await revisions.getByRole('button', { name: 'Paste an editorial letter…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Tasks from an editorial letter' })
  await dialog.getByRole('textbox', { name: 'The letter' }).fill(LETTER)
  await dialog.getByRole('textbox', { name: 'Whose letter (optional)' }).fill('Ines, 3 November')
  await dialog.getByRole('button', { name: 'Split into tasks' }).click()

  // Split at its bullets, the heading over them, the greeting and sign-off not work.
  const points = dialog.getByRole('list', { name: 'Points of the letter' })
  await expect(points.getByRole('listitem')).toHaveCount(6)
  await expect(points.getByRole('listitem', { name: 'Heading: Pacing' })).toBeVisible()
  await expect(points.getByRole('checkbox', { name: 'Keep: Dear Mira,' })).not.toBeChecked()
  await expect(points.getByRole('checkbox', { name: 'Keep: Best, Ines' })).not.toBeChecked()
  await expect(points.getByRole('checkbox', { name: 'Keep: Start with the road.' })).toBeChecked()
  await expect(dialog.getByRole('status')).toHaveText(/^3 tasks to add, of 5 points/)
  // The links each will have, from the chapters it names.
  await expect(points.getByRole('listitem', { name: /^Point: The opening in chapter 1/ })).toContainText('Linked to Ch. 1')

  // A heading that is a point is said to be one; back to the letter, it splits as it did.
  await points.getByRole('listitem', { name: 'Heading: Pacing' }).getByRole('button', { name: 'Not a heading' }).click()
  await expect(points.getByRole('checkbox', { name: 'Keep: Pacing' })).toBeChecked()
  await expect(dialog.getByRole('status')).toHaveText(/^4 tasks to add, of 6 points/)
  await dialog.getByRole('button', { name: 'Back to the letter' }).click()
  await dialog.getByRole('button', { name: 'Split into tasks' }).click()
  await expect(dialog.getByRole('status')).toHaveText(/^3 tasks to add, of 5 points/)

  // A point unticked is left out; ticked again, it is back.
  const chase = points.getByRole('checkbox', { name: 'Keep: Chapter 2 ends too soon: give the gate a page.' })
  await chase.uncheck()
  await expect(dialog.getByRole('status')).toHaveText(/^2 tasks to add, of 5 points/)
  await chase.check()
  await expect(dialog.getByRole('status')).toHaveText(/^3 tasks to add, of 5 points/)

  // Two bullets that are one point: merged.
  await points.getByRole('listitem', { name: 'Point: Start with the road.' }).getByRole('button', { name: 'Merge up' }).click()
  await expect(dialog.getByRole('status')).toHaveText(/^2 tasks to add, of 4 points/)
  await dialog.getByRole('button', { name: 'Add 2 tasks' }).click()
  await expect(dialog).toHaveCount(0)

  // On the dashboard: counted against the book, under the letter's heading, each linked and saying where it came from.
  await expect(revisions.getByText('0 of 2 done')).toBeVisible()
  const open = revisions.getByRole('list', { name: 'Open tasks' })
  await expect(open).toContainText('Pacing')
  const opening = open.getByRole('group', { name: 'To do: The opening in chapter 1 is slow. Start with the road.' })
  const gate = open.getByRole('group', { name: 'To do: Chapter 2 ends too soon: give the gate a page.' })
  await expect(opening.getByRole('button', { name: 'Ch. 1', exact: true })).toBeVisible()
  await expect(gate.getByRole('button', { name: 'Ch. 2', exact: true })).toBeVisible()
  await expect(gate).toContainText('From the letter: Ines, 3 November')

  // Linked to chapter 1 as well, by hand.
  await expect(gate.getByRole('button', { name: 'Ch. 1', exact: true })).toHaveCount(0)
  await gate.getByRole('button', { name: 'Link to…' }).click()
  await page.getByRole('option', { name: 'Ch. 1 · Departure' }).click()
  await expect(gate.getByRole('button', { name: 'Ch. 1', exact: true })).toBeVisible()

  // One done: counted, and out of the open list until asked for.
  // Ticked, it leaves the open list at once: clicked, not `check()`, which would look for it ticked where it was.
  await opening.getByRole('checkbox').click()
  await expect(revisions.getByText('1 of 2 done')).toBeVisible()
  await expect(open.getByRole('group')).toHaveCount(1)
  await revisions.getByRole('button', { name: 'Show the 1 done task' }).click()
  await expect(revisions.getByRole('list', { name: 'Done tasks' }).getByRole('group', { name: /^Done: The opening/ })).toBeVisible()

  // Chapter 2's panel lists the task on it, and not the other.
  await gate.getByRole('button', { name: 'Ch. 2', exact: true }).click()
  const ch2 = page.getByRole('region', { name: 'Chapter 2', exact: true }).getByRole('region', { name: 'This chapter’s revision tasks' })
  await expect(ch2.getByRole('group', { name: /^To do: Chapter 2 ends too soon/ })).toBeVisible()
  await expect(ch2.getByRole('group')).toHaveCount(1)
  await expect(ch2).toContainText('0 of 1 done')

  // Chapter 1's has both, the done one under the open; a task added there is linked to it.
  revisions = await dashboard(page, worldId)
  await revisions.getByRole('list', { name: 'Open tasks' }).getByRole('group', { name: /^To do: Chapter 2 ends too soon/ }).getByRole('button', { name: 'Ch. 1', exact: true }).click()
  const ch1 = page.getByRole('region', { name: 'Chapter 1', exact: true }).getByRole('region', { name: 'This chapter’s revision tasks' })
  await expect(ch1).toContainText('1 of 2 done')
  await ch1.getByRole('textbox', { name: 'A new task' }).fill('Name the road.')
  await ch1.getByRole('button', { name: 'Add' }).click()
  await expect(ch1.getByRole('group', { name: 'To do: Name the road.' }).getByRole('button', { name: 'Ch. 1', exact: true })).toBeVisible()
  await expect(ch1).toContainText('1 of 3 done')

  revisions = await dashboard(page, worldId)
  await expect(revisions.getByText('1 of 3 done')).toBeVisible()

  // Said again, and deleted.
  const named = revisions.getByRole('group', { name: 'To do: Name the road.' })
  await named.getByRole('button', { name: 'Name the road.', exact: true }).click()
  await named.getByRole('textbox', { name: 'Task' }).fill('Name the road, once.')
  await page.keyboard.press('Enter')
  const renamed = revisions.getByRole('group', { name: 'To do: Name the road, once.' })
  await expect(renamed).toBeVisible()
  await renamed.getByRole('button', { name: 'Delete: Name the road, once.' }).click()
  await expect(renamed).toHaveCount(0)
  await expect(revisions.getByText('1 of 2 done')).toBeVisible()
})

test('a note on the prose and an AI audit’s finding made into tasks, each with the way back to it', async ({ page }) => {
  test.setTimeout(120_000)
  const worldId = await imported(page)
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.locator('.cm-content')).toContainText('The road belonged to her now.')

  // A note, made into a task: once.
  await page.locator('.cm-line', { hasText: 'The road belonged to her now.' }).click()
  await page.keyboard.press('Home')
  await page.keyboard.press('Shift+End')
  await page.getByRole('button', { name: 'Add note' }).click()
  const notes = page.getByRole('complementary', { name: 'Notes' })
  const form = notes.getByRole('form', { name: 'New note' })
  await form.getByRole('textbox', { name: 'Note' }).fill('Whose road? Say so.')
  await form.getByRole('button', { name: 'Save note' }).click()
  const card = notes.getByRole('listitem').filter({ hasText: 'Whose road? Say so.' })
  await card.getByRole('button', { name: 'Make a task' }).click()
  await expect(card.getByRole('button', { name: 'A task' })).toBeDisabled()

  // An AI audit's finding, made into a task from the continuity check.
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as { auditFindings: { add: (v: unknown) => Promise<unknown> } }
    await db.auditFindings.add({ id: 'f1', worldId: id, title: 'Dawn is said twice', severity: 'minor', kind: 'contradiction', why: '', quotes: [{ text: 'Mira left before dawn.', eventId: '' }], createdAt: 1 })
  }, worldId)
  await page.getByTitle('Continuity Checker').click()
  const checker = page.getByRole('dialog', { name: 'Continuity Checker' })
  const finding = checker.locator('div.rounded.border').filter({ hasText: 'Dawn is said twice' }).first()
  await finding.getByRole('button', { name: 'Make a task' }).click()
  await expect(finding.getByRole('button', { name: 'A task' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(checker).toHaveCount(0)

  // On the dashboard: each linked to its chapter and scene, and saying where it came from.
  const revisions = await dashboard(page, worldId)
  const fromNote = revisions.getByRole('group', { name: 'To do: Whose road? Say so.' })
  const fromAudit = revisions.getByRole('group', { name: 'To do: Dawn is said twice' })
  await expect(fromNote.getByRole('button', { name: 'Ch. 1', exact: true })).toBeVisible()
  await expect(fromAudit.getByRole('button', { name: 'Ch. 1', exact: true })).toBeVisible()
  await expect(fromAudit.getByRole('button', { name: 'From the AI audit: Dawn is said twice' })).toBeVisible()

  // A task linked to a scene, and no longer to its chapter, is still in the chapter's panel.
  await fromNote.getByRole('button', { name: 'Unlink Ch. 1' }).click()
  await expect(fromNote.getByRole('button', { name: 'Ch. 1', exact: true })).toHaveCount(0)
  await fromAudit.getByRole('button', { name: 'Ch. 1', exact: true }).click()
  const ch1 = page.getByRole('region', { name: 'Chapter 1', exact: true }).getByRole('region', { name: 'This chapter’s revision tasks' })
  await expect(ch1.getByRole('group', { name: 'To do: Whose road? Say so.' })).toBeVisible()
  await expect(ch1).toContainText('0 of 2 done')
  await dashboard(page, worldId)

  // Back to the finding: the check opens.
  await fromAudit.getByRole('button', { name: 'From the AI audit: Dawn is said twice' }).click()
  await expect(checker).toBeVisible()
  await page.keyboard.press('Escape')

  // Back to the note: the Page, its Notes panel open at it.
  await fromNote.getByRole('button', { name: /^From a note on “The road belonged to her now\.”/ }).click()
  await expect(page).toHaveURL(/\/manuscript/)
  await expect(page.locator('.cm-content')).toBeVisible()
  await expect(notes.locator('[data-note]').filter({ hasText: 'Whose road? Say so.' })).toHaveClass(/ring-2/)
})
