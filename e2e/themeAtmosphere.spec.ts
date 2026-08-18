import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { APP_THEMES, themeClass } from '../src/lib/themes'

/**
 * The theme "atmosphere" is the texture behind the app — grain, hatching, a
 * grid. It is meant to be a whisper, and it was neither behind nor a whisper.
 *
 * It was painted by `body::after` at `z-index: 9999` — the value dialogs use,
 * so it won a tie on document order and drew over cards, dialogs and their
 * text. Noir's light-leak bands ran straight across the words of a modal; they
 * are gone now, and its vignette carries the theme instead.
 *
 * Some of it was not texture at all. Sci-fi's starfield was **two** circles at
 * fixed viewport percentages, which reads as dead pixels; default, cyberpunk
 * and action each drew a single hard-edged band across the whole window, which
 * reads as a scratch on the screen; romance drew concentric rings.
 *
 * The rule that separates the two is shape, not taste: a repeating pattern or a
 * soft radial glow is texture; a single hard-edged line or an isolated dot is a
 * mark. These read the *computed* values, so they check what the browser
 * resolves rather than what the stylesheet appears to say.
 */

async function themedWorld(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Theme Probe')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//, { timeout: 30_000 })
  return page.url().split('/worlds/')[1].split('/')[0]
}

const applyTheme = (page: Page, cls: string | null) => page.evaluate((c) => {
  const root = document.documentElement
  for (const name of Array.from(root.classList)) {
    if (name.startsWith('theme-')) root.classList.remove(name)
  }
  if (c) root.classList.add(c)
}, cls)

const atmosphereOf = (page: Page) => page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--theme-atmosphere').trim())

test.describe('Theme atmosphere', () => {
  test.describe.configure({ timeout: 300_000 })

  /**
   * Every theme the picker offers must actually be styled.
   *
   * Three shipped books asked for `theme-gothic`, `theme-mystery` and
   * `theme-mythic` when no such rule existed: the class matched nothing, the
   * world fell back to Dark Slate, and the Settings picker showed no card as
   * chosen. A unit test catches a *book* naming a theme that is not registered
   * — `libraryThemes.test.ts` does — but not a theme that is registered and
   * never styled, because vitest stubs the stylesheet. Only a browser can see
   * that the class does something.
   */
  test('every theme in the picker actually restyles the app', async ({ page }) => {
    await themedWorld(page)

    await applyTheme(page, null)
    const base = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--background').trim())
    expect(base, 'the default theme should define a background').not.toBe('')

    for (const t of APP_THEMES) {
      if (t.id === 'default') continue
      await applyTheme(page, themeClass(t.id))
      const background = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--background').trim())
      expect(background, `${t.id} has no stylesheet rule of its own`).not.toBe(base)
    }
  })

  test('carries texture, and no hard-edged marks, in every theme', async ({ page }) => {
    await themedWorld(page)

    let withTexture = 0
    for (const t of APP_THEMES) {
      await applyTheme(page, themeClass(t.id))
      const value = await atmosphereOf(page)

      // A bare `linear-gradient` across a fixed percentage is one line drawn
      // over the whole window. Hatching is `repeating-linear-gradient`.
      expect(value.replace(/repeating-linear-gradient\(/g, ''), `${t.id}: single band`)
        .not.toContain('linear-gradient(')
      // `white 0 1px, transparent 1.5px` at one position is a speck, not a star.
      expect(value, `${t.id}: isolated dot`).not.toMatch(/\b0 1px\b/)

      if (value.includes('repeating-linear-gradient(')) withTexture++
    }

    // The presence half: a rule banning every gradient would satisfy the two
    // assertions above while emptying the feature.
    expect(withTexture, 'themes still carrying repeating texture').toBeGreaterThanOrEqual(6)
  })

  /**
   * Noir carries no bands, and this is **taste rather than the shape rule**.
   *
   * Seven pixels of near-white every 73 is a repeating pattern, so everything
   * above permits it; it was removed because it reads as damage rather than
   * film, and moving the layer behind the app only meant it streaked the space
   * around the cards instead of the words. Recorded here because a decision
   * nothing checks is one the next edit undoes by accident.
   */
  test('leaves noir its vignette and no scratches', async ({ page }) => {
    await themedWorld(page)
    await applyTheme(page, themeClass('noir'))

    const value = await atmosphereOf(page)
    expect(value, 'noir should carry no bands').not.toContain('repeating-linear-gradient(')
    // The pair: it is not simply empty — the vignette is what carries the theme.
    expect(value).toContain('radial-gradient(')
  })

  /**
   * Where the layer sits, measured rather than asserted about the stylesheet:
   * the same dialog is photographed with the texture on and with it suppressed,
   * and the two must be identical — the texture cannot reach the dialog.
   *
   * The background behind it must *differ* between those two states, or this
   * would pass just as well on a theme with no texture at all.
   */
  test('is painted behind the app, not over it', async ({ page }) => {
    await themedWorld(page)
    /*
      Cyberpunk, because a grid is the boldest repeating texture left and it
      crosses the whole window — so if this layer ever climbs back over the app,
      the dialog's pixels change and this fails loudly.

      It was noir until noir's light-leak bands were removed; a vignette alone
      still proves the point but barely reaches the middle of the screen, which
      is a thinner test than it reads as.
    */
    await applyTheme(page, themeClass('cyberpunk'))
    await page.waitForTimeout(400)

    const dialog = page.locator('#root').getByText('Your story begins with a moment').locator('..')
    await expect(dialog).toBeVisible()

    const withTexture = { dialog: await dialog.screenshot(), page: await page.screenshot({ clip: { x: 60, y: 60, width: 300, height: 90 } }) }

    await page.evaluate(() => document.documentElement.style.setProperty('--theme-atmosphere', 'none'))
    await page.waitForTimeout(400)

    const without = { dialog: await dialog.screenshot(), page: await page.screenshot({ clip: { x: 60, y: 60, width: 300, height: 90 } }) }

    expect(withTexture.dialog.equals(without.dialog), 'the texture must not reach the dialog').toBe(true)
    expect(withTexture.page.equals(without.page), 'but it must be painting somewhere').toBe(false)
  })
})
