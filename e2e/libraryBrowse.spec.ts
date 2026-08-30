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

  /*
    Most shipped worlds keep their maps and covers as links rather than bytes —
    Dracula's `.pwk` carries 76 of them — so the book arrives complete except
    that its pictures need a connection. The map screen says so honestly once
    you are there; the card said "Download (363 KB)" and left a reader to find
    out on a train.
  */
  test('a card says whether its pictures come with it', async ({ page }) => {
    await openLibrary(page)
    // Page-level: the Library overlay is not a `role="dialog"`, so scoping to
    // one matched nothing and the first version of this failed for that reason
    // rather than for the app's.
    await expect(page.getByText('Pictures load from the web').first()).toBeVisible({ timeout: 30_000 })

    /*
      The pair, and the reason this is not just "print a line on every card":
      four of the thirty worlds *do* ship an image bundle, and must say the
      opposite rather than being labelled as loading from the web.
    */
    const bundled = page.getByText('Embedded images').first()
    await expect(bundled).toBeVisible()
    const card = bundled.locator('xpath=ancestor::li[1]')
    await expect(card.getByText('Pictures load from the web')).toHaveCount(0)

    /*
      One way in, on both kinds of card. There used to be a second button —
      "With images (14.6 MB)" — and choosing between the two meant knowing what
      a `.pwb` was; the one a reader was likelier to press was the one that left
      the maps blank. The bundle's size is now inside the single button, which
      is the part that matters on a phone.
    */
    await expect(page.getByRole('button', { name: /^With images/ })).toHaveCount(0)
    await expect(card.getByRole('button', { name: /^Download \(/ })).toHaveCount(1)
    const plain = page.getByText('Pictures load from the web').first().locator('xpath=ancestor::li[1]')
    await expect(plain.getByRole('button', { name: /^Download \(/ })).toHaveCount(1)

    /*
      And the size on it is the whole download. The Fellowship's data is 587 KB
      against a 15 MB bundle, so a button still reading a few hundred kilobytes
      would be the old promise with the old button removed.
    */
    const label = await card.getByRole('button', { name: /^Download \(/ }).textContent()
    expect(label, 'a bundled world quotes megabytes, not kilobytes').toMatch(/\d+(\.\d+)? MB/)
  })

  /*
    The half the card's wording rests on. "Embedded images" is a claim that the
    pictures arrive with the book, and the button that used to make that happen
    is gone — so the remaining one has to ask for the bundle. Asserting the
    label alone would pass just as happily on a card that says so and downloads
    the text.

    The `.pwb` is intercepted rather than really fetched: the smallest is 1.2 MB
    and the largest 15 MB, and a suite that pulls those down to prove a request
    was made is paying megabytes for one boolean.
  */
  test('the one button asks for the image bundle', async ({ page }) => {
    await openLibrary(page)
    let asked: string | null = null
    await page.route('**/*.pwb', async (route) => {
      asked = new URL(route.request().url()).pathname
      // A valid, empty images file, so the download finishes rather than
      // reporting a failure that would mask what is being tested.
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ version: 1, type: 'images', images: [] }),
      })
    })

    const card = page.getByText('Embedded images').first().locator('xpath=ancestor::li[1]')
    await card.getByRole('button', { name: /^Download \(/ }).click()
    await expect(page.getByRole('heading', { name: 'Library' })).toHaveCount(0, { timeout: 120_000 })
    expect(asked, 'the bundle should have been requested').toMatch(/\.pwb$/)
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
