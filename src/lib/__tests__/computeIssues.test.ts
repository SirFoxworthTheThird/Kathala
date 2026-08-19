import { describe, it, expect } from 'vitest'
import { computeContinuityIssues, type ContinuityInput } from '@/lib/continuity/computeIssues'
import type { Chapter, Character, CharacterSnapshot, PlotThread, WorldEvent } from '@/types'

// Direct tests against the extracted checker core — previously these checks
// were only exercisable through the ContinuityChecker component.

function emptyInput(): ContinuityInput {
  return {
    worldId: 'w', world: undefined,
    chapters: [], allEvents: [], characters: [], rels: [], items: [], snapshots: [],
    knowledgeFacts: [], knowledgeReveals: [], sceneTexts: [], allRelSnaps: [],
    allItemPlacements: [], allLocationSnapshots: [], allMarkers: [], allLayers: [],
    travelModes: [], allMovements: [], artifacts: [], allMapRoutes: [],
    allMapRegions: [], allRegionSnapshots: [], allFactions: [], allMemberships: [],
    allFactionRels: [], allItemSnapshots: [], plotThreads: [],
  }
}

function chapter(id: string, number: number): Chapter {
  return { id, worldId: 'w', timelineId: 't1', number, title: `Ch ${number}`, synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }
}
function event(id: string, chapterId: string, sortOrder: number, opts: Partial<WorldEvent> = {}): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: 't1', title: id, description: '',
    locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
    tags: [], threadIds: [], sortOrder, travelDays: null, inWorldTime: null, tension: null,
    structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false,
    createdAt: 0, updatedAt: 0, ...opts,
  }
}
function character(id: string, name: string): Character {
  return { id, worldId: 'w', name, aliases: [], description: '', portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: 0, updatedAt: 0 }
}
function snapshot(id: string, characterId: string, eventId: string, isAlive: boolean): CharacterSnapshot {
  return {
    id, worldId: 'w', characterId, eventId, isAlive,
    currentLocationMarkerId: null, currentMapLayerId: null,
    inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
    createdAt: 0, updatedAt: 0,
  }
}

describe('computeContinuityIssues', () => {
  it('finds nothing in an empty world', () => {
    expect(computeContinuityIssues(emptyInput())).toEqual([])
  })

  it('flags a dead character appearing in a later non-flashback cast', () => {
    const input = emptyInput()
    input.chapters = [chapter('c1', 1), chapter('c2', 2)]
    input.characters = [character('boromir', 'Boromir')]
    input.allEvents = [
      event('e1', 'c1', 0), // dies off-screen here
      event('e2', 'c2', 0, { involvedCharacterIds: ['boromir'] }),
    ]
    input.snapshots = [snapshot('s1', 'boromir', 'e1', false)]
    const issues = computeContinuityIssues(input)
    const dead = issues.filter((i) => i.id.startsWith('dead-in-event-'))
    expect(dead).toHaveLength(1)
    expect(dead[0].eventId).toBe('e2')
    expect(dead[0].category).toBe('character')
    expect(dead[0].message).toContain('Boromir')
  })

  it('does not flag the scene where the death is recorded', () => {
    // W-1 of the writer run's siblings: recording a death is what the snapshot
    // at that scene *is*, so counting it made every death scene report itself
    // as a continuity error — and the offered remedy, "mark as flashback",
    // would be a lie about the manuscript. 69 of the 96 dead-in-scene warnings
    // across the 21 shipped worlds were this.
    const input = emptyInput()
    input.chapters = [chapter('c1', 1)]
    input.characters = [character('boromir', 'Boromir')]
    input.allEvents = [event('e1', 'c1', 0, { involvedCharacterIds: ['boromir'] })]
    input.snapshots = [snapshot('s1', 'boromir', 'e1', false)]
    expect(computeContinuityIssues(input).filter((i) => i.id.startsWith('dead-in-event-'))).toHaveLength(0)
  })

  it('still flags the scene after the one the death was recorded in', () => {
    // The presence that keeps the absence above honest: the check has been
    // narrowed by one scene, not switched off.
    const input = emptyInput()
    input.chapters = [chapter('c1', 1), chapter('c2', 2)]
    input.characters = [character('boromir', 'Boromir')]
    input.allEvents = [
      event('e1', 'c1', 0, { involvedCharacterIds: ['boromir'] }),
      event('e2', 'c2', 0, { involvedCharacterIds: ['boromir'] }),
    ]
    input.snapshots = [snapshot('s1', 'boromir', 'e1', false)]
    const dead = computeContinuityIssues(input).filter((i) => i.id.startsWith('dead-in-event-'))
    expect(dead).toHaveLength(1)
    expect(dead[0].eventId).toBe('e2')
  })

  it('does not flag a POV character in the scene of their own death, but does after', () => {
    // `dead-pov` reads the same history, so it took the same correction.
    const input = emptyInput()
    input.chapters = [chapter('c1', 1), chapter('c2', 2)]
    input.characters = [character('boromir', 'Boromir')]
    input.allEvents = [
      event('e1', 'c1', 0, { povCharacterId: 'boromir' }),
      event('e2', 'c2', 0, { povCharacterId: 'boromir' }),
    ]
    input.snapshots = [snapshot('s1', 'boromir', 'e1', false)]
    const pov = computeContinuityIssues(input).filter((i) => i.id.startsWith('dead-pov-'))
    expect(pov).toHaveLength(1)
    expect(pov[0].eventId).toBe('e2')
  })

  it('does not flag the dead character when the later event is a flashback', () => {
    const input = emptyInput()
    input.chapters = [chapter('c1', 1), chapter('c2', 2)]
    input.characters = [character('boromir', 'Boromir')]
    input.allEvents = [
      event('e1', 'c1', 0),
      event('e2', 'c2', 0, { involvedCharacterIds: ['boromir'], isFlashback: true }),
    ]
    input.snapshots = [snapshot('s1', 'boromir', 'e1', false)]
    expect(computeContinuityIssues(input).filter((i) => i.id.startsWith('dead-in-event-'))).toHaveLength(0)
  })

  it('warns when the POV character is not in the event cast', () => {
    const input = emptyInput()
    input.chapters = [chapter('c1', 1)]
    input.characters = [character('sam', 'Sam'), character('frodo', 'Frodo')]
    input.allEvents = [
      event('e1', 'c1', 0, { povCharacterId: 'sam', involvedCharacterIds: ['frodo'] }),
    ]
    const issues = computeContinuityIssues(input)
    const pov = issues.filter((i) => i.category === 'pov')
    expect(pov.length).toBeGreaterThanOrEqual(1)
    expect(pov.some((i) => i.eventId === 'e1' && i.message.includes('Sam'))).toBe(true)
  })

  it('surfaces dangling plot threads as navigable thread issues', () => {
    const input = emptyInput()
    input.chapters = [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3), chapter('c4', 4)]
    const heist: PlotThread = { id: 'heist', worldId: 'w', name: 'The Heist', color: '#f00', description: '', createdAt: 0, updatedAt: 0 }
    input.plotThreads = [heist]
    input.allEvents = [
      event('e1', 'c1', 0, { threadIds: ['heist'] }), // raised, never returned to
      event('e2', 'c4', 0),
    ]
    const threadIssues = computeContinuityIssues(input).filter((i) => i.category === 'thread')
    expect(threadIssues).toHaveLength(1)
    expect(threadIssues[0].id).toBe('thread-dangling-heist')
    expect(threadIssues[0].message).toContain('The Heist')
    // Navigates to the chapter where the thread was last advanced.
    expect(threadIssues[0].navigatePath).toContain('/timeline/c1')
    expect(threadIssues[0].eventId).toBe('e1')
  })

  /**
   * HB-1. The Highbarrow review's strongest finding was that this warning
   * names the character and the scene and then sends the writer to the
   * chapter and no further — so they must leave, move the cursor, open the
   * character, find Current State and save, per character. The issue carries
   * everything the fix needs; it just never offered one.
   */
  describe('the initial-state fix on "appears before any state was recorded"', () => {
    it('carries the character and the scene it first appears in', () => {
      const input = emptyInput()
      input.chapters = [chapter('c1', 1)]
      input.characters = [character('barnaby', 'Barnaby')]
      input.allEvents = [event('e1', 'c1', 0, { involvedCharacterIds: ['barnaby'] })]

      const issue = computeContinuityIssues(input).find((i) => i.kind === 'char-before-intro')
      expect(issue, 'a character with no snapshots at all should be flagged').toBeDefined()
      expect(issue!.fix).toEqual({
        kind: 'initialSnapshot',
        label: 'Record initial state here',
        eventId: 'e1',
        characterId: 'barnaby',
      })
    })

    it('offers it for a first snapshot that is merely late, not only for none at all', () => {
      const input = emptyInput()
      input.chapters = [chapter('c1', 1), chapter('c2', 2)]
      input.characters = [character('barnaby', 'Barnaby')]
      input.allEvents = [
        event('e1', 'c1', 0, { involvedCharacterIds: ['barnaby'] }),
        event('e2', 'c2', 0, { involvedCharacterIds: ['barnaby'] }),
      ]
      input.snapshots = [snapshot('s1', 'barnaby', 'e2', true)]

      const issue = computeContinuityIssues(input).find((i) => i.kind === 'char-before-intro')
      expect(issue!.detail).toContain('first snapshot is later')
      // The fix targets the *first* appearance, which is the gap — not the
      // event whose snapshot already exists.
      expect(issue!.fix).toMatchObject({ kind: 'initialSnapshot', eventId: 'e1', characterId: 'barnaby' })
    })

    it('offers nothing once a state is recorded at that scene', () => {
      const input = emptyInput()
      input.chapters = [chapter('c1', 1)]
      input.characters = [character('barnaby', 'Barnaby')]
      input.allEvents = [event('e1', 'c1', 0, { involvedCharacterIds: ['barnaby'] })]
      input.snapshots = [snapshot('s1', 'barnaby', 'e1', true)]

      expect(computeContinuityIssues(input).filter((i) => i.kind === 'char-before-intro')).toEqual([])
    })

    it('gives one fix per character across an ensemble scene', () => {
      const input = emptyInput()
      input.chapters = [chapter('c1', 1)]
      const cast = ['foxworth', 'barnaby', 'vargan']
      input.characters = cast.map((id) => character(id, id))
      input.allEvents = [event('e1', 'c1', 0, { involvedCharacterIds: cast })]

      const fixes = computeContinuityIssues(input)
        .filter((i) => i.kind === 'char-before-intro')
        .map((i) => i.fix)
      expect(fixes).toHaveLength(3)
      expect(fixes.every((f) => f?.kind === 'initialSnapshot')).toBe(true)
      expect(fixes.map((f) => f?.kind === 'initialSnapshot' && f.characterId).sort())
        .toEqual([...cast].sort())
    })
  })

})

// ── A POV that names nobody (W19-6) ───────────────────────────────────────────

/*
  On one shipped book this was 128 of 161 warnings: every one of them reading
  `POV "?" is not in the cast of "…"`, over a remedy — *add them to Characters*
  — that cannot be carried out, because "them" does not exist. Eighty per cent
  of the panel was one unactionable row, and the 33 real warnings were under it.
*/
describe('a POV pointing at a character that does not exist', () => {
  const danglingInput = () => {
    const input = emptyInput()
    input.chapters = [chapter('c1', 1)]
    input.characters = [character('kvothe', 'Kvothe')]
    input.allEvents = [event('e1', 'c1', 0, { povCharacterId: 'nobody' })]
    return input
  }

  it('is reported as the fault it is, and not as a missing cast member', () => {
    const pov = computeContinuityIssues(danglingInput()).filter((i) => i.category === 'pov')
    expect(pov).toHaveLength(1)
    expect(pov[0].kind).toBe('pov-unknown')
    expect(pov[0].message).toContain('names no character')
    // The old wording, and the remedy nobody could carry out.
    expect(pov[0].message).not.toContain('not in the cast')
    expect(pov[0].detail).not.toContain('add them to Characters')
  })

  it('offers the one fix that is actually true', () => {
    const [issue] = computeContinuityIssues(danglingInput()).filter((i) => i.category === 'pov')
    expect(issue.fix).toEqual({ kind: 'clearPov', label: 'Clear the POV', eventId: 'e1' })
  })

  it('does not also report it as dead, which it cannot be', () => {
    expect(computeContinuityIssues(danglingInput()).filter((i) => i.kind === 'dead-pov')).toHaveLength(0)
  })

  /*
    The presence half. Without it, "no pov-not-involved row" would pass just as
    well on a check that had been switched off — which is the shape of the
    change, so it is exactly the mistake available here.
  */
  it('still reports a real POV who is genuinely missing from the cast', () => {
    const input = emptyInput()
    input.chapters = [chapter('c1', 1)]
    input.characters = [character('kvothe', 'Kvothe')]
    input.allEvents = [event('e1', 'c1', 0, { povCharacterId: 'kvothe' })]

    const pov = computeContinuityIssues(input).filter((i) => i.category === 'pov')
    expect(pov).toHaveLength(1)
    expect(pov[0].kind).toBe('pov-not-involved')
    expect(pov[0].message).toContain('Kvothe')
    // …and a character who exists is never reported as one who does not.
    expect(pov.map((i) => i.kind)).not.toContain('pov-unknown')
  })

  it('reports one row per scene, so a book-wide break can be cleared in a batch', () => {
    const input = emptyInput()
    input.chapters = [chapter('c1', 1)]
    input.characters = [character('kvothe', 'Kvothe')]
    input.allEvents = [
      event('e1', 'c1', 0, { povCharacterId: 'nobody' }),
      event('e2', 'c1', 1, { povCharacterId: 'nobody' }),
      event('e3', 'c1', 2, { povCharacterId: 'kvothe', involvedCharacterIds: ['kvothe'] }),
    ]
    const unknown = computeContinuityIssues(input).filter((i) => i.kind === 'pov-unknown')
    expect(unknown.map((i) => i.eventId)).toEqual(['e1', 'e2'])
    expect(unknown.every((i) => i.fix?.kind === 'clearPov')).toBe(true)
  })
})

// ── The prose/cast warning carries its own fix (W19-7) ────────────────────────

/*
  The check a drafting writer meets most often — 143 words of new prose produced
  five of them — and the only remedy it offered was a chevron to the chapter,
  with every scene card collapsed. The scene editor has had the one-click fix all
  along, as a chip reading "In the text but not on this scene: + Maren Vale".
  Two screens, one fault, four clicks apart.
*/
describe('a character named in the prose but not in the cast', () => {
  const untaggedInput = () => {
    const input = emptyInput()
    input.chapters = [chapter('c1', 1)]
    input.characters = [character('maren', 'Maren Vale')]
    input.allEvents = [event('e1', 'c1', 0)]
    input.sceneTexts = [{
      id: 'st1', worldId: 'w', eventId: 'e1',
      text: 'Maren Vale found the letter and did not open it.',
      wordCount: 9, createdAt: 0, updatedAt: 0,
    }]
    return input
  }

  it('offers the fix the scene editor already had', () => {
    const [issue] = computeContinuityIssues(untaggedInput()).filter((i) => i.kind === 'prose-untagged')
    expect(issue).toBeDefined()
    expect(issue.fix).toEqual({
      kind: 'addToCast', label: 'Add to this scene', eventId: 'e1', characterId: 'maren',
    })
  })

  it('stops reporting it once the character is in the cast', () => {
    // The presence/absence pair, and the check that the fix is the right one:
    // doing what `addToCast` does is what makes the warning go away.
    const input = untaggedInput()
    input.allEvents = [event('e1', 'c1', 0, { involvedCharacterIds: ['maren'] })]
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'prose-untagged')).toHaveLength(0)
  })
})
