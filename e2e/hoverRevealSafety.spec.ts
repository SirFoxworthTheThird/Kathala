import { test, expect, type Page, type Locator } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * A control you cannot see cannot be activated.
 *
 * **LORE-1** measured this shape once — `opacity-0` with pointer events still
 * live, hit-testing to itself — and found it worse than a permanent icon,
 * because on a touch device there is no hover and the resting state is the
 * only state, so a tap on an apparently blank row fires it. What the review
 * never did was grep for the shape: it was in seven places, and one of them
 * deletes a world.
 *
 * Each case pairs the absence with the presence in the same test — `none` at
 * rest, `auto` on hover — because "invisible" alone is satisfied by a control
 * that has been broken outright.
 *
 * **The two selection checkboxes are deliberately not here.** They have the
 * same shape and are left ungated: a tap that toggles a selection is visible
 * and reversible where a tap that deletes is neither, so there is nothing to
 * protect against.
 *
 * The reason first written here was different and was wrong — that `group-hover`
 * never fires on touch, so gating would leave a phone no way to select at all.
 * The first half is true; the second does not follow, because `index.css` shows
 * hover-revealed controls unconditionally on a hover-less pointer. HB-2b was
 * closed on that measurement, and the last test below pins down what the gate
 * really does on a phone.
 */

/**
 * `opacity` is not inherited — a child of an `opacity-0` wrapper computes its
 * own as `1` — so reading it off the control says nothing. `pointer-events`
 * *is* inherited, which is why the gate works at all. Walk up for the first
 * ancestor that actually fades, so a gate on the row and a gate on the button
 * both measure the same.
 */
async function restingState(control: Locator) {
  return control.evaluate((el) => {
    let node: HTMLElement | null = el as HTMLElement
    let opacity = '1'
    while (node) {
      const o = getComputedStyle(node).opacity
      if (o !== '1') { opacity = o; break }
      node = node.parentElement
    }
    return { opacity, pointerEvents: getComputedStyle(el).pointerEvents }
  })
}

async function seedWorld(page: Page, name: string) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]

  // A world with no timeline meets the first-run guide instead of the
  // dashboard's own panels, so the thread row would never render.
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({
      id: 'tl1', worldId: id, name: 'Main', description: '',
      color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now,
    })
    await db.chapters.add({
      id: 'ch1', worldId: id, timelineId: 'tl1', number: 1, title: 'Chapter 1',
      synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
    })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl1', title: 'The wreck',
      description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })
  }, worldId)
  await page.waitForTimeout(600)

  await dismissFirstRunGuide(page)
  return worldId
}

/** Hidden at rest, and back on hover — both halves, or the test proves nothing. */
async function assertHiddenThenRevealed(control: Locator, row: Locator, what: string) {
  await expect(control, `${what} should exist`).toHaveCount(1)

  // Polled, not sampled. These fade on a `transition-opacity`, so a reading
  // taken the instant the pointer leaves catches the tail of the animation —
  // this assertion first failed on a measured 0.966906, which is a fade in
  // progress rather than a control that stayed visible.
  await expect.poll(() => restingState(control).then((s) => s.opacity),
    { message: `${what} should settle invisible at rest` }).toBe('0')
  const atRest = await restingState(control)
  expect(atRest.pointerEvents, `${what} must not hit-test while invisible`).toBe('none')

  await row.hover()
  await expect.poll(() => control.evaluate((el) => getComputedStyle(el).pointerEvents),
    { message: `${what} should come back on hover` }).toBe('auto')
  await expect.poll(() => restingState(control).then((s) => s.opacity)).toBe('1')
}

test.describe('Hover-revealed controls cannot be activated while invisible', () => {
  test.describe.configure({ timeout: 180_000 })

  test('the world card, whose row deletes a world', async ({ page }) => {
    await seedWorld(page, 'Highbarrow')
    await page.goto('/')
    await settle(page)
    // Park the pointer away from the card, or the "at rest" reading is a hover.
    await page.mouse.move(0, 0)

    const card = page.locator('.group').filter({ hasText: 'Highbarrow' }).first()
    const del = card.getByRole('button', { name: /delete/i }).first()
    await assertHiddenThenRevealed(del, card, 'the world delete')
  })

  test('the plot-thread row, and its delete is named after its thread', async ({ page }) => {
    const worldId = await seedWorld(page, 'Highbarrow')
    await page.goto(`/#/worlds/${worldId}`)
    await settle(page)

    const newThread = page.getByRole('button', { name: 'New thread' })
    await expect(newThread, 'the dashboard should offer the threads panel').toBeVisible({ timeout: 60_000 })
    await newThread.click()
    await page.getByPlaceholder(/Thread name/).fill('The Rebellion')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await settle(page)
    await page.mouse.move(0, 0)

    const row = page.locator('.group').filter({ hasText: 'The Rebellion' }).first()
    const del = page.getByRole('button', { name: 'Delete thread The Rebellion', exact: true })
    await assertHiddenThenRevealed(del, row, 'the thread delete')
  })

  test('and the lore category controls, which had no name at all', async ({ page }) => {
    const worldId = await seedWorld(page, 'Highbarrow')
    await page.goto(`/#/worlds/${worldId}/lore`)
    await settle(page)

    await page.getByRole('button', { name: /New category/i }).first().click()
    const field = page.getByPlaceholder('Category name')
    await field.fill('Houses')
    await field.press('Enter')
    await page.waitForTimeout(1000)
    await page.mouse.move(0, 0)

    const row = page.locator('.group').filter({ hasText: 'Houses' }).first()
    // Both had no accessible name at all, which is the half the review filed.
    for (const label of ['Rename category Houses', 'Delete category Houses']) {
      const control = page.getByRole('button', { name: label, exact: true })
      await assertHiddenThenRevealed(control, row, label)
      await page.mouse.move(0, 0)
    }
  })

  /**
   * What the gate does on a phone, which the three tests above cannot see
   * because they run at desktop width with a mouse.
   *
   * `index.css` has shown these controls unconditionally on a hover-less
   * pointer since #85, but lifted only the *opacity* half — so they were drawn
   * at full strength and took no taps: a button indistinguishable from a
   * working one that ignores you. It looked like it might be deliberate, "no
   * deleting from a list on touch", since the gate is on the delete alone and
   * Export beside it still worked. It was not. `deleteWorld` is called from
   * exactly one place in the app and this is it, so a world could not be
   * deleted on a phone at all (**HB-2d**).
   *
   * Visible now implies tappable. The hazard LORE-1 measured — invisible and
   * still hit-testing — is a *hover* device's problem, and the three tests
   * above are what keep it fixed there.
   */
  test.describe('on a phone, where there is no hover to give', () => {
    test.use({ viewport: { width: 390, height: 667 }, hasTouch: true })

    test('the delete is drawn, tappable, and asks before it acts', async ({ page }) => {
      await seedWorld(page, 'Highbarrow')
      await page.goto('/')
      await settle(page)

      const card = page.locator('.group').filter({ hasText: 'Highbarrow' }).first()
      const del = card.getByRole('button', { name: /delete/i }).first()

      // Drawn, and live — the pair that used to disagree.
      await expect.poll(() => restingState(del).then((s) => s.opacity)).toBe('1')
      await expect.poll(() => restingState(del).then((s) => s.pointerEvents)).toBe('auto')

      // A real tap, with no `force`: Playwright refuses an element with no
      // pointer events, so this call is itself the assertion that the gate has
      // lifted.
      await del.tap()

      // And it asks first. The world is still there behind the question.
      await expect(page.getByRole('alertdialog').or(page.getByRole('dialog'))).toBeVisible()
      await expect(page.getByText(/Highbarrow/).first()).toBeVisible()
    })
  })
})
