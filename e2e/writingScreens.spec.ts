import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/**
 * MS-2, MS-3, MS-4 and WR-1 — the screens the app is actually for.
 */

const PROSE = Array.from({ length: 220 }, (_, i) => `word${i}`).join(' ')

const SPEC = JSON.stringify({
  world: { name: 'Aethelgard' },
  characters: [{ name: 'Kestrel' }],
  chapters: [{ title: 'Landfall', events: [{ id: 'e1', title: 'The wreck', characters: ['Kestrel'] }] }],
})

async function worldFromSpec(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
  await page.getByLabel('Story spec JSON').fill(SPEC)
  await page.getByRole('button', { name: 'Import world', exact: true }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
  return page.url().split('/worlds/')[1].split('/')[0]
}

test.describe('The writing screens', () => {
  test.describe.configure({ timeout: 150_000 })

  test('MS-2/MS-3: no unlabelled number, and no em-dash standing in for a value', async ({ page }) => {
    const worldId = await worldFromSpec(page)
    // The Manuscript's numbers are on Page, in the header row the layouts sit in.
    await page.goto(`/#/worlds/${worldId}/manuscript?view=page`, { waitUntil: 'load' })
    const layouts = page.getByRole('group', { name: 'Layout', exact: true })
    await expect(layouts).toBeVisible({ timeout: 30_000 })
    const header = layouts.locator('xpath=ancestor::div[contains(@class,"border-b")][1]')

    // MS-2, absence: nothing in the header is a bare number with no unit, the
    // way "Manuscript 0" once was.
    const bareNumbers = await header.locator('*').evaluateAll((els) =>
      els.filter((e) => e.children.length === 0)
        .map((e) => (e.textContent ?? '').trim()).filter((t) => /^[\d,]+$/.test(t)),
    )
    expect(bareNumbers, `unlabelled numbers in the header: ${bareNumbers.join(', ')}`).toEqual([])

    // MS-2, presence: the numbers are on screen, in that header, with their units.
    await expect(header.getByText(/0 of 1 scenes written · 0 words/)).toBeVisible()

    // MS-3: the goal field says it has no value rather than showing a dash,
    // which in a field reads as one that failed to load.
    const goal = page.getByLabel('Word goal for the book')
    await expect(goal).toBeVisible()
    await expect(goal).toHaveAttribute('placeholder', 'none')

    // And the opposite condition: with a goal set, the field shows the number.
    await goal.fill('80000')
    await expect(goal).toHaveValue('80000')
  })

  test('MS-4: the writing instruction only reaches someone who can act on it', async ({ page }) => {
    const worldId = await worldFromSpec(page)

    // Presence: a writer gets the instruction, and the job is theirs to do. It
    // is the empty book's, on Read.
    await page.goto(`/#/worlds/${worldId}/manuscript?view=cards`, { waitUntil: 'load' })
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Read', exact: true })
      .click({ timeout: 30_000 })
    await expect(page.getByText('No prose yet')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/Write prose on your scenes/)).toBeVisible()

    // Absence: MS-4 asks for a second version of that sentence for a reader on
    // a Library world. That reader never sees the empty book: a reader is only
    // offered Read when there is prose, so asking for it outright still gives
    // them the chapters and scenes. This is the evidence for withdrawing the
    // finding, and it fails the moment that stops holding.
    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Turn on reading mode' }).click()
    await settle(page)
    await page.goto(`/#/worlds/${worldId}/manuscript?view=read`, { waitUntil: 'load' })
    await expect(page.getByRole('main').getByRole('button', { name: /^Ch\. 1\b/ }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('group', { name: 'Layout', exact: true })).toHaveCount(0)
    await expect(page.getByText(/Write prose on your scenes/)).toHaveCount(0)
  })

  test('WR-1: the scene box is as tall as the scene', async ({ page }) => {
    const worldId = await worldFromSpec(page)
    await page.goto(`/#/worlds/${worldId}/manuscript?view=cards`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Open chapter detail' }).first().click()
    await page.getByRole('button', { name: /^Expand/ }).first().click()

    const box = page.getByPlaceholder(/Write or paste this scene/)
    await expect(box).toBeVisible({ timeout: 30_000 })

    // Empty, it is the five-row floor — so the growth below is growth, not a
    // box that was always tall.
    const empty = await box.evaluate((el) => el.getBoundingClientRect().height)
    expect(empty).toBeLessThan(200)

    await box.fill(PROSE)
    await expect.poll(async () => box.evaluate((el) => {
      const ta = el as HTMLTextAreaElement
      // The whole scene is in view: no internal scrollbar left over.
      return ta.scrollHeight - ta.clientHeight
      // A couple of pixels of sub-line rounding is not a letterbox; anything
      // approaching a line height would be.
    }), { timeout: 10_000 }).toBeLessThan(6)

    const grown = await box.evaluate((el) => el.getBoundingClientRect().height)
    expect(grown, `box stayed ${grown}px for ${PROSE.split(' ').length} words`)
      .toBeGreaterThan(empty * 2)
  })
})
