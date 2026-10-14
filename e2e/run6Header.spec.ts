import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * What writer run 6 found writing on the Page:
 *
 * - F4: somebody who knew a fact "before the story" was drawn on the first
 *   scene's header as learning it there — a scene they were not in — and
 *   deleting that line took their knowledge away without a word.
 * - F6: a heading retitled by typing over its line came out muted and light.
 * - F8: the `@` picker said nothing to a screen reader.
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Hollin Staithe')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Low Water', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const scenes = [['e1', 'The drift', 'The lamp guttered.', ['ann']], ['e2', 'The surgery', 'Rain on the glass.', ['ann', 'olaf']]] as const
    let i = 0
    for (const [eid, title, text, cast] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [...cast], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 3, updatedAt: now })
    }
    for (const [cid, name] of [['ann', 'Ann Hale'], ['olaf', 'Olaf Other']]) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    await db.knowledgeFacts.add({ id: 'well', worldId: id, title: 'The well is poisoned', description: '', tags: [], readerLearnsAtEventId: null, originEventId: null, createdAt: now, updatedAt: now })
  }, worldId)
  return worldId
}

async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}

const reveals = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    knowledgeReveals: { toArray: () => Promise<Array<{ characterId: string; eventId: string; beforeStory?: boolean }>> }
  }
  return (await db.knowledgeReveals.toArray()).map((r) => `${r.characterId}@${r.eventId}${r.beforeStory ? ' before' : ''}`).sort()
})

/** Scene "The drift"'s header, its lines joined, as the Page shows it. */
const firstHeader = (page: Page) => page.evaluate(() => {
  const lines = [...document.querySelectorAll('.cm-line')]
  const at = lines.findIndex((l) => l.textContent === '## The drift')
  const out: string[] = []
  // A blank line under the heading, then the header's lines.
  for (const l of lines.slice(at + 1)) {
    if (l.classList.contains('cm-draft-header')) out.push(l.textContent ?? '')
    else if (out.length || (l.textContent ?? '') !== '') break
  }
  return out.join('\n')
})

/**
 * Selects the text of a line that wraps on screen, and nothing else. Home and
 * End stop at each wrap, a drag depends on where the rows fall, and the
 * editor's "select line" takes the line break too, so the selection is set on
 * the editor directly; what replaces it is typed.
 */
async function selectWrappedLine(page: Page, text: string) {
  await page.locator('.cm-line', { hasText: text }).first().click()
  await page.evaluate((text) => {
    type View = { state: { doc: { lines: number; line: (n: number) => { from: number; to: number; text: string } } }; dispatch: (tr: unknown) => void }
    const content = document.querySelector('.cm-content') as unknown as { cmTile: { root: { view: View } } }
    const view = content.cmTile.root.view
    for (let n = 1; n <= view.state.doc.lines; n++) {
      const line = view.state.doc.line(n)
      if (line.text.includes(text)) { view.dispatch({ selection: { anchor: line.from, head: line.to } }); return }
    }
    throw new Error(`no line with ${text}`)
  }, text)
}

test.describe('the Page, after writer run 6', () => {
  test.describe.configure({ timeout: 150_000 })

  test('F4: known before the story is said so, and the first scene’s header draws it as `:before`, not as learned there (run 9)', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/knowledge`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('button', { name: /The well is poisoned/ }).first().click()
    await settle(page)
    // Olaf knew before the book begins; Ann learns it in the first scene.
    await page.getByRole('button', { name: 'Character…', exact: true }).click()
    await page.getByRole('option', { name: 'Olaf Other', exact: true }).click()
    await page.getByRole('button', { name: 'Learns it at…', exact: true }).click()
    await page.getByRole('option', { name: 'Before the story (from the first scene)', exact: true }).click()
    await page.getByRole('button', { name: 'Record who learns it' }).click()
    await page.getByRole('button', { name: 'Character…', exact: true }).click()
    await page.getByRole('option', { name: 'Ann Hale', exact: true }).click()
    await page.getByRole('button', { name: 'Learns it at…', exact: true }).click()
    await page.getByRole('option', { name: /The drift/ }).click()
    await page.getByRole('button', { name: 'Record who learns it' }).click()
    await expect.poll(() => reveals(page)).toEqual(['ann@e1', 'olaf@e1 before'])

    // Said as what it is, beside the one learned at a scene.
    const known = (name: string) => page.locator('div.rounded', { hasText: name }).filter({ has: page.getByTitle('Remove') })
    await expect(known('Olaf Other')).toContainText('Before the story')
    await expect(known('Ann Hale')).not.toContainText('Before the story')

    /*
      The first scene's header draws Ann's learning as learned there, and
      Olaf's as known before (writer run 9): it was hidden from the header, so
      nothing on it said so and it could not be written there.
    */
    await openPage(page, worldId)
    await expect.poll(() => firstHeader(page), { timeout: 20_000 }).toContain('?The well is poisoned:@Ann Hale')
    expect(await firstHeader(page)).toContain('?The well is poisoned:@Olaf Other:before')

    // Ann's token taken off the line, Olaf's left: Ann's learning goes, Olaf's knowledge stays.
    await selectWrappedLine(page, 'Facts:')
    await page.keyboard.type('  Facts: ?The well is poisoned:@Olaf Other:before')
    await page.keyboard.press('Escape')
    await page.locator('.cm-line', { hasText: 'Rain on the glass.' }).first().click()
    await expect.poll(() => reveals(page), { timeout: 15_000 }).toEqual(['olaf@e1 before'])
    // One line replaced, the header's lines kept: a header run together still parses, so say so.
    expect(await firstHeader(page)).toBe('[\n  Characters: @@Ann Hale\n  Facts: ?The well is poisoned:@Olaf Other:before\n]')

    // And Olaf's taken off too: no longer known before the story.
    await selectWrappedLine(page, 'Facts:')
    await page.keyboard.press('Backspace')
    await page.locator('.cm-line', { hasText: 'Rain on the glass.' }).first().click()
    await expect.poll(() => reveals(page), { timeout: 15_000 }).toEqual([])
  })

  test('F6: a heading retitled by typing over it looks like a heading', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    const heading = page.locator('.cm-line', { hasText: '# Low Water' }).first()
    const weightOfTitle = () => page.evaluate(() => {
      const line = [...document.querySelectorAll('.cm-line')].find((l) => (l.textContent ?? '').startsWith('# '))!
      // The last text in the line: the title, not the `#`.
      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT)
      let last: Text | null = null
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if ((n.textContent ?? '').trim()) last = n as Text
      return { weight: getComputedStyle(last!.parentElement!).fontWeight, styled: line.querySelectorAll('[style]').length + (line.hasAttribute('style') ? 1 : 0) }
    })
    // Before: a heading's title is bold.
    expect((await weightOfTitle()).weight).toBe('600')

    await heading.click()
    await page.keyboard.press('Home')
    await page.keyboard.press('Shift+End')
    await page.keyboard.type('# The North Road')
    await expect(page.locator('.cm-line', { hasText: '# The North Road' })).toHaveCount(1)
    await expect.poll(weightOfTitle).toEqual({ weight: '600', styled: 0 })
  })

  test('F8: the picker says the highlighted row and the keys that pick it', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await page.locator('.cm-line', { hasText: 'Rain on the glass.' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' @@Ann')
    const said = page.getByRole('status').filter({ hasText: /of \d+\./ })
    await expect(said).toHaveText('Ann Hale, character, 1 of 1. Enter or Tab picks it; Escape closes the list.')
    await page.keyboard.press('Escape')
    await expect(said).toHaveCount(0)
  })
})
