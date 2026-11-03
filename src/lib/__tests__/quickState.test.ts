import { describe, it, expect } from 'vitest'
import { draftFromSnapshot, isCarriedForward, placedBySetting, quickStateSays } from '@/lib/quickState'
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

describe('the scene’s setting, for somebody in its cast', () => {
  /*
    W-2 from a writer run: the scene was set on the quay, Tobin was in its cast,
    and the form opened on the road where he was last recorded — so one click
    recorded the road here and the continuity check that had flagged it went
    quiet.
  */
  it('is where they are, rather than the last place they were recorded', () => {
    expect(draftFromSnapshot(EARLIER, 'ev-chapter-nine', 'mk-tower').locationMarkerId).toBe('mk-tower')
    expect(placedBySetting(EARLIER, 'ev-chapter-nine', 'mk-tower')).toBe(true)
  })

  it('and for somebody with nothing recorded at all', () => {
    expect(draftFromSnapshot(undefined, 'ev-chapter-nine', 'mk-tower').locationMarkerId).toBe('mk-tower')
  })

  it('but a record at this scene says what it says', () => {
    const here = { ...EARLIER, eventId: 'ev-chapter-nine', currentLocationMarkerId: 'mk-cistern' }
    expect(draftFromSnapshot(here, 'ev-chapter-nine', 'mk-tower').locationMarkerId).toBe('mk-cistern')
    expect(placedBySetting(here, 'ev-chapter-nine', 'mk-tower')).toBe(false)
  })

  it('and with no setting to go on, the last place recorded is still the answer', () => {
    expect(draftFromSnapshot(EARLIER, 'ev-chapter-nine', null).locationMarkerId).toBe('mk-cistern')
    expect(placedBySetting(EARLIER, 'ev-chapter-nine', null)).toBe(false)
  })

  it('says nothing about it when the setting is the place they were anyway', () => {
    expect(placedBySetting(EARLIER, 'ev-chapter-nine', 'mk-cistern')).toBe(false)
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

describe('quickStateSays', () => {
  const draft = { isAlive: true, locationMarkerId: 'mk-tower', statusNotes: 'Waiting for the bell.' }

  it('takes the layer from the chosen marker, not from the old record', () => {
    // The old record says `map-old`; the marker actually lives on `map-upper`.
    expect(quickStateSays(draft, MARKERS).currentMapLayerId).toBe('map-upper')
    expect(EARLIER.currentMapLayerId).not.toBe('map-upper')
  })

  it('clears the layer when the place is cleared', () => {
    const cleared = quickStateSays({ ...draft, locationMarkerId: null }, MARKERS)
    expect(cleared.currentLocationMarkerId).toBeNull()
    expect(cleared.currentMapLayerId).toBeNull()
  })

  it('leaves a marker it cannot find without inventing a layer for it', () => {
    expect(quickStateSays({ ...draft, locationMarkerId: 'mk-deleted' }, MARKERS).currentMapLayerId).toBeNull()
  })

  /**
   * The quick form asks three questions, and says those (Part B3). The rest —
   * what they hold, how they travel, the notes on what they carry — it does
   * not say at all, so it cannot blank them: they are read from the records
   * before. And it says no scene: that is `sayPerson`'s own argument, so a
   * prefill from an earlier scene cannot carry its own into the write.
   */
  it('says the three it offers, and nothing else', () => {
    expect(quickStateSays(draft, MARKERS)).toEqual({
      isAlive: true, currentLocationMarkerId: 'mk-tower', currentMapLayerId: 'map-upper', statusNotes: 'Waiting for the bell.',
    })
  })
})
