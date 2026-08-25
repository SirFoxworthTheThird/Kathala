import { describe, it, expect } from 'vitest'
import { sceneStanding, isOnStage, describeSceneStanding, type SceneStanding } from '@/lib/sceneStanding'

/**
 * N7, from a blind writer run: *"Who is in this scene" is two separate ledgers
 * that never talk.* State was recorded for a character at two scenes, and the
 * character page then read **History 2 · Appearances 0**.
 *
 * Both numbers were right. A snapshot says where somebody is at a moment; a
 * cast says they are in the scene, and the delta model needs the first to work
 * for people who are off stage — so merging the two would turn every recorded
 * position into an entrance. What was missing was anywhere saying so.
 */

const ev = (over: Partial<{
  povCharacterId: string | null
  involvedCharacterIds: string[]
  mentionedCharacterIds: string[]
}> = {}) => ({
  povCharacterId: null,
  involvedCharacterIds: [],
  mentionedCharacterIds: [],
  ...over,
})

describe('sceneStanding', () => {
  it('reads the cast', () => {
    expect(sceneStanding(ev({ involvedCharacterIds: ['corvin'] }), 'corvin')).toBe('cast')
  })

  it('reads a mention, which is not the cast', () => {
    expect(sceneStanding(ev({ mentionedCharacterIds: ['corvin'] }), 'corvin')).toBe('mentioned')
  })

  it('is absent for someone the scene does not name at all', () => {
    // The reviewer's case: state recorded here, and nothing else.
    expect(sceneStanding(ev({ involvedCharacterIds: ['rell'] }), 'corvin')).toBe('absent')
  })

  /**
   * The POV character is in the scene whether or not the cast lists them —
   * the same rule `computeCharacterAppearances` and the prose checker apply.
   * If this disagreed with them, the line beside the editor would contradict
   * the count on the tab.
   */
  it('counts the point of view even when the cast forgot them', () => {
    expect(sceneStanding(ev({ povCharacterId: 'corvin' }), 'corvin')).toBe('pov')
  })

  it('prefers the point of view to the cast, so the stronger fact is the one said', () => {
    expect(sceneStanding(ev({ povCharacterId: 'corvin', involvedCharacterIds: ['corvin'] }), 'corvin'))
      .toBe('pov')
  })

  it('prefers the cast to a mention, so a stale mention cannot hide a real entrance', () => {
    expect(sceneStanding(ev({ involvedCharacterIds: ['corvin'], mentionedCharacterIds: ['corvin'] }), 'corvin'))
      .toBe('cast')
  })

  it('treats a missing scene as absent rather than throwing', () => {
    // The cursor can name a scene that has just been deleted from elsewhere.
    expect(sceneStanding(undefined, 'corvin')).toBe('absent')
  })

  it('survives a record written before mentions existed', () => {
    const legacy = { povCharacterId: null, involvedCharacterIds: ['rell'] }
    expect(sceneStanding(legacy, 'corvin')).toBe('absent')
  })
})

describe('isOnStage', () => {
  it('is the two standings that put them in the room, and only those', () => {
    expect(isOnStage('pov')).toBe(true)
    expect(isOnStage('cast')).toBe(true)
    // A mention is a reference to someone who is not there — that is the whole
    // distinction the continuity checker's remedy was corrected to respect.
    expect(isOnStage('mentioned')).toBe(false)
    expect(isOnStage('absent')).toBe(false)
  })
})

describe('describeSceneStanding', () => {
  const ALL: SceneStanding[] = ['pov', 'cast', 'mentioned', 'absent']

  it('says something different for each standing', () => {
    const lines = ALL.map((s) => describeSceneStanding(s, 'Corvin Adze'))
    expect(new Set(lines).size).toBe(ALL.length)
  })

  it('names the character in every one, since the line sits in their editor', () => {
    for (const s of ALL) {
      expect(describeSceneStanding(s, 'Corvin Adze'), s).toContain('Corvin Adze')
    }
  })

  /**
   * The sentence the finding is about. It has to say the thing the writer
   * believed the opposite of — that this is not an entrance — rather than only
   * reporting the absence.
   */
  it('tells an off-stage writer what recording state here does and does not mean', () => {
    const line = describeSceneStanding('absent', 'Corvin Adze')
    expect(line).toContain("not in this scene's cast")
    expect(line).toContain('where they are')
  })

  it('says "scene" throughout, never "event"', () => {
    // The app's word for this is scene; `sceneVocabulary.test.ts` holds the
    // rule for the checker and the JSX, and this line is neither.
    for (const s of ALL) {
      expect(describeSceneStanding(s, 'Corvin Adze').toLowerCase(), s).not.toContain('event')
    }
  })
})
