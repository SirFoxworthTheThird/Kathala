import { describe, it, expect } from 'vitest'
import { carryForwardPlan, describeCarryForward, sameFieldValue } from '@/lib/carryForward'
import type { CharacterSnapshot } from '@/types'

/**
 * F2: a snapshot is a whole state record, so recording one fact at a scene pins
 * every other fact there — and going back to add "she has had this since chapter
 * one" stops dead at the next scene that recorded anything, with nothing said.
 *
 * The model stays: a later record is the writer's statement about that scene.
 * What these answer is which later records merely inherited the value being
 * replaced, and where a decision was already taken that must be left alone.
 */

const KNIFE = 'it-knife'
const LETTER = 'it-letter'

const events = [
  { id: 'e1', chapterId: 'c1', sortOrder: 0, title: 'The reed house' },
  { id: 'e2', chapterId: 'c1', sortOrder: 1, title: 'Setting out' },
  { id: 'e3', chapterId: 'c2', sortOrder: 0, title: 'The seal breaks' },
  { id: 'e4', chapterId: 'c3', sortOrder: 0, title: 'Ferrow Crossing' },
]
const chapters = [
  { id: 'c1', number: 1 },
  { id: 'c2', number: 2 },
  { id: 'c3', number: 3 },
]

function snap(eventId: string, inventoryItemIds: string[], extra: Partial<CharacterSnapshot> = {}): CharacterSnapshot {
  return {
    id: `s-${eventId}`, worldId: 'w', characterId: 'corvin', eventId, isAlive: true,
    currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds,
    inventoryNotes: '', statusNotes: '', travelModeId: null,
    createdAt: 0, updatedAt: 0, ...extra,
  }
}

const plan = (snapshots: CharacterSnapshot[], previousValue: unknown, fromEventId = 'e1') =>
  carryForwardPlan({ snapshots, fromEventId, field: 'inventoryItemIds', previousValue, events, chapters })

describe('carryForwardPlan', () => {
  it('finds the later records still showing the value just replaced', () => {
    // The knife was added at e1; e2 and e3 were written before that and are
    // still empty-handed.
    const p = plan([snap('e1', [KNIFE]), snap('e2', []), snap('e3', [])], [])
    expect(p.targets.map((t) => t.sceneTitle)).toEqual(['Setting out', 'The seal breaks'])
    expect(p.stopsAt).toBeNull()
  })

  it('stops at a decision the writer already made', () => {
    // At e3 they are carrying the letter instead — that is not an inherited
    // blank, it is a choice, and it ends the run.
    const p = plan([snap('e1', [KNIFE]), snap('e2', []), snap('e3', [LETTER])], [])
    expect(p.targets.map((t) => t.sceneTitle)).toEqual(['Setting out'])
    expect(p.stopsAt?.sceneTitle).toBe('The seal breaks')
  })

  it('says nothing when the very next record already differs', () => {
    // Nothing was silently swallowed: the next scene states its own answer.
    const p = plan([snap('e1', [KNIFE]), snap('e2', [LETTER])], [])
    expect(p.targets).toEqual([])
    expect(p.stopsAt?.sceneTitle).toBe('Setting out')
  })

  it('says nothing when nothing is recorded later at all', () => {
    // The change reaches the end of the book on its own.
    expect(plan([snap('e1', [KNIFE])], []).targets).toEqual([])
  })

  it('ignores records at or before the scene being edited', () => {
    const p = plan([snap('e1', [KNIFE]), snap('e2', [])], [], 'e2')
    expect(p.targets).toEqual([])
  })

  it('reads scenes in narrative order, not the order the records arrive', () => {
    const p = plan([snap('e4', []), snap('e2', []), snap('e1', [KNIFE])], [])
    expect(p.targets.map((t) => t.sceneTitle)).toEqual(['Setting out', 'Ferrow Crossing'])
  })

  it('names the chapter each target is in', () => {
    const p = plan([snap('e1', [KNIFE]), snap('e3', [])], [])
    expect(p.targets[0]).toMatchObject({ chapterNumber: 2, sceneTitle: 'The seal breaks' })
  })

  it('says nothing about a scene it cannot place', () => {
    expect(plan([snap('e1', [KNIFE])], [], 'e-deleted').targets).toEqual([])
  })

  it('works on a scalar field too', () => {
    const snapshots = [
      snap('e1', [], { statusNotes: 'footsore' }),
      snap('e2', [], { statusNotes: '' }),
      snap('e3', [], { statusNotes: 'wounded' }),
    ]
    const p = carryForwardPlan({
      snapshots, fromEventId: 'e1', field: 'statusNotes', previousValue: '', events, chapters,
    })
    expect(p.targets.map((t) => t.sceneTitle)).toEqual(['Setting out'])
    expect(p.stopsAt?.sceneTitle).toBe('The seal breaks')
  })
})

describe('sameFieldValue', () => {
  it('treats an inventory as a set, not a sequence', () => {
    expect(sameFieldValue([KNIFE, LETTER], [LETTER, KNIFE])).toBe(true)
  })
  it('still tells different inventories apart', () => {
    expect(sameFieldValue([KNIFE], [KNIFE, LETTER])).toBe(false)
    expect(sameFieldValue([KNIFE], [LETTER])).toBe(false)
  })
  it('compares scalars plainly', () => {
    expect(sameFieldValue('', '')).toBe(true)
    expect(sameFieldValue(null, null)).toBe(true)
    expect(sameFieldValue(true, false)).toBe(false)
  })
})

describe('describeCarryForward', () => {
  it('names where the change stops', () => {
    const p = plan([snap('e1', [KNIFE]), snap('e3', [])], [])
    expect(describeCarryForward(p, 'Corvin Ashe', 'inventoryItemIds'))
      .toBe("Corvin Ashe's inventory is recorded again at Ch. 2 · The seal breaks, without this change.")
  })

  it('counts the rest of the run', () => {
    const p = plan([snap('e1', [KNIFE]), snap('e2', []), snap('e3', []), snap('e4', [])], [])
    expect(describeCarryForward(p, 'Corvin Ashe', 'inventoryItemIds'))
      .toContain('and 2 scenes after it')
  })

  it('uses the singular for one more', () => {
    const p = plan([snap('e1', [KNIFE]), snap('e2', []), snap('e3', [])], [])
    expect(describeCarryForward(p, 'Corvin Ashe', 'inventoryItemIds')).toContain('and 1 scene after it')
  })

  it('says nothing when there is nothing to carry', () => {
    expect(describeCarryForward({ targets: [], stopsAt: null }, 'Corvin Ashe', 'inventoryItemIds')).toBeNull()
  })
})
