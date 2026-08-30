import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/**
 * W19-10. **A timeline's stored colour is an identity mark, not ink.**
 *
 * The chapter bar painted the active scene's title in whatever colour the
 * timeline carried — `#6366f1`, hardcoded by the first-run wizard and by the
 * spec and sequel importers, so every world in the library has it. On the
 * **Paper** theme that measures **3.89:1** against the card at 12.16px, where
 * 4.5 is the bar for text that size; it was the only sub-AA text found on four
 * screens. The timeline label above it (8.64px) and the stacked-view badges
 * (7.68px) had the same fault and were smaller still.
 *
 * It is not a Paper problem and no per-theme value would have fixed it: the
 * colour comes from the writer and the ground comes from the theme, and nothing
 * was checking the pair. So the text takes the bar's own ink and the colour
 * moves to a dot, where 3:1 is the bar rather than 4.5.
 *
 * Measured in the browser, resolved — the tokens are per-theme and none of this
 * is checkable from the source text. The presence half is in the same test: the
 * colour must still be *on* the bar, or "no coloured text" would be satisfied
 * by a bar that had stopped using the timeline's colour at all.
 */

const THEME_COLOUR = 'rgb(99, 102, 241)' // #6366f1, the shipped default

async function barInPaper(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Contrast World')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]

  /*
    The timeline is seeded rather than created through the Timeline screen,
    because that screen picks from `TIMELINE_COLORS` and the colour this finding
    is about is the one the **first-run wizard** writes — `#6366f1`, also
    written by the spec importer and the sequel builder, so every world in the
    library carries it. Creating one through the screen made this test pass on
    the unfixed code, which is the shape of a test that protects nothing.
  */
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({
      id: 'tl1', worldId: id, name: 'Main Timeline', description: '',
      color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now,
    })
  }, worldId)

  await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('button', { name: 'Add Chapter' }).first().click()
  await page.getByPlaceholder('Chapter title').fill('The Drowning Year')
  await page.getByRole('button', { name: 'Add Chapter' }).last().click()
  await page.getByTitle('Open chapter detail').first().click()
  await page.getByRole('main').getByRole('button', { name: 'Add Scene' }).first().click()
  await page.getByPlaceholder('Scene title').fill('A letter under the door')
  await page.getByRole('button', { name: 'Add Scene' }).last().click()

  // Paper is the light theme, and the only ground this failed on.
  await page.evaluate(() => {
    const r = document.documentElement
    for (const n of Array.from(r.classList)) if (n.startsWith('theme-')) r.classList.remove(n)
    r.classList.add('theme-paper')
  })
  // Both the theme swap and the active segment animate on a 0.2s curve, and a
  // measurement taken mid-transition is of a real but momentary colour. Settle
  // well past both.
  await page.waitForTimeout(1500)
  await expect(page.locator('[data-chapter-bar]').first()).toBeVisible()
  return worldId
}

/** Every text node in the chapter bar, with its colour, size, weight and ground. */
const textInBar = (page: Page) => page.evaluate(() => {
  /*
    Normalise every colour through a canvas rather than parsing the string.

    Three notations turned up here in one sitting and each one broke a hand-
    written parser differently: plain `rgb(233, 231, 234)`, `color(srgb 0.915
    0.905 0.915)` from `color-mix()`, and — mid-transition — `oklab(0.930031
    0.00378686 -0.0026055 / 0.997553)`. The first two are 0-255 and 0-1; reading
    the third's components as bytes made a near-white ground measure as
    near-black and failed the run at 1.40:1. `fillStyle` accepts every CSS
    colour there is and `getImageData` hands back sRGB, so there is nothing left
    to get wrong.
  */
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  function toRgb(value: string): string {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000'
    ctx.fillStyle = value
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return `rgb(${r}, ${g}, ${b})`
  }

  function isOpaque(bg: string): boolean {
    if (bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return false
    // The alpha is the one component `toRgb` throws away, so it is read here:
    // the slash form covers `color()`/`oklab()`, the fourth number covers rgba.
    const slash = /\/\s*([\d.]+)\s*\)/.exec(bg)
    if (slash) return Number(slash[1]) > 0.99
    const m = bg.match(/-?[\d.]+/g)
    return !m || m.length < 4 || Number(m[3]) > 0.99
  }

  function groundOf(el: Element): string {
    let n: Element | null = el
    while (n) {
      const bg = getComputedStyle(n).backgroundColor
      if (isOpaque(bg)) return toRgb(bg)
      n = n.parentElement
    }
    return 'rgb(255, 255, 255)'
  }
  const bar = document.querySelector('[data-chapter-bar]')!
  const out: Array<{ text: string; color: string; ground: string; px: number; weight: number }> = []
  const walk = document.createTreeWalker(bar, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walk.nextNode())) {
    const text = (node.textContent ?? '').trim()
    if (!text) continue
    const el = node.parentElement
    if (!el) continue
    const cs = getComputedStyle(el)
    out.push({
      text, color: toRgb(cs.color), ground: groundOf(el),
      px: parseFloat(cs.fontSize), weight: Number(cs.fontWeight) || 400,
    })
  }
  return out
})

/** Whether the timeline's colour is still painted somewhere as a mark. */
const colourAsMark = (page: Page, want: string) => page.evaluate((c) => {
  const bar = document.querySelector('[data-chapter-bar]')!
  return Array.from(bar.querySelectorAll('*')).some((el) => {
    const cs = getComputedStyle(el)
    return cs.backgroundColor === c || cs.fill === c || cs.borderTopColor === c
  })
}, want)

/*
  Two notations, and getting this wrong hid a real failure. `color-mix()`
  resolves to `color(srgb 0.915 0.905 0.915)` — components in 0–1 — while
  everything else comes back as `rgb(233, 231, 234)`. Reading the floats as
  0–255 made a near-white ground measure as near-black, and the scrubber's
  chapter label scored 4.68 when it was really 3.63.
*/
/** Everything crossing this boundary is already `rgb(r, g, b)` — see `toRgb`. */
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

test.describe('The chapter bar on a light ground', () => {
  test.describe.configure({ timeout: 180_000 })

  test('reads at AA, and still shows the timeline colour as a mark', async ({ page }) => {
    await barInPaper(page)

    const nodes = await textInBar(page)
    // If this is empty the walk found nothing and every assertion below is
    // vacuous — the bar always carries at least the chapter and the scene.
    expect(nodes.length).toBeGreaterThan(1)

    const failures = nodes
      .map((n) => ({ ...n, ratio: contrast(n.color, n.ground) }))
      // WCAG "large text": 24px, or 18.66px at 700+.
      .filter((n) => n.ratio < (n.px >= 24 || (n.px >= 18.66 && n.weight >= 700) ? 3 : 4.5))
      .map((n) => `${JSON.stringify(n.text)} ${n.px}px/${n.weight} ${n.color} on ${n.ground} = ${n.ratio.toFixed(2)}`)

    expect(failures, `sub-AA text in the chapter bar:\n${failures.join('\n')}`).toEqual([])

    // The scene title specifically — the node that was measured at 3.89:1.
    const title = nodes.find((n) => n.text === 'A letter under the door')
    expect(title, 'the active scene title is in the bar').toBeDefined()
    expect(title!.color).not.toBe(THEME_COLOUR)

    // The presence half: the colour did not simply leave the bar.
    expect(await colourAsMark(page, THEME_COLOUR)).toBe(true)
  })
})
