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
 * The rule is now simply that **nothing in this layer is ruled**. Grids and
 * hatching were kept for a while under a shape rule — repeating patterns were
 * held to be texture, single bands to be marks — and they were removed in the
 * end on the plain ground that they did not look good. What survives is soft
 * radial wash. These read the *computed* values, so they check what the browser
 * resolves rather than what the stylesheet appears to say.
 */

async function themedWorld(page: Page) {
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
  test('every theme in the picker is styled, and none is another in disguise', async ({ page }) => {
    await themedWorld(page)

    const seen = new Map<string, string>()
    for (const t of APP_THEMES) {
      await applyTheme(page, themeClass(t.id))
      const look = await page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement)
        return ['--background', '--ring', '--font-heading'].map((k) => cs.getPropertyValue(k).trim()).join('|')
      })
      expect(look, `${t.id} resolves nothing at all`).not.toBe('||')

      /*
        Distinct from every *other* theme, not merely from the default.

        Checking against the default alone is what let a real bug through: an
        insertion landed inside the `--app-image` selector list and produced
        `.theme-fantasy, .theme-scifi, .theme-gothic { … }`, so Fantasy and
        Sci-Fi rendered as Gothic — amber and cyan both coming out plum. They
        differed from the default the whole time, and shipped.
      */
      const twin = seen.get(look)
      expect(twin ?? null, `${t.id} renders identically to ${twin}`).toBeNull()
      seen.set(look, t.id)
    }
  })

  test('rules no lines in any theme, and still washes some of them', async ({ page }) => {
    await themedWorld(page)

    let withWash = 0
    for (const t of APP_THEMES) {
      await applyTheme(page, themeClass(t.id))
      const value = await atmosphereOf(page)

      /*
        No straight edges of any kind — not a grid, not a hatch, not a single
        band. `repeating-linear-gradient` covers the first two and
        `linear-gradient` the third, and this catches both by substring.
      */
      expect(value, `${t.id} rules lines across the app`).not.toContain('linear-gradient(')
      // `white 0 1px, transparent 1.5px` at one position is a speck, not a star.
      expect(value, `${t.id}: isolated dot`).not.toMatch(/\b0 1px\b/)

      if (value.includes('radial-gradient(')) withWash++
    }

    /*
      The presence half. Banning every gradient would satisfy the assertions
      above while emptying the layer, so the soft washes that survived — the
      horror glow, romance's, noir's vignette — are held in place here.
    */
    expect(withWash, 'themes still carrying a soft wash').toBeGreaterThanOrEqual(3)
  })

  /**
   * Noir was the first theme to lose its bands and is the one with something
   * left to lose: a vignette rather than nothing. The rule above would be
   * satisfied by a noir with no atmosphere at all.
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
   * Reduced motion stops the timeline pulse in **every** theme.
   *
   * The stop used to be a hand-written list — the bare class, cyberpunk and
   * action — and a per-theme rhythm like `.theme-noir .tl-dot-active` outweighs
   * a bare `.tl-dot-active` on specificity. Noir and Romance had already been
   * left animating for anyone who asked for less motion, silently, because
   * nobody updated the list when their rhythms were added.
   *
   * A list cannot be trusted to keep up with a picker that grows, so the stop
   * is `!important` now and this walks all seventeen rather than the three
   * somebody remembered.
   */
  test('reduced motion stops the pulse in every theme', async ({ browser }) => {
    const page = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage()
    await themedWorld(page)

    for (const t of APP_THEMES) {
      await applyTheme(page, themeClass(t.id))
      const animation = await page.evaluate(() => {
        const probe = document.createElement('div')
        probe.className = 'tl-dot-active'
        document.body.appendChild(probe)
        const name = getComputedStyle(probe).animationName
        probe.remove()
        return name
      })
      expect(animation, `${t.id} keeps pulsing under reduced motion`).toBe('none')
    }
    await page.close()
  })

  /**
   * The presence half, and the reason the test above is not satisfied by an app
   * that simply never animates: with motion allowed, the dot pulses — and the
   * themes that were given their own tempo run at their own speed.
   */
  test('and with motion allowed each theme keeps its own tempo', async ({ page }) => {
    await themedWorld(page)

    const beat = async (id: string) => {
      await applyTheme(page, themeClass(id as never))
      return page.evaluate(() => {
        const probe = document.createElement('div')
        probe.className = 'tl-dot-active'
        document.body.appendChild(probe)
        const s = getComputedStyle(probe)
        const out = `${s.animationName} ${s.animationDuration}`
        probe.remove()
        return out
      })
    }

    // Slow, quick, and a different set of keyframes entirely.
    const noir = await beat('noir')
    const adventure = await beat('adventure')
    const dystopian = await beat('dystopian')

    for (const [id, v] of [['noir', noir], ['adventure', adventure], ['dystopian', dystopian]] as const) {
      expect(v, `${id} should animate`).not.toContain('none')
    }
    expect(noir).not.toBe(adventure)
    expect(dystopian.split(' ')[0]).not.toBe(noir.split(' ')[0])
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
      Noir, because a vignette is now the boldest thing this layer draws
      anywhere. It was cyberpunk's grid until the grids went, at which point
      this test started comparing a theme with no atmosphere against itself and
      failed on its own presence half — which is the check doing its job.

      A vignette reaches the corners rather than the middle, so the sampled
      strip below sits near the top-left where it actually bites.
    */
    await applyTheme(page, themeClass('noir'))
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
