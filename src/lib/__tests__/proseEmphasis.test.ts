import { describe, it, expect } from 'vitest'
import { emphasisSpans, emphasisMarkup } from '@/lib/proseEmphasis'
import { splitParagraphs } from '@/lib/manuscriptParagraphs'

const em = (text: string) => emphasisSpans(text).filter((s) => s.em).map((s) => s.text)
const flat = (text: string) => emphasisSpans(text).map((s) => s.text).join('')

describe('emphasisSpans', () => {
  it('reads the forms the corpus actually uses', () => {
    expect(em('he was _very_ cross')).toEqual(['very'])
    expect(em('_I_')).toEqual(['I'])                       // one character
    expect(em('_Kept in shorthand._')).toEqual(['Kept in shorthand.'])
    expect(em('a _soupçon_ of scandal')).toEqual(['soupçon'])   // non-ASCII inside
    expect(em('the _Pall Mall_ and the _Times_')).toEqual(['Pall Mall', 'Times'])
  })

  it('leaves the text alone apart from the delimiters it consumed', () => {
    expect(flat('he was _very_ cross')).toBe('he was very cross')
    expect(flat('nothing to see here')).toBe('nothing to see here')
    // An unmatched underscore is prose and survives intact.
    expect(flat('a lone _ underscore')).toBe('a lone _ underscore')
  })

  it('does not treat an underscore inside a word as a delimiter', () => {
    // The rule that protects snake_case, and Dracula's chemistry with it.
    expect(em('snake_case_name')).toEqual([])
    expect(em('C_{2}HCl_{3}O. H_{2}O!')).toEqual([])
    expect(flat('C_{2}HCl_{3}O. H_{2}O!')).toBe('C_{2}HCl_{3}O. H_{2}O!')
    // Its documented cost: Gutenberg's intraword italics stay literal.
    expect(em('on the 21_st_ of May')).toEqual([])
  })

  it('refuses the openers and closers that would swallow prose', () => {
    expect(em('a _ b _ c')).toEqual([])            // space after the opener
    expect(em('half-open _like this')).toEqual([]) // never closed
    expect(em('__')).toEqual([])                   // empty
    expect(em('_ _')).toEqual([])
    // A closer may not have a space before it, or a word character after it —
    // the two halves of CommonMark's flanking rule, each on its own case.
    expect(em('_trailing space _ here')).toEqual([])
    expect(em('_a._b')).toEqual([])
    // Across a line, which is where a runaway would do the most damage.
    expect(em('_open here\nand close there_')).toEqual([])
    expect(flat('_open here\nand close there_')).toBe('_open here\nand close there_')
  })

  it('never reorders or duplicates, whatever the input', () => {
    const cases = [
      '_a_ _b_ _c_', 'x_y_z', '_a__b_', '____', '_', '', 'a _b_ c _d',
      '“_Un_important”', '_my_self', 'plain', '_“quoted italics”_',
    ]
    for (const c of cases) {
      expect(flat(c).replace(/_/g, ''), c).toBe(c.replace(/_/g, ''))
      expect(emphasisSpans(c).every((s) => s.text.length > 0), c).toBe(true)
    }
  })
})

describe('emphasisMarkup', () => {
  it('escapes the text and not the tags', () => {
    expect(emphasisMarkup('a _<b>_ c', (s) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;')))
      .toBe('a <em>&lt;b&gt;</em> c')
  })

  it('cannot be tricked into emitting markup from the prose', () => {
    // The escaper runs on every span, emphasised or not — the point of parsing
    // before escaping rather than replacing underscores in escaped output.
    const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    expect(emphasisMarkup('_<script>alert(1)</script>_', escape))
      .toBe('<em>&lt;script>alert(1)&lt;/script></em>')
  })
})

/**
 * The real books, not invented sentences.
 *
 * Two of the four checked-in fixtures carry Gutenberg italics; the other two
 * carry none, which is itself worth asserting — a parser that found emphasis in
 * *Neuromancer* would be inventing it.
 *
 * The counts are measured, not guessed, and they are here rather than in a
 * comment so they go red when they stop being true.
 */
describe('the shipped fixtures', () => {
  // The same `?raw` glob `exampleCompat` uses. Reading them with `node:fs`
  // ran green under Vitest and failed `tsc -b`, which is the shape of spec that
  // breaks a build minutes after it looked fine.
  const files = import.meta.glob('../../test/fixtures/worlds/*.pwk', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>

  const named = (name: string): string => {
    const hit = Object.entries(files).find(([path]) => path.endsWith(name))
    if (!hit) throw new Error(`no fixture named ${name}`)
    return hit[1]
  }

  const prose = (json: string): string[] => {
    const parsed = JSON.parse(json) as { sceneTexts?: { text?: unknown }[] }
    return (parsed.sceneTexts ?? [])
      .map((t) => t.text)
      .filter((t): t is string => typeof t === 'string')
  }
  const countIn = (name: string) =>
    prose(named(name)).reduce((n, text) => n + em(text).length, 0)

  it('found the fixtures at all', () => {
    expect(Object.keys(files).length).toBe(4)
  })

  it('finds the emphasis that is there', () => {
    expect(countIn('v11-the-prisoner-of-zenda.pwk')).toBe(17)
    expect(countIn('v7-strange-case-of-dr-jekyll-and-mr-hyde.pwk')).toBe(9)
  })

  it('finds none where there is none', () => {
    expect(countIn('v16-neuromancer.pwk')).toBe(0)
    expect(countIn('v18-harry-potter-and-the-philosopher-s-stone.pwk')).toBe(0)
  })

  it('never loses a character of any book', () => {
    for (const [file, json] of Object.entries(files)) {
      for (const text of prose(json)) {
        expect(flat(text).replace(/_/g, ''), file).toBe(text.replace(/_/g, ''))
      }
    }
  })

  it('reads the same paragraph by paragraph as it does whole', () => {
    /*
      The renderer splits into paragraphs first, so if any italic run crossed a
      blank line it would be found whole here and broken on screen. None does,
      in any shipped book — which is what lets `findCloser` stop at a newline.
    */
    for (const [file, json] of Object.entries(files)) {
      for (const text of prose(json)) {
        const whole = em(text)
        const byPara = splitParagraphs(text).flatMap((p) => em(p))
        expect(byPara, file).toEqual(whole)
      }
    }
  })
})
