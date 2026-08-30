import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * NEW-1: the full 14-icon rail sat at full strength beside the first-run guide,
 * so a dozen necessarily-empty screens were one click from a flow trying to
 * lead somewhere. The guide and the freedom undercut each other.
 *
 * The decision was that the guide wins *visually* and not structurally. Two
 * earlier attempts removed the rail instead: the whole thing, which broke 33
 * specs — and those specs were right, because wandering off by the rail is a
 * supported path — and the extended tier, which flickered, since the dashboard
 * paints the rail a beat before the wizard latches.
 *
 * So this spec guards both halves at once: the rail must *recede*, and it must
 * still work. A future attempt to hide it would fail the second half, which is
 * the whole point of writing it that way.
 */

const rail = '[data-rail-chrome]'

async function firstRunWorld(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('First Run')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  await expect(page.getByRole('heading', { name: 'Your story begins with a moment' }))
    .toBeVisible({ timeout: 30_000 })
}

test.describe('The first-run guide owns the screen without taking the rail away', () => {
  test.describe.configure({ timeout: 120_000 })

  test('the rail recedes while the guide is up, and comes back after', async ({ page }) => {
    await firstRunWorld(page)

    // Presence: it has receded. Polled rather than read once — the rail fades
    // over 200ms, so an instant read lands mid-transition and sees the 1 it is
    // animating away from. That is a race in the assertion, not in the app, but
    // it looks exactly like a flake from the outside.
    await expect.poll(
      () => page.locator(rail).evaluate((el) => Number(getComputedStyle(el).opacity)),
      { timeout: 10_000, message: 'the rail should be dimmed while the guide is up' },
    ).toBeLessThan(1)

    // Absence of the two reverted attempts: nothing has been removed and
    // nothing has been made unclickable. This is the half that fails if anyone
    // hides the rail again.
    const state = await page.locator(rail).evaluate((el) => ({
      links: el.querySelectorAll('a').length,
      pointerEvents: getComputedStyle(el).pointerEvents,
    }))
    expect(state.links, 'every rail destination should still be there').toBeGreaterThan(10)
    expect(state.pointerEvents).not.toBe('none')

    // It does not even *look* unavailable to whoever reaches for it.
    await page.locator(rail).hover()
    await expect.poll(
      () => page.locator(rail).evaluate((el) => Number(getComputedStyle(el).opacity)),
      { message: 'hovering the rail should restore it in full' },
    ).toBe(1)

    // The opposite condition: leaving the guide restores the rail outright,
    // with no hover needed.
    await page.mouse.move(700, 500)
    await page.getByRole('button', { name: /Skip and explore/i }).click()
    await expect(page.getByRole('heading', { name: 'Your story begins with a moment' }))
      .toHaveCount(0)
    await expect.poll(
      () => page.locator(rail).evaluate((el) => Number(getComputedStyle(el).opacity)),
      { message: 'the rail should be back to full once the guide is gone' },
    ).toBe(1)
  })

  test('the rail still takes you somewhere while the guide is up', async ({ page }) => {
    await firstRunWorld(page)

    // The finding's own counter-argument, kept honest: leaving a blank world by
    // the rail is a supported path, so dimming must not become blocking.
    await page.locator(rail).hover()
    await page.locator(rail).getByRole('link', { name: 'Characters' }).click()
    await expect(page).toHaveURL(/\/characters$/)
    await expect(page.getByRole('heading', { name: 'Characters' }).first()).toBeVisible()

    // And off that screen the guide is not dimming anything, because it is not
    // on screen — the class goes with it rather than lingering on the document.
    await expect.poll(
      () => page.locator(rail).evaluate((el) => Number(getComputedStyle(el).opacity)),
    ).toBe(1)
  })
})
