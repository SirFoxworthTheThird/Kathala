import { describe, it, expect } from 'vitest'

/**
 * Guards the readability of muted secondary text across every theme. All themes
 * are dark variants; `--muted-foreground` carries most secondary copy (captions,
 * metadata, hints) and `--tl-text-muted` carries the timeline bar's labels. If a
 * palette edit pushes either below the WCAG AA threshold (4.5:1 for normal text)
 * against the surface it sits on, this test fails.
 *
 * The token values below MIRROR `src/index.css` — keep them in sync when a
 * theme's palette changes. (Vitest stubs CSS imports, so the stylesheet can't be
 * read at runtime here; this table is the checked-in contract.) The tougher
 * surface for `--muted-foreground` is `--card` (lighter than `--background` in
 * every theme), so clearing it clears both.
 */

type HSL = [number, number, number]

interface ThemeTokens {
  /** --background */
  background: HSL
  /** --card */
  card: HSL
  /** --muted-foreground */
  mutedForeground: HSL
  /** --tl-bg (approximated to an equivalent HSL where the source uses rgba) */
  tlBg: HSL
  /** --tl-text-muted */
  tlTextMuted: HSL
}

const THEMES: Record<string, ThemeTokens> = {
  default:   { background: [222, 47, 11], card: [222, 47, 14], mutedForeground: [215, 20, 65], tlBg: [222, 47, 9],  tlTextMuted: [215, 20, 52] },
  fantasy:   { background: [42, 24, 8],   card: [40, 22, 13],  mutedForeground: [40, 24, 63],  tlBg: [42, 27, 7],   tlTextMuted: [39, 22, 62] },
  scifi:     { background: [222, 52, 5],  card: [218, 45, 9],  mutedForeground: [203, 30, 63], tlBg: [222, 55, 4],  tlTextMuted: [199, 28, 62] },
  cyberpunk: { background: [266, 31, 6],  card: [264, 26, 11], mutedForeground: [275, 22, 66], tlBg: [266, 34, 5],  tlTextMuted: [278, 20, 66] },
  horror:    { background: [350, 13, 5],  card: [350, 11, 9],  mutedForeground: [25, 12, 62],   tlBg: [350, 15, 4],  tlTextMuted: [25, 11, 62] },
  western:   { background: [24, 34, 8],   card: [27, 31, 13],  mutedForeground: [34, 25, 63],  tlBg: [24, 38, 7],   tlTextMuted: [33, 22, 62] },
  action:    { background: [214, 18, 7],  card: [214, 17, 11], mutedForeground: [210, 10, 64], tlBg: [214, 18, 6],  tlTextMuted: [210, 9, 63] },
  noir:      { background: [45, 5, 6],    card: [45, 4, 11],   mutedForeground: [40, 8, 63],   tlBg: [45, 5, 5],    tlTextMuted: [40, 7, 62] },
  romance:   { background: [330, 20, 8],  card: [332, 18, 13], mutedForeground: [338, 18, 67], tlBg: [330, 21, 7],  tlTextMuted: [338, 17, 66] },
}

const AA_NORMAL = 4.5

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

function contrast(a: HSL, b: HSL): number {
  const l1 = relLuminance(hslToRgb(...a))
  const l2 = relLuminance(hslToRgb(...b))
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

describe('theme muted-text contrast', () => {
  it('covers the default plus the eight world themes', () => {
    expect(Object.keys(THEMES).length).toBe(9)
  })

  for (const [name, t] of Object.entries(THEMES)) {
    it(`${name}: --muted-foreground clears AA on --card and --background`, () => {
      expect(contrast(t.mutedForeground, t.card)).toBeGreaterThanOrEqual(AA_NORMAL)
      expect(contrast(t.mutedForeground, t.background)).toBeGreaterThanOrEqual(AA_NORMAL)
    })

    it(`${name}: --tl-text-muted clears AA on the timeline bar`, () => {
      expect(contrast(t.tlTextMuted, t.tlBg)).toBeGreaterThanOrEqual(AA_NORMAL)
    })
  }
})
