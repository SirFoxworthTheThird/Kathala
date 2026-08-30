import { describe, it, expect } from 'vitest'
import { draftFromSnapshot, isCarriedForward, quickStateWrite } from '@/lib/quickState'
import type { CharacterSnapshot } from '@/types'

/**
 * Recording state from the scene rather than the character's page — the entry
 * cost both blind writer runs named: "seven interactions", "a six-scene chapter
 * with four people is a morning".
 */

const EARLIER: CharacterSnapshot = {
  id: 'snap-1',
  worldId: 'w1',
  characterId: 'corvin',
  // An *earlier* scene: this is what a resolved snapshot looks like, and
  // carrying this id is the bug this codebase has hit four times.
  eventId: 'ev-chapter-one',
  isAlive: true,
  currentLocationMarkerId: 'mk-cistern',
  currentMapLayerId: 'map-old',
  inventoryItemIds: ['bell-hook'],
  inventoryNotes: 'wrapped in oilcloth',
  statusNotes: 'bleeding from the shoulder',
  travelModeId: 'on-foot',
  sortKey: 1,
  createdAt: 0,
  updatedAt: 0,
}

const MARKERS = [
  { id: 'mk-cistern', mapLayerId: 'map-city' },
  { id: 'mk-tower', mapLayerId: 'map-upper' },
]

describe('draftFromSnapshot', () => {
  it('opens on where they were, so confirming is the cheap case', () => {
    expect(draftFromSnapshot(EARLIER)).toEqual({
      isAlive: true,
      locationMarkerId: 'mk-cistern',
      statusNotes: '',
    })
  })

  /**
   * Location and alive are facts that stay true until something changes them.
   * A note is about the moment it was written, and carrying "bleeding from the
   * shoulder" into every later scene would put words in the writer's mouth.
   */
  it('does not carry the note forward, though it carries the place', () => {
    expect(draftFromSnapshot(EARLIER).statusNotes).toBe('')
    expect(draftFromSnapshot(EARLIER).locationMarkerId).toBe('mk-cistern')
  })

  it('opens blank and alive for someone with nothing recorded', () => {
    expect(draftFromSnapshot(undefined)).toEqual({
      isAlive: true, locationMarkerId: null, statusNotes: '',
    })
  })

  it('carries a death forward, since that does not stop being true', () => {
    expect(draftFromSnapshot({ ...EARLIER, isAlive: false }).isAlive).toBe(false)
  })
})

describe('isCarriedForward', () => {
  it('is true when the prefill came from an earlier scene', () => {
    expect(isCarriedForward(EARLIER, 'ev-chapter-nine')).toBe(true)
  })

  it('is false when the record is already at this scene', () => {
    expect(isCarriedForward({ ...EARLIER, eventId: 'ev-chapter-nine' }, 'ev-chapter-nine')).toBe(false)
  })

  it('is false when there is nothing to carry', () => {
    expect(isCarriedForward(undefined, 'ev-chapter-nine')).toBe(false)
  })
})

describe('quickStateWrite', () => {
  const args = {
    draft: { isAlive: true, locationMarkerId: 'mk-tower', statusNotes: 'Waiting for the bell.' },
    prev: EARLIER,
    worldId: 'w1',
    characterId: 'corvin',
    eventId: 'ev-chapter-nine',
    markers: MARKERS,
  }

  /**
   * The rule, and the reason this function exists at all: `prev` is a resolved
   * snapshot whose own `eventId` is an earlier scene, and carrying it makes the
   * write land there — rewriting an assertion about a moment nobody was editing.
   */
  it('writes at the scene being edited, never the one the prefill came from', () => {
    expect(quickStateWrite(args).eventId).toBe('ev-chapter-nine')
    expect(EARLIER.eventId).toBe('ev-chapter-one')
  })

  it('takes the layer from the chosen marker, not from the old record', () => {
    // The old record says `map-old`; the marker actually lives on `map-upper`.
    expect(quickStateWrite(args).currentMapLayerId).toBe('map-upper')
  })

  it('clears the layer when the place is cleared', () => {
    const cleared = quickStateWrite({ ...args, draft: { ...args.draft, locationMarkerId: null } })
    expect(cleared.currentLocationMarkerId).toBeNull()
    expect(cleared.currentMapLayerId).toBeNull()
  })

  it('leaves a marker it cannot find without inventing a layer for it', () => {
    const gone = quickStateWrite({ ...args, draft: { ...args.draft, locationMarkerId: 'mk-deleted' } })
    expect(gone.currentMapLayerId).toBeNull()
  })

  /**
   * The quick form asks three questions. It must not answer the others by
   * silently blanking them — taking an item out of somebody's hands is not
   * something a writer asked for by saying where they are standing.
   */
  it('carries the fields it does not offer rather than clearing them', () => {
    const written = quickStateWrite(args)
    expect(written.inventoryItemIds).toEqual(['bell-hook'])
    expect(written.inventoryNotes).toBe('wrapped in oilcloth')
    expect(written.travelModeId).toBe('on-foot')
  })

  it('writes the three it does offer', () => {
    const written = quickStateWrite(args)
    expect(written.isAlive).toBe(true)
    expect(written.currentLocationMarkerId).toBe('mk-tower')
    expect(written.statusNotes).toBe('Waiting for the bell.')
  })

  it('starts a character with no history from empty rather than undefined', () => {
    const fresh = quickStateWrite({ ...args, prev: undefined })
    expect(fresh.inventoryItemIds).toEqual([])
    expect(fresh.inventoryNotes).toBe('')
    expect(fresh.travelModeId).toBeNull()
  })
})
