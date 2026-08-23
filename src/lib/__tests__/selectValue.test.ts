import { describe, it, expect } from 'vitest'

/**
 * Every `<Select>` says what its value is, even when that value is nothing.
 *
 * W23-6: a Radix `Select` with an `onValueChange` and no `value` keeps the last
 * pick as its own label. The "add another one" selects are all written that way
 * — pick *Ysolde Vane* to add her to a scene and the box beneath her new chip
 * also reads **Ysolde Vane**, so it looks as though she was added twice and the
 * add-someone affordance has vanished. Opening it lists everyone *except* her:
 * the value on the trigger is not in its own option list.
 *
 * The fix is one word, `value=""`, and it had already been applied in exactly
 * one place (`CharacterSnapshotPanel`) while twelve others went without — which
 * is the argument for a rule rather than twelve fixes.
 *
 * The rule is checkable because it needs no judgement about which selects are
 * "adders": a select that holds a value declares it, and one that holds nothing
 * declares that too. Making the empty case explicit is what stops it being
 * accidental.
 *
 * Read from source text through `import.meta.glob`, the same way the `.pwk`
 * catalogue tests read the library, so a component added next year is covered
 * without anyone adding it to a list.
 */

const sources = import.meta.glob('../../features/**/*.tsx', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

/** Opening `<Select …>` tags, brace-aware so `=>` inside a handler is not an end. */
function selectOpeningTags(source: string): string[] {
  const out: string[] = []
  const re = /<Select(?=[\s>])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    let depth = 0
    for (let i = re.lastIndex; i < source.length; i++) {
      const c = source[i]
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) { out.push(source.slice(m.index, i + 1)); break }
    }
  }
  return out
}

describe('every Select declares its value', () => {
  it('finds the Selects to check at all', () => {
    // Without this the rule below passes on an empty glob, which is how a
    // source-text test quietly stops testing anything.
    const total = Object.values(sources).reduce((n, s) => n + selectOpeningTags(s).length, 0)
    expect(Object.keys(sources).length).toBeGreaterThan(50)
    expect(total).toBeGreaterThan(10)
  })

  it('leaves none of them to keep the last pick as its label', () => {
    const offenders: string[] = []
    for (const [file, source] of Object.entries(sources)) {
      for (const tag of selectOpeningTags(source)) {
        if (/(?<![A-Za-z])value\s*=/.test(tag)) continue
        offenders.push(`${file.replace('../../', 'src/')} — ${tag.replace(/\s+/g, ' ').slice(0, 90)}`)
      }
    }
    expect(offenders, `add value="" to these:\n${offenders.join('\n')}`).toEqual([])
  })
})
