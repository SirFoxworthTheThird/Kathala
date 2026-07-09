import { describe, it, expect } from 'vitest'
import { STORY_BEATS, beatById, beatLabel, beatActColor } from '@/lib/storyBeats'

describe('storyBeats', () => {
  it('exposes a three-act beat sheet in order', () => {
    expect(STORY_BEATS.map((b) => b.id)).toEqual([
      'hook', 'inciting-incident', 'plot-point-1', 'midpoint', 'plot-point-2', 'climax', 'resolution',
    ])
    // acts are non-decreasing across the sheet
    const acts = STORY_BEATS.map((b) => b.act)
    expect(acts).toEqual([...acts].sort((a, b) => a - b))
  })

  it('every beat carries a short label for tight annotations', () => {
    for (const b of STORY_BEATS) {
      expect(b.short.length).toBeGreaterThan(0)
      expect(b.short.length).toBeLessThanOrEqual(8)
    }
  })

  it('beatById resolves known ids and rejects unknown / null', () => {
    expect(beatById('midpoint')?.label).toBe('Midpoint')
    expect(beatById('nope')).toBeUndefined()
    expect(beatById(null)).toBeUndefined()
    expect(beatById(undefined)).toBeUndefined()
  })

  it('beatLabel falls back gracefully', () => {
    expect(beatLabel('climax')).toBe('Climax')
    expect(beatLabel(null)).toBe('None')
    expect(beatLabel('custom-id')).toBe('custom-id')
  })

  it('beatActColor returns a distinct hue per act', () => {
    const colors = new Set([beatActColor(1), beatActColor(2), beatActColor(3)])
    expect(colors.size).toBe(3)
  })
})
