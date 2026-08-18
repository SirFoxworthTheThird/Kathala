import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { APP_THEMES, themeClass } from '../src/lib/themes'

/**
 * The colours that carry *data* follow the theme.
 *
 * The tension ramp, the scene-status pills and the cast colours were all
 * hardcoded — a fixed blue→red sweep, five Tailwind-ish hex values, and
 * full-spectrum character hues — so Noir, a deliberately monochrome theme, drew
 * a rainbow pacing curve and a cast in every colour of the wheel. Every screen
 * stopped being themed at the moment real data appeared on it.
 *
 * These read the colours **out of the browser**, resolved: the values are built
 * with `calc()` inside `hsl()` from two hues a theme supplies, and nothing about
 * that is checkable from the source text.
 */

/** Resolve a list of CSS colour expressions against the themed root. */
const resolve = (page: Page, exprs: string[]) => page.evaluate((list) => {
  const probe = document.createElement('span')
  document.documentElement.appendChild(probe)
  const out = list.map((e) => {
    probe.style.color = ''
    probe.style.color = e
    return getComputedStyle(probe).color
  })
  probe.remove()
  return out
}, exprs)

const applyTheme = (page: Page, cls: string | null) => page.evaluate((c) => {
  const r = document.documentElement
  for (const n of Array.from(r.classList)) if (n.startsWith('theme-')) r.classList.remove(n)
  if (c) r.classList.add(c)
}, cls)

function rgb(s: string): [number, number, number] {
  const m = s.match(/-?[\d.]+/g)!
  return [Number(m[0]), Number(m[1]), Number(m[2])]
}

function luminance([r, g, b]: [number, number, number]): number {
  const c = [r, g, b].map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(rgb(a)), luminance(rgb(b))]
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

async function themedWorld(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Data Colour Probe')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//, { timeout: 30_000 })
}

const TENSION = ['var(--tension-1)', 'var(--tension-2)', 'var(--tension-3)', 'var(--tension-4)', 'var(--tension-5)']
const STATUS = ['var(--status-1)', 'var(--status-2)', 'var(--status-3)', 'var(--status-4)', 'var(--status-5)']

test.describe('Data colours follow the theme', () => {
  test.describe.configure({ timeout: 300_000 })

  test('every theme resolves five distinct tension steps and five distinct pills', async ({ page }) => {
    await themedWorld(page)

    for (const t of APP_THEMES) {
      await applyTheme(page, themeClass(t.id))
      const tension = await resolve(page, TENSION)
      const status = await resolve(page, STATUS)

      // A ramp collapsed to one colour says nothing about level or progress,
      // and `calc()` inside `hsl()` failing resolves to exactly that.
      expect(new Set(tension).size, `${t.id}: tension steps`).toBe(5)
      expect(new Set(status).size, `${t.id}: status steps`).toBe(5)
      for (const c of [...tension, ...status]) {
        expect(c, `${t.id} left a colour unresolved`).toMatch(/^rgba?\(/)
      }
    }
  })

  test('the status ink is legible on all five pills, in all sixteen themes', async ({ page }) => {
    await themedWorld(page)

    for (const t of APP_THEMES) {
      await applyTheme(page, themeClass(t.id))
      const [ink] = await resolve(page, ['hsl(var(--status-ink))'])
      const pills = await resolve(page, STATUS)

      // The claim the unit test used to make about `#1f2937`, measured instead
      // of asserted — on every step of every theme.
      for (const [i, pill] of pills.entries()) {
        expect(contrast(ink, pill), `${t.id} status ${i + 1}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  /**
   * The manuscript is set in the theme's face.
   *
   * `ManuscriptView`, `SceneDraftEditor` and Focus mode all hardcoded
   * Tailwind's `font-serif`, so a theme dressed the chrome and stopped at the
   * page — sixteen themes, one generic serif for the writer's own words.
   */
  test('the prose face follows the theme, and the sans-led themes still read', async ({ page }) => {
    await themedWorld(page)

    const proseOf = () => page.evaluate(() => {
      const probe = document.createElement('span')
      probe.style.fontFamily = 'var(--font-prose)'
      document.documentElement.appendChild(probe)
      const f = getComputedStyle(probe).fontFamily
      probe.remove()
      return f
    })

    await applyTheme(page, themeClass('noir'))
    const noir = await proseOf()
    await applyTheme(page, themeClass('gothic'))
    const gothic = await proseOf()

    // Noir's manuscript is a typewriter; Gothic's is a book face. Before this
    // they were the same string.
    expect(noir).not.toBe(gothic)
    expect(noir.toLowerCase()).toContain('courier')

    /*
      And the presence half, which is the restraint rather than the feature: a
      theme whose *body* face is a UI sans does not drag the manuscript into it.
      Cosy is set in Verdana and its prose must still be a serif.
    */
    await applyTheme(page, themeClass('cosy'))
    const cosy = await proseOf()
    expect(cosy.toLowerCase()).toMatch(/serif|georgia/)
    expect(cosy.toLowerCase()).not.toContain('verdana')
  })

  /**
   * The pair to the two above: a theme may mute its ramps, but the cast is an
   * identifier. Two characters the same shade is a bug, not a mood — so no
   * theme is allowed to flatten the cast into uniformity.
   */
  test('no theme flattens the cast into one colour', async ({ page }) => {
    await themedWorld(page)
    // Hues an id hash actually produces, spread across the wheel.
    const cast = [10, 80, 150, 220, 290].map((h) => `hsl(${h} var(--cast-sat) var(--cast-light))`)

    for (const t of APP_THEMES) {
      await applyTheme(page, themeClass(t.id))
      const colours = await resolve(page, cast)
      expect(new Set(colours).size, `${t.id}: cast colours`).toBe(5)

      // And far enough apart to tell people apart at a glance, not merely
      // different in the last digit.
      const spread = Math.max(...colours.map((c) => luminance(rgb(c)))) -
        Math.min(...colours.map((c) => luminance(rgb(c))))
      expect(spread, `${t.id}: cast is nearly monochrome`).toBeGreaterThan(0.02)
    }
  })
})
