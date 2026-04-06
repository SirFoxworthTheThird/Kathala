import { describe, it, expect } from 'vitest'
import { readingHoldMs, MIN_HOLD_MS } from '@/lib/playbackTiming'

// ── MIN_HOLD_MS constants ─────────────────────────────────────────────────────

describe('MIN_HOLD_MS', () => {
  it('slow is greater than normal', () => {
    expect(MIN_HOLD_MS.slow).toBeGreaterThan(MIN_HOLD_MS.normal)
  })

  it('normal is greater than fast', () => {
    expect(MIN_HOLD_MS.normal).toBeGreaterThan(MIN_HOLD_MS.fast)
  })
})

// ── readingHoldMs ─────────────────────────────────────────────────────────────

describe('readingHoldMs', () => {
  it('returns at least MIN_HOLD_MS for an empty string', () => {
    expect(readingHoldMs('', 'normal')).toBe(MIN_HOLD_MS.normal)
    expect(readingHoldMs('', 'slow')).toBe(MIN_HOLD_MS.slow)
    expect(readingHoldMs('', 'fast')).toBe(MIN_HOLD_MS.fast)
  })

  it('returns at least MIN_HOLD_MS for whitespace-only input', () => {
    expect(readingHoldMs('   \n\t  ', 'normal')).toBe(MIN_HOLD_MS.normal)
  })

  it('returns at least MIN_HOLD_MS for a very short text', () => {
    expect(readingHoldMs('Hello world', 'normal')).toBe(MIN_HOLD_MS.normal)
  })

  it('increases hold time for longer text', () => {
    const short = readingHoldMs('one two three', 'normal')
    // ~1800 words at 180 WPM = 10 minutes reading → well above MIN_HOLD_MS
    const longText = Array(1800).fill('word').join(' ')
    const long = readingHoldMs(longText, 'normal')
    expect(long).toBeGreaterThan(short)
  })

  it('slow speed gives longer hold than fast for the same text', () => {
    const text = Array(600).fill('word').join(' ')
    expect(readingHoldMs(text, 'slow')).toBeGreaterThan(readingHoldMs(text, 'fast'))
  })

  it('normal speed is between slow and fast for long text', () => {
    const text = Array(600).fill('word').join(' ')
    expect(readingHoldMs(text, 'normal')).toBeGreaterThan(readingHoldMs(text, 'fast'))
    expect(readingHoldMs(text, 'slow')).toBeGreaterThan(readingHoldMs(text, 'normal'))
  })

  it('result is always a positive integer (Math.ceil)', () => {
    const result = readingHoldMs('a b c', 'normal')
    expect(result).toBeGreaterThan(0)
    expect(Number.isInteger(result)).toBe(true)
  })

  it('counts only non-empty words (ignores extra spaces)', () => {
    const spaced = readingHoldMs('word   word   word', 'normal')
    const normal = readingHoldMs('word word word', 'normal')
    expect(spaced).toBe(normal)
  })
})
