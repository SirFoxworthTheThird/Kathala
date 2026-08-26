import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * Asked for from use: *can we order the Library alphabetically and have a
 * search? And Escape should let me close it.*
 *
 * All three were missing. The catalogue rendered in the order `index.json`
 * lists it — curated by theme, which is a shape only its author can see. There
 * was no search. And the dialog is hand-rolled rather than the shared `Dialog`,
 * so it was missed by **X-11**'s Escape sweep exactly as the Help panel was —
 * with the difference that this one has no backdrop-click either, making its
 * close button the only way out.
 */

async function openLibrary(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()
  // The catalogue is fetched, so wait for a card rather than a timeout.
  await expect(page.getByRole('button', { name: /^Download \(/ }).first())
    .toBeVisible({ timeout: 60_000 })
}

/** The titles on screen, in the order they are listed. */
const listed = (page: Page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('h3'))
    .map((h) => (h.textContent ?? '').trim())
    .filter(Boolean))

test.describe('Browsing the Library', () => {
  test.describe.configure({ timeout: 180_000 })

  test('the catalogue is filed alphabetically, past a leading article', async ({ page }) => {
    await openLibrary(page)
    const titles = await listed(page)
    expect(titles.length, 'the whole catalogue should be listed').toBeGreaterThan(20)

    /*
      Asserted as a property rather than as a fixed list, so adding a book to
      the catalogue does not fail this test for the wrong reason. The filing key
      is the title minus a leading article — which is the whole point at this
      size, since most of these begin with "The".
      */
    const fileAs = (t: string) => t.replace(/^(the|a|an)\s+/i, '')
    const keys = titles.map(fileAs)
    const sorted = [...keys].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    expect(keys).toEqual(sorted)

    // And it is genuinely not the raw alphabetical order — otherwise the rule
    // above would be indistinguishable from a plain sort.
    const naive = [...titles].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    expect(titles, 'most of these titles start with "The"').not.toEqual(naive)
  })

  test('search narrows by title and by author, and can be cleared', async ({ page }) => {
    await openLibrary(page)
    const all = await listed(page)
    const search = page.getByLabel('Search the library by title or author')

    // By title.
    await search.fill('musket')
    await expect.poll(() => listed(page)).toEqual(['The Three Musketeers'])

    // By author — the same books, reached the other way.
    await search.fill('dumas')
    const byAuthor = await listed(page)
    expect(byAuthor.length).toBeGreaterThan(0)
    expect(byAuthor).toContain('The Three Musketeers')
    expect(byAuthor).toContain('The Count of Monte Cristo')

    // Accents folded, so a reader typing on a plain keyboard still finds her.
    await search.fill('bronte')
    await expect.poll(() => listed(page)).toEqual(['Jane Eyre'])

    // Nothing matching says so, and offers the way back.
    await search.fill('zzzzz')
    await expect.poll(() => listed(page)).toEqual([])
    await expect(page.getByText(/No book here matches/)).toBeVisible()
    await page.getByRole('button', { name: /^Show all \d+$/ }).click()
    await expect.poll(() => listed(page)).toEqual(all)
  })

  test('Escape closes it — and not the confirm stacked over it', async ({ page }) => {
    await openLibrary(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Library' })).toHaveCount(0)
    // Back on the world selector rather than nowhere.
    await expect(page.getByRole('button', { name: 'New World' })).toBeVisible()

    /*
      The half that stops this being a one-line change with a hidden cost.
      Downloading a world you already have raises a confirm on top of the
      catalogue, and `Dialog` listens on `document` without checking whether it
      is topmost (**X-13**) — so a second listener here would answer the
      question *and* throw away the catalogue behind it in one keypress.
    */
    await openLibrary(page)
    const first = page.getByRole('button', { name: /^Download \(/ }).first()
    await first.click()
    await expect(page).toHaveURL(/#\/worlds\//, { timeout: 90_000 })

    await page.goto('/')
    await page.getByRole('button', { name: 'Library', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()

    /*
      Wait for the catalogue to *know* the world is installed before clicking.
      `installedWorldIds` comes from a live query on the selector behind this
      dialog, so clicking the moment the heading appears asks a catalogue that
      still thinks nothing is downloaded — and it downloads again with no
      confirm, which is not the state this test is about. "Download again"
      appearing is the app saying it has caught up.
    */
    const again = page.getByRole('button', { name: 'Download again' }).first()
    await expect(again).toBeVisible({ timeout: 30_000 })
    await again.click()
    await expect(page.getByText(/Replace your copy of/)).toBeVisible({ timeout: 30_000 })

    await page.keyboard.press('Escape')
    // The question is gone and the catalogue is still there behind it.
    await expect(page.getByText(/Replace your copy of/)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()
  })
})
