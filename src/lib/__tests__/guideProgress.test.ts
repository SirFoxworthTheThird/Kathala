import { describe, it, expect } from 'vitest'
import { guideKey, hasGuideProgress, readGuide, shouldShowGuide, type GuideProgress } from '@/lib/guideProgress'

/**
 * N14: the guide kept its progress in component state, and the condition that
 * summons it — "this world has no timeline" — is the one step 1 makes false.
 * Reloading between step 1 and step 2 skipped steps 2 to 4 with no way back in.
 */

const atStep2: GuideProgress = {
  step: 2,
  createdEventId: 'ev1',
  createdCharacterId: null,
  createdEventTitle: 'The ninth bell does not ring',
  createdCharacterName: null,
}

describe('guideKey', () => {
  it('is per world, so two worlds do not share a guide', () => {
    expect(guideKey('w1')).not.toBe(guideKey('w2'))
    expect(guideKey('w1')).toContain('w1')
  })
})

describe('readGuide', () => {
  it('reads back what was written, including what the steps made', () => {
    expect(readGuide(JSON.stringify(atStep2))).toEqual(atStep2)
  })

  it('reads the finished marker', () => {
    expect(readGuide(JSON.stringify('done'))).toBe('done')
  })

  it('is nothing when there is nothing', () => {
    expect(readGuide(null)).toBeNull()
    expect(readGuide('')).toBeNull()
  })

  /**
   * A convenience note, not world data: anything unreadable should give the
   * guide's ordinary behaviour rather than a broken screen.
   */
  it('shrugs off a value it cannot use', () => {
    expect(readGuide('{not json')).toBeNull()
    expect(readGuide('42')).toBeNull()
    expect(readGuide(JSON.stringify({ step: 9 }))).toBeNull()
    expect(readGuide(JSON.stringify({ nostep: true }))).toBeNull()
  })

  it('drops fields of the wrong type rather than carrying them through', () => {
    const junk = JSON.stringify({ ...atStep2, createdEventId: 17, createdCharacterName: {} })
    expect(readGuide(junk)).toEqual({ ...atStep2, createdEventId: null, createdCharacterName: null })
  })
})

describe('shouldShowGuide', () => {
  it('shows it to a world nobody has started', () => {
    expect(shouldShowGuide({ stored: null, timelineCount: 0 })).toBe(true)
  })

  it('leaves a started world alone', () => {
    // Someone who built a timeline themselves is not at step 1 of anything.
    expect(shouldShowGuide({ stored: null, timelineCount: 1 })).toBe(false)
  })

  /** The finding: step 1 creates the timeline, so the count stops answering. */
  it('resumes from stored progress even though the world now has a timeline', () => {
    expect(shouldShowGuide({ stored: atStep2, timelineCount: 1 })).toBe(true)
  })

  it('stays gone once finished or skipped, on a world still without a timeline', () => {
    // The pair to the first case: same world shape, opposite answer, because
    // skipping used to be component state and a reload brought the guide back.
    expect(shouldShowGuide({ stored: 'done', timelineCount: 0 })).toBe(false)
  })

  it('waits for the count rather than flashing the guide at every world', () => {
    expect(shouldShowGuide({ stored: null, timelineCount: undefined })).toBe(false)
  })
})

describe('hasGuideProgress', () => {
  const fresh = {
    step: 1 as const,
    createdEventId: null,
    createdCharacterId: null,
    createdEventTitle: null,
    createdCharacterName: null,
  }

  /**
   * Being shown the guide is not being part-way through it. The persisting
   * effect runs on mount, so storing this state made the mere sight of step 1
   * count as progress — and a writer who ignored the guide, built a timeline on
   * the Timeline screen and came back to the dashboard was asked to name it
   * again. Three specs caught that, having gone to the dashboard for something
   * else entirely.
   */
  it('is false for a guide that has only been looked at', () => {
    expect(hasGuideProgress(fresh)).toBe(false)
  })

  it('is true once a step has moved on', () => {
    expect(hasGuideProgress({ ...fresh, step: 2, createdEventId: 'ev1' })).toBe(true)
  })

  it('stays true when you walk back to step 1, since step 1 has already built', () => {
    expect(hasGuideProgress({ ...fresh, step: 1, createdEventId: 'ev1' })).toBe(true)
  })
})
