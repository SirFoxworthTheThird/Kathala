import { describe, it, expect } from 'vitest'
import { computePacingCurve, tensionColor, tensionLabel, TENSION_LEVELS } from '@/lib/tension'
import type { WorldEvent, Chapter } from '@/types'

function chapter(id: string, number: number): Chapter {
  return { id, worldId: 'w', timelineId: 't1', number, title: '', synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }
}
function event(
  id: string,
  chapterId: string,
  sortOrder: number,
  tension: number | null,
  extra: Partial<WorldEvent> = {},
): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: 't1', title: id, description: '',
    locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], threadIds: [], involvedItemIds: [], tags: [], sortOrder,
    travelDays: null, inWorldTime: null, tension, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false,
    createdAt: 0, updatedAt: 0, ...extra,
  }
}

const chapters = [chapter('c1', 1), chapter('c2', 2)]

describe('tensionLabel / tensionColor', () => {
  it('labels each level and unrated', () => {
    expect(tensionLabel(null)).toBe('Unrated')
    expect(tensionLabel(1)).toBe('Calm')
    expect(tensionLabel(5)).toBe('Climactic')
  })

  it('names a step of the theme ramp rather than a colour of its own', () => {
    expect(tensionColor(null)).toContain('--muted-foreground')
    /*
      The hues used to be written here — 210 for calm, 0 for climactic —
      whatever theme the app was wearing, which is why Noir drew a rainbow.
      The ramp is the theme's now; what this function owes is a step, one per
      level, in order. The colours those steps resolve to are measured in the
      browser by `themeDataColour.spec.ts`, across all sixteen themes.
    */
    expect(tensionColor(1)).toBe('var(--tension-1)')
    expect(tensionColor(5)).toBe('var(--tension-5)')
    expect([1, 2, 3, 4, 5].map((l) => tensionColor(l)))
      .toEqual(['var(--tension-1)', 'var(--tension-2)', 'var(--tension-3)', 'var(--tension-4)', 'var(--tension-5)'])
  })

  it('clamps a level from outside the scale onto an end of the ramp', () => {
    // `.pwk` files are hand-written and AI-generated; a 0 or a 9 must not
    // produce `var(--tension-0)`, which resolves to nothing at all.
    expect(tensionColor(0)).toBe('var(--tension-1)')
    expect(tensionColor(9)).toBe('var(--tension-5)')
    expect(tensionColor(3.4)).toBe('var(--tension-3)')
  })

  it('exposes exactly five rateable levels', () => {
    expect(TENSION_LEVELS).toEqual([1, 2, 3, 4, 5])
  })
})

describe('computePacingCurve', () => {
  it('orders points by narrative position and keeps unrated as null', () => {
    const events = [
      event('e2', 'c1', 1, null),
      event('e1', 'c1', 0, 3),
      event('e3', 'c2', 0, 5, { structureBeat: 'climax' }),
    ]
    const pts = computePacingCurve({ events, chapters, order: 'narrative' })
    expect(pts.map((p) => p.eventId)).toEqual(['e1', 'e2', 'e3'])
    expect(pts.map((p) => p.tension)).toEqual([3, null, 5])
    expect(pts[2].chapterNumber).toBe(2)
    expect(pts[2].structureBeat).toBe('climax')
    expect(pts[0].structureBeat).toBeNull()
  })

  it('orders by in-world day in chronological mode', () => {
    // e1 in ch1 but happens later in-world; e2 in ch2 but earlier in-world.
    const events = [
      event('e1', 'c1', 0, 2, { inWorldTime: 10 }),
      event('e2', 'c2', 0, 4, { inWorldTime: 1 }),
    ]
    const inWorldDayByEvent = new Map([['e1', 10], ['e2', 1]])
    const pts = computePacingCurve({ events, chapters, order: 'chronological', inWorldDayByEvent })
    expect(pts.map((p) => p.eventId)).toEqual(['e2', 'e1'])
  })

  it('attaches scene word counts to points (0 when unwritten)', () => {
    const events = [event('e1', 'c1', 0, 3), event('e2', 'c1', 1, 4)]
    const wordCountByEvent = new Map([['e1', 1200]])
    const pts = computePacingCurve({ events, chapters, order: 'narrative', wordCountByEvent })
    expect(pts.find((p) => p.eventId === 'e1')?.wordCount).toBe(1200)
    expect(pts.find((p) => p.eventId === 'e2')?.wordCount).toBe(0)
  })

  it('falls back to narrative order when in-world days tie', () => {
    const events = [event('e2', 'c1', 1, 1), event('e1', 'c1', 0, 2)]
    const inWorldDayByEvent = new Map([['e1', 5], ['e2', 5]])
    const pts = computePacingCurve({ events, chapters, order: 'chronological', inWorldDayByEvent })
    expect(pts.map((p) => p.eventId)).toEqual(['e1', 'e2'])
  })
})
