import { describe, it, expect } from 'vitest'
import { snippet } from '@/lib/snippet'

/**
 * WRUN-11. Search subtitles were `description.slice(0, 60)` at nine call sites,
 * so they stopped wherever the sixtieth character fell — on the shipped
 * *Dracula*, *"…desired by three suitors and preyed u"*.
 */
describe('snippet', () => {
  it('leaves a short description alone', () => {
    expect(snippet('Mina’s closest friend.')).toBe('Mina’s closest friend.')
  })

  it('cuts at a word boundary and says it has been cut', () => {
    const text = 'Mina’s closest friend, desired by three suitors and preyed upon by the Count'
    const out = snippet(text)!
    expect(out.endsWith('…')).toBe(true)
    // The whole point: no half word before the ellipsis.
    expect(out).not.toMatch(/preyed u…$/)
    expect(text.startsWith(out.slice(0, -1))).toBe(true)
  })

  it('never exceeds the limit it was given', () => {
    // The ellipsis comes out of the budget, so a layout sized for 60 still fits.
    const long = 'word '.repeat(50)
    expect(snippet(long)!.length).toBeLessThanOrEqual(60)
    expect(snippet(long, 20)!.length).toBeLessThanOrEqual(20)
  })

  it('cuts a single over-long word where it must', () => {
    // No space to fall back to. A hard cut beats an empty subtitle.
    const out = snippet('a'.repeat(200), 10)!
    expect(out).toBe(`${'a'.repeat(9)}…`)
  })

  it('does not leave dangling punctuation before the ellipsis', () => {
    expect(snippet('The Count arrives, and the sea is very loud tonight indeed', 30))
      .not.toMatch(/[,\s]…$/)
  })

  it('treats empty and missing text as no subtitle at all', () => {
    // The call sites used a ternary for this; now it lives in one place.
    expect(snippet(undefined)).toBeUndefined()
    expect(snippet(null)).toBeUndefined()
    expect(snippet('')).toBeUndefined()
    expect(snippet('   ')).toBeUndefined()
  })

  it('trims before measuring, so padding does not eat the budget', () => {
    expect(snippet('   Mina.   ')).toBe('Mina.')
  })
})
