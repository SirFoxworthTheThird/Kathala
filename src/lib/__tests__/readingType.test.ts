import { describe, it, expect } from 'vitest'
import {
  TEXT_SIZES, LEADINGS, DEFAULT_READING_TYPE,
  stepSize, typeStyle, coerceReadingType,
} from '../readingType'

describe('the default setting', () => {
  it('is the appearance the screen already had, so nobody is surprised', () => {
    // 15px and leading-relaxed are what ManuscriptView hard-coded before a
    // reader could choose. Changing what everyone sees is a separate decision
    // from letting them change it themselves.
    expect(DEFAULT_READING_TYPE).toEqual({ size: 15, leading: 'relaxed', face: 'book' })
    expect(TEXT_SIZES[0]).toBe(15)
    expect(LEADINGS.relaxed).toBe(1.625)
  })
})

describe('stepSize', () => {
  it('moves up and down the ladder', () => {
    expect(stepSize(15, 1)).toBe(17)
    expect(stepSize(19, -1)).toBe(17)
  })

  it('stops at both ends rather than running off them', () => {
    expect(stepSize(TEXT_SIZES[0], -1)).toBe(TEXT_SIZES[0])
    expect(stepSize(TEXT_SIZES[TEXT_SIZES.length - 1], 1)).toBe(TEXT_SIZES[TEXT_SIZES.length - 1])
  })

  it('steps from the nearest offered size when the stored one is not on the ladder', () => {
    // A value left by an older build, or edited by hand. Snapping to the
    // nearest rung and moving keeps the buttons working; matching exactly would
    // leave the reader pressing a button that does nothing.
    //
    // 16 sits exactly between 15 and 17, and the tie goes to the smaller — so
    // stepping up from it lands on 17 rather than skipping to 19. That is the
    // behaviour a reader would expect from a size they are standing on.
    expect(stepSize(16, 1)).toBe(17)
    expect(stepSize(16, -1)).toBe(15)
    expect(stepSize(400, -1)).toBe(22)
  })
})

describe('typeStyle', () => {
  it('sets the size and leading the reader chose', () => {
    expect(typeStyle({ size: 22, leading: 'airy', face: 'book' }))
      .toEqual({ fontSize: '22px', lineHeight: 1.9, fontFamily: 'var(--font-prose)' })
  })

  it("keeps the theme's own face by default, and lets the reader overrule it", () => {
    // Several themes override --font-prose; which face a gothic world is set in
    // is the world author's decision. Choosing sans is the reader's.
    expect(typeStyle({ ...DEFAULT_READING_TYPE, face: 'book' }).fontFamily).toBe('var(--font-prose)')
    const sans = typeStyle({ ...DEFAULT_READING_TYPE, face: 'sans' }).fontFamily
    expect(sans).not.toContain('--font-prose')
    expect(sans).toContain('sans-serif')
  })

  it('falls back to a usable leading rather than an undefined one', () => {
    // A stored leading from a build that named them differently would otherwise
    // reach CSS as `line-height: undefined` and collapse the column.
    const style = typeStyle({ size: 17, leading: 'nonesuch' as never, face: 'book' })
    expect(style.lineHeight).toBe(LEADINGS.relaxed)
  })
})

describe('coerceReadingType', () => {
  it('accepts a whole stored preference', () => {
    const t = { size: 19, leading: 'airy' as const, face: 'sans' as const }
    expect(coerceReadingType(t)).toEqual(t)
  })

  it('fills in the default for anything missing or unknown', () => {
    expect(coerceReadingType(undefined)).toEqual(DEFAULT_READING_TYPE)
    expect(coerceReadingType({})).toEqual(DEFAULT_READING_TYPE)
    expect(coerceReadingType({ face: 'comic' })).toEqual(DEFAULT_READING_TYPE)
    expect(coerceReadingType({ leading: 'huge' })).toEqual(DEFAULT_READING_TYPE)
  })

  it('keeps the fields it understands when another is spoiled', () => {
    // Field by field, because a reader who set the largest type and nothing
    // else should not lose it to an unrelated key going bad.
    expect(coerceReadingType({ size: 26, leading: 'huge' }))
      .toEqual({ size: 26, leading: 'relaxed', face: 'book' })
  })

  it('clamps a size off the end of the ladder into it', () => {
    expect(coerceReadingType({ size: 9999 }).size).toBe(TEXT_SIZES[TEXT_SIZES.length - 1])
    expect(coerceReadingType({ size: -4 }).size).toBe(TEXT_SIZES[0])
    expect(coerceReadingType({ size: Number.NaN }).size).toBe(DEFAULT_READING_TYPE.size)
  })
})
