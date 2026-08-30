import { describe, it, expect } from 'vitest'
import { APP_THEMES, themeClass } from '@/lib/themes'

/*
  Read through Vite rather than `node:fs`: this project's tsconfig carries no
  node types, so a `node:fs` import runs happily under vitest and then fails
  `tsc -b` at build time — which is exactly how this file failed the first time.
*/
const FILES = import.meta.glob('../../../public/library/*.pwk', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

/**
 * Every theme a shipped book asks for must exist.
 *
 * Three did not. *Jane Eyre* carried `theme-gothic`, *The Moonstone*
 * `theme-mystery` and *The Odyssey* `theme-mythic`, and none of the three was
 * ever built — the class matched no rule, so those worlds fell back to Dark
 * Slate, and because the Settings picker matches on the exact class string, no
 * card showed as selected either. Nothing anywhere said so.
 *
 * A world's theme is a plain string on an imported record, so nothing type-checks
 * it. This does.
 */

const KNOWN = new Set(APP_THEMES.map((t) => themeClass(t.id)).filter((c): c is string => !!c))

function libraryThemes(): { book: string; theme: string | null }[] {
  return Object.entries(FILES).map(([path, text]) => {
    const world = (JSON.parse(text) as { world?: { theme?: string | null } }).world ?? {}
    return { book: path.split('/').pop()!.replace(/\.pwk$/, ''), theme: world.theme ?? null }
  })
}

describe('library themes', () => {
  it('names only themes the app actually has', () => {
    const unknown = libraryThemes()
      .filter((b) => b.theme !== null && !KNOWN.has(b.theme))
      .map((b) => `${b.book} → ${b.theme}`)
    expect(unknown, 'books asking for a theme that does not exist').toEqual([])
  })

  /**
   * The pair: a rule that simply found no themes anywhere would satisfy the
   * assertion above. Books do set themes, and more than one of them.
   */
  it('and the books do set themes', () => {
    const set = libraryThemes().filter((b) => b.theme !== null)
    expect(set.length).toBeGreaterThanOrEqual(15)
    expect(new Set(set.map((b) => b.theme)).size).toBeGreaterThanOrEqual(5)
  })
})
