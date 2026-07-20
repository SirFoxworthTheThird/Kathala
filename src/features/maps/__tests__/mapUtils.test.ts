import { describe, it, expect } from 'vitest'
import {
  resolveCharacterPin,
  buildSequentialQueue,
  playbackFocusTarget,
  playbackFocusZoom,
  type PinLayer,
} from '../mapUtils'
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

  it('uses the marker layer when an older snapshot still names the previous floor', () => {
    const stale = snap('c', 'library', 'ground')
    expect(resolveCharacterPin(stale, 'first', layers, markers))
      .toEqual({ x: 20, y: 30, inSubMap: false })
    expect(resolveCharacterPin(stale, 'root', layers, markers))
      .toEqual({ x: 50, y: 50, inSubMap: true })
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
    expect(arrival.pinAnimation.from).toEqual({})
    expect(playbackFocusTarget(arrival.pinAnimation))
      .toEqual({ characterId: 'c', position: { x: 20, y: 30 } })
  })

  it('detects a floor transition when the destination snapshot layer is stale', () => {
    const keyRef = { current: 0 }
    const queue = buildSequentialQueue(
      [snap('c', 'hall', 'ground')],
      [snap('c', 'library', 'ground')], // marker moved to first; snapshot was not rewritten
      markers, [], 1000, keyRef, [], layers,
    )

    expect(queue.map((step) => step.mapLayerId)).toEqual(['first'])
    expect(queue[0].pinAnimation.to['c']).toEqual({ x: 20, y: 30 })
  })
})

describe('playbackFocusZoom', () => {
  it('zooms in from the fitted full-map view', () => {
    expect(playbackFocusZoom(-0.5, -0.5, 4)).toBe(1)
  })

  it('preserves a closer user-selected zoom', () => {
    expect(playbackFocusZoom(2.5, -0.5, 4)).toBe(2.5)
  })

  it('never exceeds the map maximum zoom', () => {
    expect(playbackFocusZoom(0, 0, 1)).toBe(1)
  })
})

describe('playbackFocusTarget', () => {
  it('uses the movement start when one is available', () => {
    expect(playbackFocusTarget({
      from: { harry: { x: 10, y: 20 } },
      to: { harry: { x: 30, y: 40 } },
    })).toEqual({ characterId: 'harry', position: { x: 10, y: 20 } })
  })

  it('uses the destination for a first appearance or cross-map fade-in', () => {
    expect(playbackFocusTarget({
      from: {},
      to: { harry: { x: 30, y: 40 } },
    })).toEqual({ characterId: 'harry', position: { x: 30, y: 40 } })
  })
})
