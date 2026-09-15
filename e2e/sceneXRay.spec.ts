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
      panel(page).getByRole('link', { name: `Open ${name}`, exact: true }),
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

  /*
    The rows, not the links. The only link in a row is the eye, which is an icon
    with no text of its own — reading link text here returned a list of empty
    strings and this test compared nothing against nothing.
  */
  const names = async () => (await panel(page).getByRole('listitem').allInnerTexts())
    .map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean)

  /*
    Wait for the panel to fill before reading it. The prose being on screen does
    not mean this has anything in it yet: its observer fires in its own effect
    and the three entity hooks are live queries that resolve after. Reading
    straight after `openBook` caught it empty about one run in five — a flake I
    introduced and then saw go green on retry, which is the shape of thing that
    gets left alone and should not be.
  */
  await expect(panel(page).getByRole('link').first()).toBeVisible({ timeout: 20_000 })
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

test('the eye opens that character\'s page, and the name alone does not', async ({ page }) => {
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page, worldId)

  const eye = panel(page).getByRole('link').first()
  const name = (await eye.getAttribute('aria-label') ?? '').replace(/^Open /, '')
  expect(name, 'the eye says where it goes').not.toBe('')

  /*
    The name is text now, not a control. The whole row used to be a link, which
    is what made the picture unclickable — and the picture is the subject here,
    so it opens full size instead.
  */
  await panel(page).getByText(name, { exact: true }).click()
  await expect(page, 'reading the name does not leave the book')
    .toHaveURL(/#\/worlds\/[^/]+\/manuscript$/)

  await eye.click()
  await expect(page).toHaveURL(/#\/worlds\/[^/]+\/characters\/[^/]+$/)
  await expect(page.getByRole('main').getByText(name, { exact: true }).first()).toBeVisible()
})

test('and coming back puts the reader where they were, not where they had read to', async ({ page }) => {
  /*
    The trip this panel makes constantly: tap a name, read who they are, come
    back. The cursor alone answered it badly twice — it is a high-water mark, so
    scrolling back and returning jumped forward again, and it names a scene
    rather than a place inside one, so a long scene restarted from its top.
  */
  const worldId = await downloadLibraryBook(page, 'The Count of Monte Cristo')
  await settle(page)
  await openBook(page, worldId)

  const scroller = page.locator('div.flex-1.overflow-auto').first()

  /*
    Deep inside one long scene, not at an arbitrary pixel.

    The distance between the two possible answers *is* the offset into the
    scene: restoring by cursor lands on the scene's first line, restoring by
    spot lands where the reader was. Scrolling to a round number left those two
    close enough that disabling the spot still passed — a mutation run caught
    this test asserting nothing.
  */
  const target = await scroller.evaluate((el) => {
    const scenes = Array.from(el.querySelectorAll<HTMLElement>('[data-scene-event-id]'))
    const long = scenes.find((s) => s.offsetHeight > 4000) ?? scenes[scenes.length - 1]
    return { top: long.offsetTop, into: 2500 }
  })
  expect(target.top, 'a scene well into the book').toBeGreaterThan(0)

  const want = target.top + target.into
  await scroller.evaluate((el, to) => { el.scrollTop = to }, want)
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop), { timeout: 10_000 })
    .toBeGreaterThan(want - 50)

  await panel(page).getByRole('link').first().click()
  await expect(page).toHaveURL(/#\/worlds\/[^/]+\/characters\/[^/]+$/)

  /*
    Back through the app, not through history.

    `page.goBack()` proves nothing here: Chromium restores a scroller's offset
    itself across a history navigation, and this test passed identically with
    the restore disabled — `back` came out exactly equal to `want` either way. A
    reader returning to the book taps **Read**, which is a forward navigation
    with no restoration behind it, and that is the trip that was losing them
    their page.
  */
  await page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Read', exact: true }).click()
  await expect(page.locator('[data-scene-event-id]').first()).toBeVisible({ timeout: 60_000 })

  /*
    Within a few hundred pixels of where they were — and, the half that makes it
    a test, nowhere near the top of that scene, which is where restoring by
    cursor alone would land them, 2,500px above.
  */
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop), { timeout: 20_000 })
    .toBeGreaterThan(target.top + 1_000)
  const back = await scroller.evaluate((el) => el.scrollTop)
  expect(Math.abs(back - want), `came back to ${back}, wanted ${want}`).toBeLessThan(500)
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

test('the card says which scene it is describing, and keeps up', async ({ page }) => {
  /*
    "In this scene" had no antecedent: the card never named one, so after a few
    minutes of scrolling there was no way to tell whether it had kept up.
  */
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page, worldId)

  const label = async (nth: number) => page.evaluate(async (n: number) => {
    const db = (window as unknown as { __pwdb?: Record<string, {
      toArray: () => Promise<Record<string, string | number | null>[]>
    }> }).__pwdb!
    const [events, chapters] = await Promise.all([db.events.toArray(), db.chapters.toArray()])
    const no = new Map(chapters.map((c) => [c.id as string, c.number as number]))
    const ordered = events
      .map((e) => ({ e, key: (no.get(e.chapterId as string) ?? 0) * 10_000 + (e.sortOrder as number) }))
      .sort((a, b) => a.key - b.key)
      .map((x) => x.e)
    const ev = n < 0 ? ordered[ordered.length + n] : ordered[n]
    return `Ch. ${no.get(ev.chapterId as string)} · ${ev.title}`
  }, nth)

  const shown = () => panel(page).locator('[title]').first().innerText()

  await expect.poll(shown, { timeout: 20_000 }).toBe(await label(0))

  const scenes = page.locator('[data-scene-event-id]')
  await scenes.nth((await scenes.count()) - 1).scrollIntoViewIfNeeded()
  await expect.poll(shown, { timeout: 20_000 }).toBe(await label(-1))
})

test('on a phone every row of the sheet can actually be pressed', async ({ page }) => {
  /*
    The sheet rises from the bottom edge and the chapter bar is fixed there at
    `z-1000`, so at `z-40` it came up *behind* the bar: at 390px the Place group
    was cut in half and its eye could not be reached. `toBeVisible` would not
    have caught it — Playwright does not test occlusion — but a click does,
    because actionability does.
  */
  await page.setViewportSize({ width: 390, height: 780 })
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page, worldId)

  await page.getByRole('button', { name: 'Show who is in this scene' }).last().click()
  const sheet = page.getByRole('dialog', { name: 'In this scene' })
  await expect(sheet).toBeVisible()

  const eyes = sheet.getByRole('link')
  const count = await eyes.count()
  expect(count, 'the sheet has rows').toBeGreaterThan(1)
  // The last one, which is the one the bar was covering.
  await eyes.nth(count - 1).click({ timeout: 10_000 })
  await expect(page).toHaveURL(/#\/worlds\/[^/]+\/(characters|items|maps)/)
})
