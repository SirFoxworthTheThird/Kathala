import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * NEW-2, NEW-3 and NEW-4 — what the first-run wizard tells you about itself.
 *
 * NEW-4 is measured here rather than fixed: the finding says content occupies
 * the top-left third with the rest given over to the watermark, and neither is
 * true any more — the watermark went with X-1 and the card was centred for
 * NEW-1. The numbers below are what says so, and they fail if either regresses.
 */

async function firstRun(page: Page) {
  await page.goto('/')
  await resetDB(page)
  // resetDB pre-dismisses the tutorial; the wizard is the thing under test.
  await page.evaluate(() => localStorage.removeItem('plotweave-tutorial'))
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('First')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  await expect(page.getByRole('navigation', { name: 'Wizard progress' }))
    .toBeVisible({ timeout: 30_000 })
}

test.describe('The first-run wizard says what it is asking for', () => {
  test.describe.configure({ timeout: 120_000 })
  test.use({ viewport: { width: 1440, height: 900 } })

  test('NEW-2: the steps are named on screen, not only to a screen reader', async ({ page }) => {
    await firstRun(page)
    const nav = page.getByRole('navigation', { name: 'Wizard progress' })

    // Presence: every step's name is readable, so what step 3 will ask is
    // visible from step 1. They used to exist only inside each dot's aria-label.
    for (const label of ['Begin your story', 'Add a character', 'Place them in the story', 'Done']) {
      await expect(nav.getByText(label, { exact: true })).toBeVisible()
    }

    // And the numbers are still there, so position is not lost to the names.
    const dots = await nav.evaluate((el) =>
      Array.from(el.querySelectorAll('li')).map((li) => (li.textContent ?? '').trim()),
    )
    expect(dots[0]).toContain('1')
    expect(dots.length).toBe(4)
  })

  test('NEW-3: the step-1 button names what it does', async ({ page }) => {
    await firstRun(page)

    // "Begin" read as "start the wizard", which had already started.
    await expect(page.getByRole('button', { name: 'Begin', exact: true })).toHaveCount(0)

    // And not "Create timeline" either: the Timeline screen's empty state has a
    // "Create Timeline" button, and `getByRole` matches names case-insensitively,
    // so re-using it made the two indistinguishable across a navigation. Two
    // specs started failing intermittently on exactly that.
    await expect(page.getByRole('button', { name: 'Create timeline', exact: true })).toHaveCount(0)

    const create = page.getByRole('button', { name: 'Create and continue' })
    await expect(create).toBeVisible()
    await page.getByLabel('Timeline name').fill('The Age of Embers')
    await page.getByLabel('The first scene').fill('The wreck')
    await create.click()

    // It did what it says, and the wizard moved on — so this is not passing on
    // a button that was merely relabelled and wired to nothing.
    //
    // Read off step 2's *heading*, not the step name in the progress nav: NEW-2
    // draws all four names at all times, so "Add a character" is on screen
    // during step 1 as well and asserting it proves nothing.
    await expect(page.getByRole('heading', { name: 'Every story needs someone to follow' }))
      .toBeVisible({ timeout: 15_000 })
  })

  test('NEW-5: you can walk back through the guide without it building twice', async ({ page }) => {
    await firstRun(page)

    // Absence first: step 1 is the beginning, so there is nothing behind it.
    await expect(page.getByRole('button', { name: 'Back a step' })).toHaveCount(0)

    await page.getByLabel('Timeline name').fill('The Long Road')
    await page.getByLabel('The first scene').fill('The wreck')
    await page.getByRole('button', { name: 'Create and continue' }).click()
    await expect(page.getByRole('heading', { name: 'Every story needs someone to follow' }))
      .toBeVisible({ timeout: 15_000 })

    // Presence: from step 2 there is a way back, and it goes back.
    await page.getByRole('button', { name: 'Back a step' }).click()
    await expect(page.getByRole('heading', { name: 'Your story begins with a moment' })).toBeVisible()

    // And step 1 shows what it made rather than the form, which is the whole
    // reason Back is safe: offering it again would build a second timeline,
    // chapter and scene.
    //
    // Scoped to `main`: the time-cursor pill in the top bar carries the active
    // scene's title too, and step 1 sets the cursor to the scene it makes, so a
    // page-wide match here is ambiguous by construction.
    await expect(page.getByRole('main').getByText('The wreck', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Timeline name'), 'the form is done with').toHaveCount(0)

    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('heading', { name: 'Every story needs someone to follow' })).toBeVisible()
    await page.getByLabel('Character name').fill('Kestrel')
    await page.getByRole('button', { name: 'Add them to the story' }).click()
    await expect(page.getByRole('heading', { name: 'Where does their story begin?' }))
      .toBeVisible({ timeout: 15_000 })

    // The world holds exactly what the walk asked for: one of each, not two.
    const counts = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<
        string, { count: () => Promise<number> }
      >
      return {
        timelines: await db.timelines.count(),
        chapters: await db.chapters.count(),
        events: await db.events.count(),
        characters: await db.characters.count(),
      }
    })
    expect(counts, 'walking back and forward should not duplicate anything')
      .toEqual({ timelines: 1, chapters: 1, events: 1, characters: 1 })
  })

  test('NEW-4: the first screen is centred, not a third of a page of wallpaper', async ({ page }) => {
    await firstRun(page)

    const geom = await page.getByRole('navigation', { name: 'Wizard progress' }).evaluate((el) => {
      const card = el.closest('div')!.getBoundingClientRect()
      return {
        centreOffset: Math.round(Math.abs(card.left + card.width / 2 - window.innerWidth / 2)),
        topFraction: card.top / window.innerHeight,
      }
    })
    // Measured at 1440x900: a 576x366 card at left=458, top=291 — centred, and
    // starting a third of the way down rather than pinned to the top-left.
    expect(geom.centreOffset, 'the card is pushed off centre').toBeLessThan(40)
    expect(geom.topFraction).toBeGreaterThan(0.1)

    // The watermark this finding is half about (X-1) is gone for good.
    const wallpaper = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundImage)
    expect(wallpaper === 'none' || !wallpaper.includes('url(')).toBe(true)
  })
})

test('OP-3: step 1 names the moment it makes, and says what else it makes', async ({ page }) => {
  // The step asked only for a timeline name and quietly created three records:
  // the timeline, a "Chapter 1" nobody mentioned, and a scene that took the
  // timeline's own name. The writer then met a moment they had not named.
  await firstRun(page)

  // It says what it is about to build, rather than leaving you to find out.
  await expect(page.getByText(/This makes your timeline, a\s+Chapter 1\s+inside it/))
    .toBeVisible()

  // The moment is asked for, not assumed: naming only the timeline does not
  // proceed...
  await page.getByLabel('Timeline name').fill('The Age of Embers')
  await page.getByRole('button', { name: 'Create and continue' }).click()
  await expect(page.getByRole('alert')).toContainText('Name the first scene')
  // Still on step 1. Measured by the step's own heading — the progress nav
  // names every step at all times, so it says nothing about where you are.
  const step2 = page.getByRole('heading', { name: 'Every story needs someone to follow' })
  await expect(step2).toHaveCount(0)

  // ...and naming it does, which is the presence half of that absence.
  await page.getByLabel('The first scene').fill('The wreck of the Kestrel')
  await page.getByRole('button', { name: 'Create and continue' }).click()
  await expect(step2).toBeVisible({ timeout: 15_000 })

  // The scene carries the name the writer gave it, not the timeline's — which
  // is what made the created moment feel like someone else's.
  const stored = await page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as {
      events: { toArray: () => Promise<{ title: string }[]> }
      chapters: { toArray: () => Promise<{ title: string }[]> }
    }
    return {
      events: (await db.events.toArray()).map((e) => e.title),
      chapters: (await db.chapters.toArray()).map((c) => c.title),
    }
  })
  expect(stored.events).toEqual(['The wreck of the Kestrel'])
  expect(stored.chapters).toEqual(['Chapter 1'])
})

test('OP-4: only one button on the character step is an "Add"', async ({ page }) => {
  // "Add a description (optional)" sat directly above "Add them to the story".
  // One submits the step, one expands a field, and pressing the wrong one read
  // as nothing happening at all.
  await firstRun(page)
  await page.getByLabel('Timeline name').fill('The Age of Embers')
  await page.getByLabel('The first scene').fill('The wreck')
  await page.getByRole('button', { name: 'Create and continue' }).click()

  const form = page.getByRole('main')
  await expect(form.getByRole('button', { name: 'Add them to the story' }))
    .toBeVisible({ timeout: 15_000 })
  await expect(form.getByRole('button', { name: /^Add/ })).toHaveCount(1)

  // The disclosure is still there and still discloses — so the count above is
  // one because the control was renamed, not because it was removed.
  const disclosure = form.getByRole('button', { name: 'Description (optional)' })
  await expect(disclosure).toBeVisible()
  await expect(form.getByLabel('Character description (optional)')).toHaveCount(0)
  await disclosure.click()
  await expect(form.getByLabel('Character description (optional)')).toBeVisible()
})
