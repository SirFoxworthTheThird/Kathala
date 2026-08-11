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
