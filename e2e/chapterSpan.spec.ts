import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'

/**
 * MT-4: a timeline whose chapters do not start at one read "(10 chapters)"
 * above a first row of Ch. 12, which looks like missing data rather than the
 * second half of a book.
 *
 * The finding blamed numbering running globally across timelines. It does not:
 * `nextNumber` is `chapters.length + 1` for the current timeline, so chapters
 * added through the UI restart at one — this test tried it and got Ch. 1 and
 * Ch. 2. The state is real all the same, since the shipped examples are
 * authored with the book's own numbering and an import carries whatever it was
 * given, so the numbers here are seeded the way such a world actually acquires
 * them. The formatting is unit-tested in `src/lib/__tests__/chapterSpan.test.ts`.
 */
test('a timeline that starts late says where it starts', async ({ page }) => {
  test.setTimeout(120_000)
  await resetDB(page)

  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Two Halves')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  await page.getByRole('link', { name: /timeline/i }).first().click()
  await settleNav(page)
  await page.getByRole('button', { name: 'Create Timeline' }).click()

  const addChapter = async (title: string) => {
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill(title)
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await expect(page.getByText(title).first()).toBeVisible()
  }
  await addChapter('Setting Out')
  await addChapter('The Ford')

  // While it does start at one, the header says only the count — the absence
  // half, read from the same header the presence half below uses.
  const header = page.getByRole('main')
  await expect(header.getByText('(2 chapters)', { exact: true })).toBeVisible()

  // Renumber them the way an imported or authored world arrives: continuing the
  // book rather than restarting. Live queries pick the change up in place.
  await page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as {
      chapters: {
        toArray: () => Promise<{ id: string; number: number }[]>
        update: (id: string, changes: object) => Promise<unknown>
      }
    }
    const chapters = (await db.chapters.toArray()).sort((a, b) => a.number - b.number)
    await db.chapters.update(chapters[0].id, { number: 12 })
    await db.chapters.update(chapters[1].id, { number: 13 })
  })

  // Named, so "2 chapters" opening at twelve reads as the second half of a book
  // rather than as eleven chapters that have gone missing.
  await expect(header.getByText('(2 chapters · Ch. 12–13)', { exact: true }))
    .toBeVisible({ timeout: 15_000 })
  await expect(header.getByText('Ch. 12 — Setting Out')).toBeVisible()
})
