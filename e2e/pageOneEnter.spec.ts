import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/*
  One Enter on the Page (round-trip-plan-3.md, T12.1, D-11). The second loop's
  writer typed a scene with one Enter between its paragraphs. The Page showed
  paragraphs; Read and Word ran them together. A single Enter stays a line, and
  the Page now marks each one where it will be joined, and says why the first
  time the writer types on after one.
*/

const MANUSCRIPT = ['# The Long Road', '', '## Chapter 1: Departure', '', 'Mira left before dawn.', '', '## Chapter 2: The Gate', '', 'She did not look back.'].join('\n')

async function onThePage(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
  await page.getByLabel('Manuscript text').fill(MANUSCRIPT)
  await page.getByRole('button', { name: /^Import/ }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.locator('.cm-content')).toContainText('She did not look back.')
}

async function prose(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<{ text: string }>> }>
    return (await db.sceneTexts.toArray()).map((t) => t.text).sort()
  })
}

test('a single Enter in prose is marked where it will be joined, and the first one typed on after says why; two make a paragraph, and verse keeps its lines', async ({ page }) => {
  test.setTimeout(120_000)
  await onThePage(page)
  const marks = page.locator('.cm-content .cm-lone-break')
  const note = page.getByRole('note', { name: 'One Enter' })
  await expect(marks).toHaveCount(0)

  // Two Enters: a paragraph. No mark, and nothing said.
  await page.locator('.cm-line', { hasText: 'Mira left before dawn.' }).click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('The road was hers.')
  await expect.poll(() => prose(page), { timeout: 10_000 }).toEqual(['Mira left before dawn.\n\nThe road was hers.', 'She did not look back.'])
  await expect(marks).toHaveCount(0)
  await expect(note).toHaveCount(0)

  // One Enter: nothing is said until there are words after it, then the line end is marked and the page says why.
  await page.keyboard.press('Enter')
  await expect(note).toHaveCount(0)
  await page.keyboard.type('Nobody followed.')
  await expect(marks).toHaveCount(1)
  await expect(marks).toHaveAttribute('title', /joined to the line before in Read and every export/)
  await expect(note).toContainText('One Enter starts a new line, not a new paragraph.')
  await expect(note).toContainText('Press Enter twice, leaving a blank line, for a new paragraph.')
  // The mark is at the end of the line it joins, not on the next.
  await expect(page.locator('.cm-line', { hasText: 'The road was hers.' }).locator('.cm-lone-break')).toHaveCount(1)
  await expect(page.locator('.cm-line', { hasText: 'Nobody followed.' }).locator('.cm-lone-break')).toHaveCount(0)
  // The mark is not in the prose.
  await expect.poll(() => prose(page), { timeout: 10_000 }).toEqual(['Mira left before dawn.\n\nThe road was hers.\nNobody followed.', 'She did not look back.'])

  // Said once: dismissed, and another single Enter is marked without being said again, then or after a reload.
  await note.getByRole('button', { name: 'Got it' }).click()
  await expect(note).toHaveCount(0)
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Not even the dog.')
  await expect(marks).toHaveCount(2)
  await expect(note).toHaveCount(0)
  await expect.poll(() => prose(page), { timeout: 10_000 }).toContain('Mira left before dawn.\n\nThe road was hers.\nNobody followed.\nNot even the dog.')
  await page.reload({ waitUntil: 'load' })
  await page.getByRole('button', { name: 'Page', exact: true }).click()
  await expect(marks).toHaveCount(2)
  await page.locator('.cm-line', { hasText: 'She did not look back.' }).click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Not once.')
  await expect(marks).toHaveCount(3)
  await expect(note).toHaveCount(0)

  // Verse, its lines indented, keeps its lines: no mark.
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('  The tide goes out,')
  // The page carries the indent onto the next line.
  await page.keyboard.press('Enter')
  await page.keyboard.type('the tide comes in.')
  await expect.poll(() => prose(page), { timeout: 10_000 }).toContain('She did not look back.\nNot once.\n\n  The tide goes out,\n  the tide comes in.')
  await expect(marks).toHaveCount(3)
})

test('a header typed as a scene’s first lines is not one Enter in prose: not marked, and not said; the prose after it is', async ({ page }) => {
  test.setTimeout(120_000)
  await onThePage(page)
  const marks = page.locator('.cm-content .cm-lone-break')
  const note = page.getByRole('note', { name: 'One Enter' })
  // The header block, typed line by line as the second scene's first lines: prose until its `]`. Its lines are not
  // indented here, so that the page's indent is not carried onto the prose below and makes verse of it.
  await page.locator('.cm-line', { hasText: 'She did not look back.' }).click()
  await page.keyboard.press('Home')
  for (const l of ['[', 'Place: #The Quay']) {
    await page.keyboard.type(l)
    await page.keyboard.press('Enter')
  }
  await expect(marks).toHaveCount(0)
  await expect(note).toHaveCount(0)
  await page.keyboard.type(']')
  await page.keyboard.press('Enter')
  await expect(marks).toHaveCount(0)
  await expect(note).toHaveCount(0)
  // The prose under it, with one Enter: marked, and said.
  await page.locator('.cm-line', { hasText: 'She did not look back.' }).click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Not once.')
  await expect(marks).toHaveCount(1)
  await expect(note).toBeVisible()
  await expect.poll(() => prose(page), { timeout: 10_000 }).toContain('She did not look back.\nNot once.')
})
