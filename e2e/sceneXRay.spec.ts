import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * Who is in the scene, beside the page you are reading it on.
 *
 * *Alice* keeps its illustrations as Tenniel's engravings, referenced by URL
 * from the book's own site, and 92% of characters across the Library carry a
 * portrait. A scene names a median of five things — three people, a place and
 * the occasional object — so this is a panel rather than a wall.
 *
 * The half that has to hold is the gate. Being *mentioned* deliberately does
 * not count as meeting someone (`useReading.ts`: a name dropped in dialogue is
 * foreshadowing a reader should meet in the book rather than in an index), so a
 * panel that listed the scene's `mentionedCharacterIds` raw would reopen the
 * hole the gate exists to close.
 */

const panel = (page: Page) => page.getByRole('complementary', { name: 'In this scene' })

async function openBook(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await expect(page.locator('[data-scene-event-id]').first()).toBeVisible({ timeout: 60_000 })
}

test.beforeEach(async ({ page }) => { await resetDB(page) })

test('the panel names the people in the scene on screen', async ({ page }) => {
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page, worldId)

  await expect(panel(page)).toBeVisible()

  /*
    Against the database rather than against a name I picked: the Library is
    regenerated, and a hard-coded "Alice" would survive a panel that had stopped
    reading the scene and started guessing.
  */
  const expected = await page.evaluate(async () => {
    const db = (window as unknown as { __pwdb?: Record<string, {
      toArray: () => Promise<Record<string, string | number | string[] | null>[]>
    }> }).__pwdb!
    const [events, chapters, characters] = await Promise.all([
      db.events.toArray(), db.chapters.toArray(), db.characters.toArray(),
    ])
    const no = new Map(chapters.map((c) => [c.id as string, c.number as number]))
    const first = events
      .filter((e) => no.get(e.chapterId as string) === 1)
      .sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number))[0]
    const byId = new Map(characters.map((c) => [c.id as string, c.name as string]))
    return ((first?.involvedCharacterIds as string[]) ?? [])
      .map((id) => byId.get(id)).filter(Boolean) as string[]
  })
  expect(expected.length, 'the first scene has someone in it').toBeGreaterThan(0)

  /*
    Exact, because `getByRole` matches an accessible name by substring and this
    book has a character *White Rabbit*, a location *The White Rabbit's House*
    and an item *White Rabbit's Pocket Watch* — all three in the panel, all
    three matching a loose lookup for the character.
  */
  for (const name of expected) {
    await expect(
      panel(page).getByRole('link', { name, exact: true }),
      `${name} is in the panel`,
    ).toBeVisible()
  }
  /*
    And each one carries its picture.

    Not by asserting an `<img>`: `stage-library.mjs` copies the `.pwk` files and
    the catalogue into `dist/`, not the artwork, which is 28 MB for *Alice*
    alone — so in a test run every portrait falls back to the placeholder and an
    `img` assertion would only ever be red.

    What is checkable here is the half this panel owns: that a real
    `portraitImageId` reached `PortraitImage`. Its placeholder is deliberately
    two different things — silent when there is no id, and titled *"Image not
    available"* when there is an id whose bytes are missing. The title is
    therefore proof the id was passed through, and in a real deployment those
    same rows draw Tenniel's engravings.
  */
  await expect(
    panel(page).locator('[title^="Image not available"]').first(),
    'the portrait id reached the picture',
  ).toBeVisible()
})

test('the panel follows the scene as the reader moves through the book', async ({ page }) => {
  /*
    The panel keys on the scene *on screen*, not on the reading cursor. The
    cursor is a high-water mark that never moves backwards — it is where you
    have read *to* — so keying on it would show chapter forty's cast to someone
    who had scrolled back to chapter two.
  */
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page, worldId)

  const names = async () => (await panel(page).getByRole('link').allInnerTexts())
    .map((t) => t.trim()).filter(Boolean)

  const atTheStart = await names()
  expect(atTheStart.length, 'the first scene has a cast').toBeGreaterThan(0)

  // Down to a scene well into the book, by the element rather than by pixels.
  const scenes = page.locator('[data-scene-event-id]')
  const count = await scenes.count()
  expect(count, 'the book has scenes to move between').toBeGreaterThan(5)
  await scenes.nth(count - 1).scrollIntoViewIfNeeded()

  await expect.poll(names, { timeout: 15_000 }).not.toEqual(atTheStart)
  const atTheEnd = await names()

  // And back, which is the half the cursor could not do.
  await scenes.first().scrollIntoViewIfNeeded()
  await expect.poll(names, { timeout: 15_000 }).not.toEqual(atTheEnd)
  expect(await names(), 'the opening cast is back').toEqual(atTheStart)
})

test('an entry opens that character\'s page', async ({ page }) => {
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page, worldId)

  const first = panel(page).getByRole('link').first()
  const name = (await first.innerText()).trim()
  await first.click()
  await expect(page).toHaveURL(/#\/worlds\/[^/]+\/characters\/[^/]+$/)
  await expect(page.getByRole('main').getByText(name, { exact: true }).first()).toBeVisible()
})

test('the panel can be put away, and stays away', async ({ page }) => {
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page, worldId)

  // Presence, so the absence below cannot pass on a panel that never drew.
  await expect(panel(page).getByRole('link').first()).toBeVisible()

  await page.getByRole('button', { name: 'Hide who is in this scene' }).click()
  await expect(panel(page).getByRole('link')).toHaveCount(0)

  // And the choice survives a reload, which is the whole reason it is stored.
  await page.reload({ waitUntil: 'load' })
  await settle(page)
  await expect(page.locator('[data-scene-event-id]').first()).toBeVisible({ timeout: 60_000 })
  await expect(panel(page).getByRole('link')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Show who is in this scene' }).first()).toBeVisible()
})

test('a writer drafting the same book is not given the panel', async ({ page }) => {
  /*
    The other half. This is a reading aid — the draft view already shows each
    scene's title and links back to it, and the author knows who is in the scene
    because they put them there. Without this, gating the panel on nothing at
    all would satisfy every test above.
  */
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await page.evaluate(async (id) => {
    const db = (window as unknown as { __pwdb?: {
      worlds: { update: (id: string, changes: Record<string, unknown>) => Promise<number> }
    } }).__pwdb
    await db!.worlds.update(id, { readingMode: false })
  }, worldId)
  await openBook(page, worldId)

  await expect(panel(page)).toHaveCount(0)
})
