import { describe, it, expect } from 'vitest'

/**
 * N10, from a blind writer run: the app's most-used editing form — Character →
 * Current State — was measured live in the DOM, and every control in it had
 * `id: null`, `aria-label: null`, `aria-labelledby: null` and no wrapping
 * `<label>`. A screen reader announced the location picker as an unnamed
 * collapsed button. The Add Location dialog was the same, to the point where
 * clicking "Name (required)" did not focus the field beside it.
 *
 * The count across the source was 84 `<Label>` without `htmlFor` in 15 files —
 * concentrated in the editing panels, and *not* app-wide: the Timeline screen
 * measured 117 controls with none unnamed.
 *
 * A `<label>` that names nothing is worse than a heading that names nothing: it
 * tells a screen reader a control is coming and then does not produce one. So
 * the rule is that a `<Label>` must say what it labels — either by taking a
 * `htmlFor` of its own, or by being a `<Field>`, which mints the id and puts it
 * on the control for you. Where the thing being named is not a single control —
 * a read-only value, a row of buttons — `<FieldName>` renders the same text
 * without claiming to be a label.
 *
 * The DOM half of this is `e2e/fieldLabels.spec.ts`; source scanning cannot
 * tell whether an id actually reaches a control.
 */

const sources = import.meta.glob('../../**/*.tsx', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

/** Opening `<Label …>` tags, with their attributes. */
function labelTags(src: string): string[] {
  return [...src.matchAll(/<Label(\s[^>]*?)?>/g)].map((m) => m[1] ?? '')
}

describe('a Label says what it labels', () => {
  it('finds the Labels, so the rule below is not looking at an empty set', () => {
    // Vacuity guard: if the glob or the regex broke, every file would pass.
    const total = Object.values(sources).reduce((n, src) => n + labelTags(src).length, 0)
    expect(total).toBeGreaterThan(10)
  })

  it('has no Label without an htmlFor left anywhere', () => {
    const offenders: string[] = []
    for (const [path, src] of Object.entries(sources)) {
      for (const attrs of labelTags(src)) {
        if (!/\bhtmlFor\b/.test(attrs)) offenders.push(`${path}: <Label${attrs}>`)
      }
    }
    expect(offenders).toEqual([])
  })
})
