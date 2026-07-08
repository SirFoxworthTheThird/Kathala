import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Read the stylesheet as raw bytes (no Vite/PostCSS transform) so we assert on
// exactly the source declarations that ship. Vitest runs from the repo root.
const cssRaw = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

/**
 * Guards the readability of muted secondary text across every theme. All themes
 * are dark variants, and `--muted-foreground` is the workhorse token for
 * secondary copy (captions, metadata, hints). If a future palette edit darkens
 * it below the WCAG AA threshold (4.5:1 for normal text) against the surfaces it
 * sits on, this test fails. The tougher surface is `--card` (lighter than
 * `--background` in every theme), so clearing it clears both.
 */

const AA_NORMAL = 4.5

/** Parse a bare Tailwind-style HSL triple "H S% L%" into [h, s, l]. */
function parseHsl(triple: string): [number, number, number] {
  const m = triple.trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/)
  if (!m) throw new Error(`Not a bare HSL triple: "${triple}"`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255)) as [number, number, number]
}

function relLuminance([r, g, b]: [number, number, number]): number {
  const c = [r, g, b].map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const l1 = relLuminance(hslToRgb(...a))
  const l2 = relLuminance(hslToRgb(...b))
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Split index.css into theme blocks keyed by selector, merging repeated blocks
 * (e.g. `:root` appears once for colors and once for timeline vars) so later
 * declarations win, mirroring the CSS cascade. Returns each theme's resolved
 * custom-property map.
 */
function themeVars(): Map<string, Record<string, string>> {
  const themes = new Map<string, Record<string, string>>()
  const blockRe = /(:root|\.theme-[\w-]+)\s*\{([^}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(cssRaw))) {
    const selector = m[1]
    const body = m[2]
    const vars = themes.get(selector) ?? {}
    const declRe = /(--[\w-]+)\s*:\s*([^;]+);/g
    let d: RegExpExecArray | null
    while ((d = declRe.exec(body))) {
      vars[d[1]] = d[2].trim()
    }
    themes.set(selector, vars)
  }
  return themes
}

describe('theme muted-text contrast', () => {
  const themes = themeVars()

  it('parses every theme block, including the default :root', () => {
    expect(themes.has(':root')).toBe(true)
    // The default (:root) plus the eight world themes.
    expect(themes.size).toBeGreaterThanOrEqual(9)
  })

  for (const [selector, vars] of themeVars()) {
    const mf = vars['--muted-foreground']
    const card = vars['--card']
    const bg = vars['--background']
    if (!mf || !card || !bg) continue // timeline-only blocks carry no color surface

    it(`${selector}: --muted-foreground clears AA on --card and --background`, () => {
      const fg = parseHsl(mf)
      expect(contrast(fg, parseHsl(card))).toBeGreaterThanOrEqual(AA_NORMAL)
      expect(contrast(fg, parseHsl(bg))).toBeGreaterThanOrEqual(AA_NORMAL)
    })
  }
})
