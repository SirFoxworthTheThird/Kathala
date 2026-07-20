import { describe, it, expect } from 'vitest'
import { resolveCharacterPin, buildSequentialQueue, type PinLayer } from '../mapUtils'
import type { CharacterSnapshot, LocationMarker } from '@/types'

// World: root map "Grounds"; a castle (sub-map of root) that is a level group
// with a ground floor (representative) and a first floor.
const layers: PinLayer[] = [
  { id: 'root', parentMapId: null, levelGroupId: null, levelIndex: 0 },
  { id: 'ground', parentMapId: 'root', levelGroupId: 'G', levelIndex: 0 },
  { id: 'first', parentMapId: 'root', levelGroupId: 'G', levelIndex: 1 },
]
const markers: LocationMarker[] = [
  // The castle pin on the grounds links to the ground floor (the representative).
  mkMarker('castle', 'root', 'ground', 50, 50),
  mkMarker('hall', 'ground', null, 10, 10),
  mkMarker('library', 'first', null, 20, 30),
]

function mkMarker(id: string, mapLayerId: string, linkedMapLayerId: string | null, x: number, y: number): LocationMarker {
  return { id, worldId: 'w', mapLayerId, linkedMapLayerId, name: id, description: '', x, y, iconType: 'building', tags: [], factionId: null, createdAt: 0, updatedAt: 0 }
}
function snap(charId: string, markerId: string | null, mapLayerId: string | null): CharacterSnapshot {
  return { id: `s-${charId}`, worldId: 'w', characterId: charId, eventId: 'e', isAlive: true, currentLocationMarkerId: markerId, currentMapLayerId: mapLayerId, inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: 0, updatedAt: 0 }
}

describe('resolveCharacterPin — floors', () => {
  it('shows a character at their marker when viewing that floor', () => {
    expect(resolveCharacterPin(snap('c', 'library', 'first'), 'first', layers, markers))
      .toEqual({ x: 20, y: 30, inSubMap: false })
  })

  it('shows a character on ANY floor at the building pin when viewing the parent map', () => {
    // On the first floor (not the representative) — still reached via the castle pin.
    expect(resolveCharacterPin(snap('c', 'library', 'first'), 'root', layers, markers))
      .toEqual({ x: 50, y: 50, inSubMap: true })
    // On the ground floor too.
    expect(resolveCharacterPin(snap('c', 'hall', 'ground'), 'root', layers, markers))
      .toEqual({ x: 50, y: 50, inSubMap: true })
  })

  it('does not show a character on a sibling floor when viewing another floor', () => {
    expect(resolveCharacterPin(snap('c', 'library', 'first'), 'ground', layers, markers)).toBeNull()
  })
})

describe('buildSequentialQueue — cross-floor travel', () => {
  it('navigates to the destination floor and lands the pin at its marker', () => {
    const keyRef = { current: 0 }
    const queue = buildSequentialQueue(
      [snap('c', 'hall', 'ground')],   // was on the ground floor
      [snap('c', 'library', 'first')], // now on the first floor
      markers, [], 1000, keyRef, [], layers,
    )
    // The last step happens on the first floor and targets the library marker.
    const arrival = queue[queue.length - 1]
    expect(arrival.mapLayerId).toBe('first')
    expect(arrival.pinAnimation.to['c']).toEqual({ x: 20, y: 30 })
  })
})
