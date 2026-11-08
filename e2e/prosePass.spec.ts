import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/*
  The prose pass (editorial-plan.md, R6): on Read, what the line-level checks
  find underlined in the prose and listed beside it; a finding dismissed, and
  one made a note; a check turned off in World settings; the dismissed brought
  back; and a chapter's findings counted in the Continuity Checker.
*/

const MANUSCRIPT = [
  '# The Long Road',
  '',
  '## Chapter 1: Departure',
  '',
  'Mira lit the lantern before dawn. The lantern smoked in the cold.',
  '',
  '“We go now,” she said softly.',
  '',
  'The road was empty.',
  '',
  '## Chapter 2: The Gate',
  '',
  'She did not look back.',
].join('\n')

async function imported(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
  await page.getByLabel('Manuscript text').fill(MANUSCRIPT)
  await page.getByRole('button', { name: /^Import/ }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  return page.url().split('/worlds/')[1].split('/')[0]
}

async function proseOn(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript?view=read`, { waitUntil: 'load' })
  const button = page.getByRole('button', { name: 'Prose pass', exact: true })
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  const card = page.getByRole('complementary', { name: 'Prose pass' })
  await expect(card.getByRole('list', { name: 'Found in this scene' })).toBeVisible()
  return card
}

const notes = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as { proseNotes: { toArray: () => Promise<Array<{ body: string; quote: string; author: { kind: string } }>> } }
  return (await db.proseNotes.toArray()).map((n) => [n.body, n.quote, n.author.kind])
})

test('what the prose pass finds is underlined and listed; dismissed, made a note, turned off, brought back, and counted in the checker', async ({ page }) => {
  test.setTimeout(150_000)
  const worldId = await imported(page)
  const main = page.getByRole('main')
  let card = await proseOn(page, worldId)

  // The echo and the adverb on a tag, underlined where they are and listed beside the page.
  const echo = card.getByRole('listitem', { name: 'Echo: “lantern” again, 4 words on' })
  const tag = card.getByRole('listitem', { name: 'Dialogue tag: An adverb on a tag: “said softly”' })
  await expect(echo).toBeVisible()
  await expect(tag).toBeVisible()
  await expect(main.locator('mark[data-prose="echo"]')).toHaveText('lantern')
  await expect(main.locator('mark[data-prose="tag"]')).toHaveText('said softly')

  // One pass at a time: the spoiler pass turns this one off, and back again.
  await page.getByRole('button', { name: 'Spoiler pass', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Prose pass', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(main.locator('mark[data-prose]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Prose pass', exact: true }).click()
  await expect(main.locator('mark[data-prose]')).toHaveCount(2)

  // The tag made a note on the Page, by the check, on its words.
  await tag.getByRole('button', { name: 'Make a note' }).click()
  await expect.poll(() => notes(page)).toEqual([['Dialogue tag: An adverb on a tag: “said softly”', 'said softly', 'check']])

  // The echo dismissed: gone from the list and the prose.
  await echo.getByRole('button', { name: 'Dismiss' }).click()
  await expect(echo).toHaveCount(0)
  await expect(main.locator('mark[data-prose="echo"]')).toHaveCount(0)
  await expect(tag).toBeVisible()

  // Dialogue tags turned off in World settings, and the dismissed echo brought back.
  await card.getByRole('link', { name: 'Change what is checked' }).click()
  const settings = page.locator('#settings-prose-checks')
  await expect(settings).toBeInViewport()
  // It shows what is stored, so it changes once the write lands: clicked, then waited for.
  const tagsBox = settings.getByRole('checkbox', { name: 'Dialogue tags' })
  await tagsBox.click()
  await expect(tagsBox).not.toBeChecked()
  await settings.getByRole('button', { name: 'Bring back 1 dismissed finding' }).click()
  await expect(settings.getByRole('button', { name: /^Bring back/ })).toHaveCount(0)

  card = await proseOn(page, worldId)
  await expect(card.getByRole('listitem', { name: /^Echo: “lantern”/ })).toBeVisible()
  await expect(card.getByRole('listitem', { name: /^Dialogue tag/ })).toHaveCount(0)
  await expect(main.locator('mark[data-prose="tag"]')).toHaveCount(0)

  // The checker counts chapter 1's, as a note.
  await page.getByTitle('Continuity Checker').click()
  const checker = page.getByRole('dialog', { name: 'Continuity Checker' })
  await expect(checker.getByText('Ch. 1: 1 echo', { exact: true })).toBeVisible()
})
