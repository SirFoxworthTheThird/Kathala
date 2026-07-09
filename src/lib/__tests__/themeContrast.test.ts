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
  fantasy:   { background: [35, 30, 10],  card: [35, 28, 14],  mutedForeground: [35, 30, 58],  tlBg: [35, 32, 9],   tlTextMuted: [35, 28, 48] },
  scifi:     { background: [220, 60, 5],  card: [220, 55, 8],  mutedForeground: [210, 40, 55], tlBg: [220, 60, 6],  tlTextMuted: [210, 45, 50] },
  cyberpunk: { background: [270, 20, 6],  card: [270, 18, 10], mutedForeground: [280, 30, 58], tlBg: [270, 22, 5],  tlTextMuted: [280, 30, 55] },
  horror:    { background: [0, 15, 5],    card: [0, 12, 8],    mutedForeground: [0, 8, 52],    tlBg: [0, 18, 4],    tlTextMuted: [0, 10, 51] },
  western:   { background: [25, 35, 8],   card: [25, 32, 12],  mutedForeground: [30, 25, 52],  tlBg: [25, 38, 7],   tlTextMuted: [30, 26, 48] },
  action:    { background: [215, 14, 8],  card: [215, 13, 12], mutedForeground: [215, 10, 54], tlBg: [215, 14, 7],  tlTextMuted: [215, 10, 51] },
  noir:      { background: [0, 0, 7],     card: [0, 0, 11],    mutedForeground: [0, 0, 52],    tlBg: [0, 0, 6],     tlTextMuted: [0, 0, 49] },
  romance:   { background: [340, 18, 8],  card: [340, 16, 12], mutedForeground: [340, 16, 56], tlBg: [340, 18, 7],  tlTextMuted: [340, 16, 53] },
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
