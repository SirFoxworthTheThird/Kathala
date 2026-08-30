import { describe, it, expect } from 'vitest'
import { arcColumnWidth, ARC_COLUMN_MAX } from '../arcColumnWidth'

const HEADER = 180

describe('arcColumnWidth', () => {
  it('shares the space out when the columns do not fill it', () => {
    // The measured case: 3 chapters in a 1440px main, 928px going spare.
    const w = arcColumnWidth({ containerWidth: 1440, rowHeaderWidth: HEADER, columnCount: 3, base: 110 })
    expect(w).toBeGreaterThan(110)
    expect(w).toBe(ARC_COLUMN_MAX)
  })

  it('gives every column somewhere to put "A Lamp in the Window"', () => {
    // 112px of text in a 93px box was the clipping the finding measured.
    const w = arcColumnWidth({ containerWidth: 1440, rowHeaderWidth: HEADER, columnCount: 8, base: 110 })
    expect(w).toBeGreaterThanOrEqual(112)
  })

  it('keeps the constant when the columns already overflow', () => {
    // A 117-chapter book scrolls, and wider columns would only mean more of it.
    expect(arcColumnWidth({ containerWidth: 1440, rowHeaderWidth: HEADER, columnCount: 117, base: 110 })).toBe(110)
  })

  it('never goes below the floor it was given', () => {
    for (const columnCount of [1, 5, 40, 117, 500]) {
      const w = arcColumnWidth({ containerWidth: 900, rowHeaderWidth: HEADER, columnCount, base: 100 })
      expect(w, `${columnCount} columns`).toBeGreaterThanOrEqual(100)
    }
  })

  it('caps a single column rather than making it a billboard', () => {
    expect(arcColumnWidth({ containerWidth: 3000, rowHeaderWidth: HEADER, columnCount: 1, base: 110 })).toBe(ARC_COLUMN_MAX)
  })

  it('falls back to the constant before it has been measured', () => {
    expect(arcColumnWidth({ containerWidth: 0, rowHeaderWidth: HEADER, columnCount: 3, base: 110 })).toBe(110)
  })

  it('survives a container narrower than its own name column', () => {
    expect(arcColumnWidth({ containerWidth: 120, rowHeaderWidth: HEADER, columnCount: 3, base: 100 })).toBe(100)
  })

  it('says nothing useful about no columns, and does not divide by zero', () => {
    expect(arcColumnWidth({ containerWidth: 1440, rowHeaderWidth: HEADER, columnCount: 0, base: 110 })).toBe(110)
  })
})
