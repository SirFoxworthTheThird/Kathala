import { describe, it, expect } from 'vitest'
import { splitParagraphs } from '@/lib/manuscriptParagraphs'

/**
 * W23-8. A **blank line** starts a new paragraph; a single newline does not.
 *
 * The rule is deliberate — prose pasted from a text file or a PDF arrives
 * hard-wrapped at some column, and treating every newline as a break would turn
 * a pasted chapter into one paragraph per line. What was wrong is that it was
 * stated nowhere, so a writer typing one Enter between paragraphs found out on
 * reading their own book back, or on exporting it.
 *
 * It lived as `text.split(/\n\s*\n/)` written out three times — the Manuscript,
 * the compiler and the exporter — each free to drift from the others. One
 * function now, and the scene editor's paragraph count uses it too, so the
 * number shown while typing is produced by the split that will make the pages.
 */
describe('splitParagraphs', () => {
  it('joins lines separated by a single newline', () => {
    // The reported case, verbatim.
    expect(splitParagraphs('One line.\nSecond line, one Enter.'))
      .toEqual(['One line.\nSecond line, one Enter.'])
  })

  it('splits on a blank line', () => {
    expect(splitParagraphs('First.\n\nSecond.')).toEqual(['First.', 'Second.'])
  })

  it('treats a line of whitespace as blank', () => {
    expect(splitParagraphs('First.\n   \nSecond.')).toEqual(['First.', 'Second.'])
  })

  it('splits on a run of blank lines exactly once', () => {
    expect(splitParagraphs('First.\n\n\n\nSecond.')).toEqual(['First.', 'Second.'])
  })

  it('trims each paragraph and drops empty ones', () => {
    expect(splitParagraphs('\n\n  Only one.  \n\n')).toEqual(['Only one.'])
  })

  it('has nothing to say about nothing', () => {
    expect(splitParagraphs('')).toEqual([])
    expect(splitParagraphs('   \n \n  ')).toEqual([])
  })

  it('keeps a hard-wrapped paste as one paragraph, which is the point', () => {
    const pasted = 'It is a truth universally acknowledged,\nthat a single man in possession\nof a good fortune, must be in want of a wife.'
    expect(splitParagraphs(pasted)).toHaveLength(1)
  })
})
