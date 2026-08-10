import { describe, it, expect } from 'vitest'
import { STORY_BEATS, BEAT_TEMPLATES, beatById, beatLabel, beatActColor } from '@/lib/storyBeats'

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
    // The ceiling covers every template, not just the three-act sheet: they all
    // render through the same `<text>` on the pacing curve, and the longest one
    // shipping today is "Dark Night" at ten. The old bound of eight described
    // one sheet while its neighbours already exceeded it.
    for (const t of BEAT_TEMPLATES) {
      for (const b of t.beats) {
        expect(b.short.length, `${t.name}/${b.label}`).toBeGreaterThan(0)
        expect(b.short.length, `${t.name}/${b.label}`).toBeLessThanOrEqual(10)
      }
    }
  })

  it('a short label is still the beat, not another word (TL-6)', () => {
    // Each of these was a truncation that changed the sense: the verb where the
    // beat is a noun, or — for the Catalyst — three letters that read as the
    // name of the template it sits in.
    const shortOf = (id: string) => beatById(id)?.short
    expect(shortOf('inciting-incident')).toBe('Inciting')
    expect(shortOf('resolution')).toBe('Resolution')
    expect(shortOf('stc-catalyst')).toBe('Catalyst')
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
