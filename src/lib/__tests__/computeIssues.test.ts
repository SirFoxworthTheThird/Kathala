import { describe, it, expect } from 'vitest'
import { computeContinuityIssues, type ContinuityInput } from '@/lib/continuity/computeIssues'
import type { Chapter, Character, CharacterSnapshot, LocationMarker, LocationSnapshot, PlotThread, RelationshipSnapshot, WorldEvent } from '@/types'

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

// ── Five checks the model could answer and nobody had asked ──────────────────

/*
  Each of these reads a field the app already writes and no check had ever read:
  the scene's own place, a character's birth date, a relationship's `isActive`
  flag, and a location's status history.
*/

function marker(id: string, name: string): LocationMarker {
  return {
    id, worldId: 'w', mapLayerId: 'map1', linkedMapLayerId: null, name,
    description: '', x: 100, y: 100, imageId: null, iconType: 'building',
    tags: [], factionId: null, createdAt: 0, updatedAt: 0,
  }
}
function locSnap(id: string, locationMarkerId: string, eventId: string, status: string): LocationSnapshot {
  return { id, worldId: 'w', locationMarkerId, eventId, status, notes: '', createdAt: 0, updatedAt: 0 }
}
function placed(id: string, characterId: string, eventId: string, markerId: string | null): CharacterSnapshot {
  return {
    id, worldId: 'w', characterId, eventId, isAlive: true,
    currentLocationMarkerId: markerId, currentMapLayerId: markerId ? 'map1' : null,
    inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
    createdAt: 0, updatedAt: 0,
  }
}

describe('a scene set here, with somebody recorded there', () => {
  /** Maren is in a scene set at the Ledger Room; her record says the Flats. */
  const elsewhereInput = () => {
    const input = emptyInput()
    input.chapters = [chapter('c1', 1)]
    input.characters = [character('maren', 'Maren Vale')]
    input.allMarkers = [marker('ledger', 'The Ledger Room'), marker('flats', 'The Flats')]
    input.allEvents = [
      event('e1', 'c1', 0, { involvedCharacterIds: ['maren'] }),
      event('e2', 'c1', 1, { involvedCharacterIds: ['maren'], locationMarkerId: 'ledger' }),
    ]
    input.snapshots = [placed('s1', 'maren', 'e1', 'flats')]
    return input
  }

  it('is reported, naming both places', () => {
    const [issue] = computeContinuityIssues(elsewhereInput()).filter((i) => i.kind === 'scene-cast-elsewhere')
    expect(issue).toBeDefined()
    expect(issue.message).toContain('Maren Vale')
    expect(issue.detail).toContain('The Ledger Room')
    expect(issue.message).toContain('The Flats')
    expect(issue.eventId).toBe('e2')
  })

  it('offers to move them to the place the scene already names', () => {
    const [issue] = computeContinuityIssues(elsewhereInput()).filter((i) => i.kind === 'scene-cast-elsewhere')
    expect(issue.fix).toEqual({
      kind: 'moveHere', label: 'Move to The Ledger Room',
      eventId: 'e2', characterId: 'maren', markerId: 'ledger',
    })
  })

  it('says nothing once they are recorded there', () => {
    // The pair that proves the fix is the right one: doing what `moveHere` does
    // is what makes the finding go away.
    const input = elsewhereInput()
    input.snapshots = [...input.snapshots, placed('s2', 'maren', 'e2', 'ledger')]
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'scene-cast-elsewhere')).toHaveLength(0)
  })

  it('treats a journey into the scene as an answer, not a contradiction', () => {
    // People walk into rooms. A movement naming this scene's place says so.
    const input = elsewhereInput()
    input.allMovements = [{
      id: 'mv1', worldId: 'w', characterId: 'maren', eventId: 'e2',
      waypoints: ['flats', 'ledger'], travelModeId: null, notes: '', createdAt: 0, updatedAt: 0,
    }]
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'scene-cast-elsewhere')).toHaveLength(0)
  })

  it('stays quiet when nothing is recorded at all', () => {
    // Silence is not disagreement — a check that cannot tell where somebody is
    // has nothing to say. This is most worlds, most of the time.
    const input = elsewhereInput()
    input.snapshots = []
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'scene-cast-elsewhere')).toHaveLength(0)
  })

  it('leaves flashbacks alone', () => {
    // Their place in the linear order is not where they sit in the story, so a
    // look-back reads the wrong state for them.
    const input = elsewhereInput()
    input.allEvents[1] = { ...input.allEvents[1], isFlashback: true }
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'scene-cast-elsewhere')).toHaveLength(0)
  })
})

describe('a character in a scene before they were born', () => {
  const born = (year: number) => ({ year, month: 0, day: 1 })
  const withCalendar = (): ContinuityInput => {
    const input = emptyInput()
    input.world = {
      id: 'w', name: 'W', description: '', coverImageId: null, theme: null,
      continuityStaleThreshold: 5, createdAt: 0, updatedAt: 0,
      calendar: { startYear: 1, yearSuffix: '', months: [{ name: 'M1', days: 30 }, { name: 'M2', days: 30 }] },
    }
    input.chapters = [chapter('c1', 1)]
    return input
  }

  it('is reported when the scene is dated before the birth date', () => {
    const input = withCalendar()
    input.characters = [{ ...character('kid', 'Young Kvothe'), birthDate: born(5) }]
    // Day 0 is the first day of year 1 — four years before they are born.
    input.allEvents = [event('e1', 'c1', 0, { involvedCharacterIds: ['kid'], inWorldTime: 0 })]
    const [issue] = computeContinuityIssues(input).filter((i) => i.kind === 'age-unborn')
    expect(issue).toBeDefined()
    expect(issue.message).toContain('Young Kvothe')
    expect(issue.category).toBe('character')
  })

  it('says nothing once the scene is after the birth date', () => {
    const input = withCalendar()
    input.characters = [{ ...character('kid', 'Young Kvothe'), birthDate: born(1) }]
    input.allEvents = [event('e1', 'c1', 0, { involvedCharacterIds: ['kid'], inWorldTime: 300 })]
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'age-unborn')).toHaveLength(0)
  })

  it('stays silent in a world with no calendar, and with no birth dates', () => {
    // Both halves are needed for this to say anything, which is why it is
    // quiet in every world that does not date its people.
    const noCal = withCalendar()
    noCal.world = { ...noCal.world!, calendar: undefined }
    noCal.characters = [{ ...character('kid', 'Young Kvothe'), birthDate: born(5) }]
    noCal.allEvents = [event('e1', 'c1', 0, { involvedCharacterIds: ['kid'], inWorldTime: 0 })]
    expect(computeContinuityIssues(noCal).filter((i) => i.kind === 'age-unborn')).toHaveLength(0)

    const noBirth = withCalendar()
    noBirth.characters = [character('kid', 'Young Kvothe')]
    noBirth.allEvents = [event('e1', 'c1', 0, { involvedCharacterIds: ['kid'], inWorldTime: 0 })]
    expect(computeContinuityIssues(noBirth).filter((i) => i.kind === 'age-unborn')).toHaveLength(0)
  })

  it('does not judge an undated flashback', () => {
    // Its day is borrowed from the scene beside it, and a borrowed date is not
    // evidence. A flashback that states its own date is still checked.
    const input = withCalendar()
    input.characters = [{ ...character('kid', 'Young Kvothe'), birthDate: born(5) }]
    input.allEvents = [event('e1', 'c1', 0, { involvedCharacterIds: ['kid'], isFlashback: true })]
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'age-unborn')).toHaveLength(0)

    input.allEvents = [event('e1', 'c1', 0, { involvedCharacterIds: ['kid'], isFlashback: true, inWorldTime: 0 })]
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'age-unborn')).toHaveLength(1)
  })
})

describe('a relationship with a state after it ended', () => {
  const relSnap = (id: string, eventId: string, isActive: boolean): RelationshipSnapshot => ({
    id, worldId: 'w', relationshipId: 'r1', eventId, label: '', strength: 'moderate',
    sentiment: 'neutral', description: '', isActive, createdAt: 0, updatedAt: 0,
  })
  const endedInput = () => {
    const input = emptyInput()
    input.chapters = [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3)]
    input.characters = [character('a', 'Ayla'), character('b', 'Bran')]
    input.allEvents = [event('e1', 'c1', 0), event('e2', 'c2', 0), event('e3', 'c3', 0)]
    input.rels = [{
      id: 'r1', worldId: 'w', characterAId: 'a', characterBId: 'b',
      label: '', description: '', startEventId: 'e1', strength: 'moderate',
      sentiment: 'neutral', isBidirectional: true, createdAt: 0, updatedAt: 0,
    }]
    input.allRelSnaps = [relSnap('rs1', 'e1', true), relSnap('rs2', 'e2', false), relSnap('rs3', 'e3', true)]
    return input
  }

  it('is reported, naming both chapters', () => {
    const [issue] = computeContinuityIssues(endedInput()).filter((i) => i.kind === 'rel-after-end')
    expect(issue).toBeDefined()
    expect(issue.message).toContain('Ayla')
    expect(issue.message).toContain('Bran')
    expect(issue.detail).toContain('Ch. 2')
    expect(issue.detail).toContain('Ch. 3')
    expect(issue.eventId).toBe('e3')
  })

  it('says nothing about a relationship that simply runs on', () => {
    // The presence half. Without it, "no rel-after-end" would pass on a check
    // that never fires at all.
    const input = endedInput()
    input.allRelSnaps = [relSnap('rs1', 'e1', true), relSnap('rs2', 'e2', true), relSnap('rs3', 'e3', true)]
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'rel-after-end')).toHaveLength(0)
  })

  it('reads the last ending, not the first', () => {
    // Relationships in fiction break and mend. A writer who records the mend
    // has said what happened; only the ending nobody came back to is a finding.
    const input = endedInput()
    input.allRelSnaps = [relSnap('rs1', 'e1', false), relSnap('rs2', 'e2', true), relSnap('rs3', 'e3', false)]
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'rel-after-end')).toHaveLength(0)
  })
})

describe('a destroyed place standing again', () => {
  const razedInput = (lastStatus: string) => {
    const input = emptyInput()
    input.chapters = [chapter('c1', 1), chapter('c2', 2)]
    input.allMarkers = [marker('town', 'Trebon')]
    input.allEvents = [event('e1', 'c1', 0), event('e2', 'c2', 0)]
    input.allLocationSnapshots = [
      locSnap('ls1', 'town', 'e1', 'destroyed'),
      locSnap('ls2', 'town', 'e2', lastStatus),
    ]
    return input
  }

  it('is reported, naming the place and both chapters', () => {
    const [issue] = computeContinuityIssues(razedInput('active')).filter((i) => i.kind === 'loc-resurrected')
    expect(issue).toBeDefined()
    expect(issue.message).toContain('Trebon')
    expect(issue.category).toBe('world')
    expect(issue.detail).toContain('Ch. 1')
    expect(issue.detail).toContain('Ch. 2')
  })

  it('says nothing about a place that stays destroyed', () => {
    expect(computeContinuityIssues(razedInput('destroyed')).filter((i) => i.kind === 'loc-resurrected')).toHaveLength(0)
  })

  it('treats "unknown" as not knowing rather than as a return', () => {
    expect(computeContinuityIssues(razedInput('unknown')).filter((i) => i.kind === 'loc-resurrected')).toHaveLength(0)
  })

  it('reports one return, not every scene after it', () => {
    // A place that comes back and is razed again is a place with a history.
    const input = razedInput('active')
    input.chapters = [...input.chapters, chapter('c3', 3), chapter('c4', 4)]
    input.allEvents = [...input.allEvents, event('e3', 'c3', 0), event('e4', 'c4', 0)]
    input.allLocationSnapshots = [
      ...input.allLocationSnapshots,
      locSnap('ls3', 'town', 'e3', 'occupied'),
      locSnap('ls4', 'town', 'e4', 'active'),
    ]
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'loc-resurrected')).toHaveLength(1)
  })
})

describe('a scene set before the one in front of it', () => {
  const pinned = (t2: number | null) => {
    const input = emptyInput()
    input.chapters = [chapter('c1', 1), chapter('c2', 2)]
    input.allEvents = [
      event('e1', 'c1', 0, { inWorldTime: 100 }),
      event('e2', 'c2', 0, t2 == null ? {} : { inWorldTime: t2 }),
    ]
    return input
  }

  it('is reported when a pin puts a scene earlier than the scene before it', () => {
    const [issue] = computeContinuityIssues(pinned(40)).filter((i) => i.kind === 'time-backwards')
    expect(issue).toBeDefined()
    expect(issue.category).toBe('world')
    expect(issue.detail).toContain('day 40')
    expect(issue.detail).toContain('day 100')
    expect(issue.eventId).toBe('e2')
  })

  it('says nothing when the pin moves the story forward', () => {
    expect(computeContinuityIssues(pinned(140)).filter((i) => i.kind === 'time-backwards')).toHaveLength(0)
  })

  it('leaves a flashback alone, which is what the pin is for', () => {
    const input = pinned(40)
    input.allEvents[1] = { ...input.allEvents[1], isFlashback: true }
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'time-backwards')).toHaveLength(0)
  })

  it('does not check a derived day, which can only move forward', () => {
    // Comparing those would be checking the arithmetic rather than the writing.
    expect(computeContinuityIssues(pinned(null)).filter((i) => i.kind === 'time-backwards')).toHaveLength(0)
  })
})

// ── Coming back: revived, repaired, rebuilt ──────────────────────────────────

/*
  The three had three different answers to one shape. A character's return
  generated an *error per subsequent scene* and recording the revival is what
  created them; an item's return cleared the finding silently; a place's return
  produced one warning. They agree now: **the return is one warning where it
  happens, and silent when the writer names it** — with a state on the record
  rather than a suppression keyed on a derived issue id.
*/

const alive = (id: string, eventId: string, isAlive: boolean, revived?: boolean): CharacterSnapshot => ({
  id, worldId: 'w', characterId: 'gandalf', eventId, isAlive, revived,
  currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [],
  inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: 0, updatedAt: 0,
})

describe('a character alive again after dying', () => {
  /** Dies in Ch.2, back in Ch.4, story runs to Ch.8. */
  const revivalInput = (revivedFlag?: boolean) => {
    const input = emptyInput()
    input.chapters = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => chapter(`c${n}`, n))
    input.characters = [character('gandalf', 'Gandalf')]
    input.allEvents = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => event(`e${n}`, `c${n}`, 0))
    input.snapshots = [
      alive('s1', 'e1', true), alive('s2', 'e2', false),
      alive('s4', 'e4', true, revivedFlag),
      alive('s5', 'e5', true), alive('s6', 'e6', true),
      alive('s7', 'e7', true), alive('s8', 'e8', true),
    ]
    return input
  }

  it('is reported once, where they come back', () => {
    // Measured before the change: five rows, Ch.4 through Ch.8, one per scene.
    const found = computeContinuityIssues(revivalInput()).filter((i) => i.kind === 'dead-then-alive')
    expect(found).toHaveLength(1)
    expect(found[0].eventId).toBe('e4')
    expect(found[0].message).toContain('Ch. 4')
    expect(found[0].message).toContain('Ch. 2')
  })

  it('is a warning, because a resurrection is a genre and not an impossibility', () => {
    const [issue] = computeContinuityIssues(revivalInput()).filter((i) => i.kind === 'dead-then-alive')
    expect(issue.severity).toBe('warning')
  })

  it('says nothing when the snapshot records that they came back', () => {
    expect(computeContinuityIssues(revivalInput(true)).filter((i) => i.kind === 'dead-then-alive')).toHaveLength(0)
  })

  it('reports a second death and return as its own finding', () => {
    // The return is the news; after it, being alive is simply being alive — but
    // dying again starts the story over.
    const input = revivalInput(true)
    input.snapshots = [...input.snapshots, alive('s9', 'e6', false), alive('s10', 'e7', true)]
    const found = computeContinuityIssues(input).filter((i) => i.kind === 'dead-then-alive')
    expect(found).toHaveLength(1)
    expect(found[0].eventId).toBe('e7')
  })
})

describe('an item whole again after being destroyed', () => {
  const itemSnap = (id: string, eventId: string, condition: string) => ({
    id, worldId: 'w', itemId: 'sting', eventId, condition, notes: '', createdAt: 0, updatedAt: 0,
  })
  const brokenInput = (back: string) => {
    const input = emptyInput()
    input.chapters = [chapter('c1', 1), chapter('c2', 2)]
    input.items = [{ id: 'sting', worldId: 'w', name: 'Sting', description: '', iconType: 'weapon', imageId: null, tags: [], createdAt: 0, updatedAt: 0 } as ContinuityInput['items'][number]]
    input.allEvents = [event('e1', 'c1', 0), event('e2', 'c2', 0)]
    input.allItemSnapshots = [itemSnap('is1', 'e1', 'destroyed'), itemSnap('is2', 'e2', back)]
    return input
  }

  it('is reported when it simply becomes intact again', () => {
    const [issue] = computeContinuityIssues(brokenInput('intact')).filter((i) => i.kind === 'item-restored')
    expect(issue).toBeDefined()
    expect(issue.message).toContain('Sting')
    expect(issue.detail).toContain('repaired')
  })

  it('says nothing when the condition says it was repaired', () => {
    expect(computeContinuityIssues(brokenInput('repaired')).filter((i) => i.kind === 'item-restored')).toHaveLength(0)
  })

  it('says nothing about ordinary repair or about finding something lost', () => {
    // `damaged → intact` and `lost → found` are not returns from a terminal
    // state — the vocabulary shipped `lost`/`found` as a designed pair.
    const damaged = brokenInput('intact')
    damaged.allItemSnapshots = [itemSnap('is1', 'e1', 'damaged'), itemSnap('is2', 'e2', 'intact')]
    expect(computeContinuityIssues(damaged).filter((i) => i.kind === 'item-restored')).toHaveLength(0)

    const lost = brokenInput('intact')
    lost.allItemSnapshots = [itemSnap('is1', 'e1', 'lost'), itemSnap('is2', 'e2', 'found')]
    expect(computeContinuityIssues(lost).filter((i) => i.kind === 'item-restored')).toHaveLength(0)
  })

  it('treats "broken" as destroyed, since one screen wrote that word for years', () => {
    // `LocationDetailPanel` shipped its own vocabulary — intact, damaged,
    // broken, lost, used, depleted — writing the same `condition` field. An
    // item marked broken there was invisible to every check, all of which
    // asked for "destroyed".
    const input = brokenInput('intact')
    input.allItemSnapshots = [itemSnap('is1', 'e1', 'broken'), itemSnap('is2', 'e2', 'intact')]
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'item-restored')).toHaveLength(1)
  })

  it('and keeps a broken item out of a later scene, which is the older check', () => {
    /*
      The half the mutation testing caught missing: `item-restored` reads the
      condition list directly, so a test on it alone left `isItemDestroyedAtOrder`
      — which `item-after-destroyed-ev` and `-inv` both use — completely
      unguarded. Reverting that to a bare `=== 'destroyed'` passed every other
      test in this file.
    */
    const input = brokenInput('intact')
    input.allItemSnapshots = [itemSnap('is1', 'e1', 'broken')]
    input.allEvents = [event('e1', 'c1', 0), event('e2', 'c2', 0, { involvedItemIds: ['sting'] })]
    const found = computeContinuityIssues(input).filter((i) => i.kind === 'item-after-destroyed-ev')
    expect(found).toHaveLength(1)
    expect(found[0].eventId).toBe('e2')

    // The presence half: a whole item in a later scene is nobody's business.
    input.allItemSnapshots = [itemSnap('is1', 'e1', 'intact')]
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'item-after-destroyed-ev')).toHaveLength(0)
  })
})

describe('a place standing again after being destroyed', () => {
  it('says nothing when the status says it was rebuilt', () => {
    const input = emptyInput()
    input.chapters = [chapter('c1', 1), chapter('c2', 2)]
    input.allMarkers = [marker('town', 'Trebon')]
    input.allEvents = [event('e1', 'c1', 0), event('e2', 'c2', 0)]
    input.allLocationSnapshots = [locSnap('ls1', 'town', 'e1', 'destroyed'), locSnap('ls2', 'town', 'e2', 'rebuilt')]
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'loc-resurrected')).toHaveLength(0)

    // The presence half, one word apart: unnamed, it is still a finding.
    input.allLocationSnapshots = [locSnap('ls1', 'town', 'e1', 'destroyed'), locSnap('ls2', 'town', 'e2', 'active')]
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'loc-resurrected')).toHaveLength(1)
  })
})

// ── The second tier of the audit ─────────────────────────────────────────────

describe('a character in two hostile factions at once', () => {
  const twoSides = (endFirst: string | null) => {
    const input = emptyInput()
    input.chapters = [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3)]
    input.allEvents = [event('e1', 'c1', 0), event('e2', 'c2', 0), event('e3', 'c3', 0)]
    input.characters = [character('mole', 'The Mole')]
    input.allFactions = [
      { id: 'crown', worldId: 'w', name: 'The Crown', description: '', color: '#fff', coverImageId: null, tags: [], createdAt: 0, updatedAt: 0 },
      { id: 'rebels', worldId: 'w', name: 'The Rebels', description: '', color: '#000', coverImageId: null, tags: [], createdAt: 0, updatedAt: 0 },
    ]
    input.allFactionRels = [{
      id: 'fr1', worldId: 'w', factionAId: 'crown', factionBId: 'rebels',
      stance: 'hostile', notes: '', createdAt: 0, updatedAt: 0,
    }]
    input.allMemberships = [
      { id: 'm1', worldId: 'w', factionId: 'crown', characterId: 'mole', role: null, notes: '', startEventId: 'e1', endEventId: endFirst, createdAt: 0, updatedAt: 0 },
      { id: 'm2', worldId: 'w', factionId: 'rebels', characterId: 'mole', role: null, notes: '', startEventId: 'e2', endEventId: null, createdAt: 0, updatedAt: 0 },
    ]
    return input
  }

  it('is reported when the memberships overlap', () => {
    const [issue] = computeContinuityIssues(twoSides(null)).filter((i) => i.kind === 'faction-conflict')
    expect(issue).toBeDefined()
    expect(issue.message).toContain('The Mole')
    expect(issue.message).toContain('The Crown')
    expect(issue.message).toContain('The Rebels')
  })

  it('says nothing when the first membership ends before the second begins', () => {
    // Changing sides is a story; being on both is the finding.
    expect(computeContinuityIssues(twoSides('e2')).filter((i) => i.kind === 'faction-conflict')).toHaveLength(0)
  })

  it('says nothing when the two factions are not hostile', () => {
    const input = twoSides(null)
    input.allFactionRels = [{ ...input.allFactionRels[0], stance: 'allied' }]
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'faction-conflict')).toHaveLength(0)
  })

  it('reports one row per pair of sides, however many memberships say so', () => {
    /*
      A mutation caught the first version of this: it added *scenes*, and the
      loop is over membership pairs, so removing the dedupe changed nothing and
      the test passed either way. The case the dedupe is actually for is a
      character who joined one side twice — two Crown memberships against one
      Rebels membership is two hostile pairs saying the same thing.
    */
    const input = twoSides(null)
    input.allMemberships = [
      ...input.allMemberships,
      { id: 'm3', worldId: 'w', factionId: 'crown', characterId: 'mole', role: null, notes: '', startEventId: 'e3', endEventId: null, createdAt: 0, updatedAt: 0 },
    ]
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'faction-conflict')).toHaveLength(1)
  })
})

describe('a fact the reader never learns', () => {
  const fact = (readerLearnsAtEventId: string | null) => ({
    id: 'f1', worldId: 'w', title: 'The king is dead', description: '', tags: [],
    readerLearnsAtEventId, originEventId: null, createdAt: 0, updatedAt: 0,
  })
  const reveal = (characterId: string, eventId: string) => ({
    id: `r-${characterId}`, worldId: 'w', factId: 'f1', characterId, eventId, note: '', createdAt: 0, updatedAt: 0,
  })
  /** A book that uses POV, so derivation is a live route. */
  const povBook = () => {
    const input = emptyInput()
    input.chapters = [chapter('c1', 1), chapter('c2', 2)]
    input.characters = [character('a', 'Ayla'), character('b', 'Bran')]
    input.allEvents = [
      event('e1', 'c1', 0, { povCharacterId: 'a', involvedCharacterIds: ['a'] }),
      event('e2', 'c2', 0, { povCharacterId: 'a', involvedCharacterIds: ['a'] }),
    ]
    return input
  }

  it('is reported when only a non-POV character knows it', () => {
    const input = povBook()
    input.knowledgeFacts = [fact(null)]
    input.knowledgeReveals = [reveal('b', 'e1')]
    const [issue] = computeContinuityIssues(input).filter((i) => i.kind === 'knowledge-unrevealed')
    expect(issue).toBeDefined()
    expect(issue.message).toContain('The king is dead')
  })

  it('says nothing when a POV character knows it by the time they hold the POV', () => {
    const input = povBook()
    input.knowledgeFacts = [fact(null)]
    input.knowledgeReveals = [reveal('a', 'e1')]
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'knowledge-unrevealed')).toHaveLength(0)
  })

  it('says nothing when a reader reveal is set explicitly', () => {
    const input = povBook()
    input.knowledgeFacts = [fact('e2')]
    input.knowledgeReveals = []
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'knowledge-unrevealed')).toHaveLength(0)
  })

  it('stays out of a book that records no POV at all', () => {
    // There, POV derivation resolves for *no* fact, so the finding would be
    // about the field being unused rather than about this fact.
    const input = povBook()
    input.allEvents = input.allEvents.map((e) => ({ ...e, povCharacterId: null }))
    input.knowledgeFacts = [fact(null)]
    input.knowledgeReveals = [reveal('b', 'e1')]
    expect(computeContinuityIssues(input).filter((i) => i.kind === 'knowledge-unrevealed')).toHaveLength(0)
  })
})

describe('a chapter with no scenes', () => {
  it('is reported, and the populated one beside it is not', () => {
    const input = emptyInput()
    input.chapters = [chapter('c1', 1), chapter('c2', 2)]
    input.allEvents = [event('e1', 'c1', 0)]
    const found = computeContinuityIssues(input).filter((i) => i.kind === 'chapter-empty')
    expect(found).toHaveLength(1)
    expect(found[0].message).toContain('Ch. 2')
    expect(found[0].category).toBe('world')
  })
})

describe('an item carried by a dead character', () => {
  const carried = (aliveAtDeath: boolean) => {
    const input = emptyInput()
    input.chapters = [chapter('c1', 1), chapter('c2', 2)]
    input.characters = [character('boromir', 'Boromir')]
    input.items = [{ id: 'horn', worldId: 'w', name: 'The Horn of Gondor', description: '', iconType: 'misc', imageId: null, tags: [], createdAt: 0, updatedAt: 0 } as ContinuityInput['items'][number]]
    input.allEvents = [event('e1', 'c1', 0), event('e2', 'c2', 0)]
    input.snapshots = [
      { ...snapshot('s1', 'boromir', 'e1', aliveAtDeath), inventoryItemIds: [] },
      { ...snapshot('s2', 'boromir', 'e2', false), inventoryItemIds: ['horn'] },
    ]
    return input
  }

  it('is reported when he was already dead walking in', () => {
    const [issue] = computeContinuityIssues(carried(false)).filter((i) => i.kind === 'item-dead-holder')
    expect(issue).toBeDefined()
    expect(issue.message).toContain('The Horn of Gondor')
    expect(issue.message).toContain('Boromir')
  })

  it('says nothing about the scene where the death is recorded', () => {
    // Dying with your sword in your hand is not a continuity error — the same
    // rule `dead-in-event` already follows.
    expect(computeContinuityIssues(carried(true)).filter((i) => i.kind === 'item-dead-holder')).toHaveLength(0)
  })
})

describe('a scene with no point of view', () => {
  /** `withPov` scenes name one; `without` do not. */
  const book = (withPov: number, without: number) => {
    const input = emptyInput()
    input.chapters = [chapter('c1', 1)]
    input.characters = [character('a', 'Ayla')]
    input.allEvents = [
      ...Array.from({ length: withPov }, (_, i) => event(`p${i}`, 'c1', i, { povCharacterId: 'a', involvedCharacterIds: ['a'] })),
      ...Array.from({ length: without }, (_, i) => event(`n${i}`, 'c1', withPov + i)),
    ]
    return input
  }

  it('is reported for the odd scene in a book that otherwise names one', () => {
    const found = computeContinuityIssues(book(19, 1)).filter((i) => i.kind === 'pov-missing')
    expect(found).toHaveLength(1)
    expect(found[0].detail).toContain('19 of this book')
  })

  it('stays silent in a book that barely uses the field', () => {
    // The gate is the whole design: without it every scene of every world that
    // ignores POV would carry a row.
    expect(computeContinuityIssues(book(2, 8)).filter((i) => i.kind === 'pov-missing')).toHaveLength(0)
  })

  it('stays silent when the gaps are too many to read as omissions', () => {
    expect(computeContinuityIssues(book(10, 10)).filter((i) => i.kind === 'pov-missing')).toHaveLength(0)
  })
})
