import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * The Add Chapter dialog offered a Synopsis field and nothing anywhere edited it
 * afterwards — `updateChapter` had three call sites, for title, notes and word
 * goal. A wrong synopsis was permanent short of deleting the chapter, and
 * Chapter 1, which the setup guide creates without asking for one, could never
 * carry a summary at all.
 *
 * It is not decorative: it prints in the Manuscript in draft mode, in the
 * Writer's Brief and in chapter detail, feeds the chapter-AI prompt, and is
 * searchable once the reader has reached the chapter.
 */

const SYNOPSIS = 'The bell does not ring, and the harbour notices before the city does.'

async function chapterWithoutSynopsis(page: Page): Promise<string> {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Synopsis')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    // Exactly what the setup guide leaves behind: no synopsis.
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'The ninth bell', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
  }, worldId)
  return worldId
}

const storedSynopsis = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as
    { chapters: { get: (id: string) => Promise<{ synopsis: string } | undefined> } }
  return (await db.chapters.get('ch1'))?.synopsis ?? null
})

test.describe('a chapter synopsis can be written after the chapter exists', () => {
  test.describe.configure({ timeout: 240_000 })

  test('the chapter the setup guide made can be given one', async ({ page }) => {
    const worldId = await chapterWithoutSynopsis(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await page.waitForTimeout(1500)

    const field = page.getByRole('textbox', { name: 'Chapter synopsis' })
    await expect(field).toBeVisible({ timeout: 20_000 })
    await expect(field).toHaveValue('')

    await field.fill(SYNOPSIS)
    await expect.poll(() => storedSynopsis(page), { timeout: 15_000 }).toBe(SYNOPSIS)

    // And it survives a reload, which is what "written" has to mean.
    await page.reload({ waitUntil: 'load' })
    await page.waitForTimeout(1500)
    await expect(page.getByRole('textbox', { name: 'Chapter synopsis' })).toHaveValue(SYNOPSIS)
  })

  test('and can be corrected, not just filled once', async ({ page }) => {
    const worldId = await chapterWithoutSynopsis(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await page.waitForTimeout(1500)

    const field = page.getByRole('textbox', { name: 'Chapter synopsis' })
    await field.fill('Wrong on the first pass.')
    await expect.poll(() => storedSynopsis(page), { timeout: 15_000 }).toBe('Wrong on the first pass.')

    await field.fill(SYNOPSIS)
    await expect.poll(() => storedSynopsis(page), { timeout: 15_000 }).toBe(SYNOPSIS)
  })

  test('but a reader is shown it, not given a box to type in', async ({ page }) => {
    // The pair: this is the author's writing on a chapter the reader reached.
    const worldId = await chapterWithoutSynopsis(page)
    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        chapters: { update: (id: string, changes: object) => Promise<unknown> }
        worlds: { update: (id: string, changes: object) => Promise<unknown> }
      }
      await db.chapters.update('ch1', { synopsis: 'The bell does not ring.' })
      await db.worlds.update(id, { readingMode: true })
    }, worldId)

    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await page.waitForTimeout(1500)

    await expect(page.getByText('The bell does not ring.')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('textbox', { name: 'Chapter synopsis' })).toHaveCount(0)
  })
})
