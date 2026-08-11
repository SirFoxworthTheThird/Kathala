import { describe, it, expect } from 'vitest'
import { relativeTime } from '../relativeTime'

const NOW = new Date('2026-08-10T12:00:00Z').getTime()
const ago = (ms: number) => relativeTime(NOW - ms, NOW)

describe('relativeTime', () => {
  it('says "just now" under a minute', () => {
    expect(ago(0)).toBe('just now')
    expect(ago(59_000)).toBe('just now')
  })

  it('counts whole units elapsed rather than rounding up', () => {
    // The rounding copy said "1h ago" at 31 minutes, claiming more time had
    // passed than had.
    expect(ago(31 * 60_000)).toBe('31m ago')
    expect(ago(59 * 60_000)).toBe('59m ago')
    expect(ago(61 * 60_000)).toBe('1h ago')
  })

  it('steps minutes → hours → days', () => {
    expect(ago(60_000)).toBe('1m ago')
    expect(ago(3_600_000)).toBe('1h ago')
    expect(ago(86_400_000)).toBe('1d ago')
    expect(ago(6 * 86_400_000)).toBe('6d ago')
  })

  it('falls back to a date once "Nd ago" stops helping, and names the month', () => {
    // LORE-3. The old assertion compared the fallback against
    // `toLocaleDateString()` — the implementation against itself — so it would
    // have passed on `4/7/2026`, which is the seventh of April or the fourth of
    // July depending on the reader. What matters is that it cannot be read two
    // ways.
    const out = ago(8 * 86_400_000)
    expect(out, 'an all-numeric date is the ambiguity itself').not.toMatch(/^\d+[/.-]\d+[/.-]\d+$/)
    expect(out, 'the month should be a word').toMatch(/[A-Za-z]/)
    expect(out).toContain('2026')
  })

  it('does not run backwards for a timestamp in the future', () => {
    // Clock skew between devices is real, and "-3m ago" is nonsense.
    expect(relativeTime(NOW + 60_000, NOW)).toBe('just now')
  })
})
