import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createLocationMarker, updateLocationMarker } from '@/db/hooks/useLocationMarkers'
import { createMapLayer } from '@/db/hooks/useMapLayers'

/**
 * A place may exist in the story before it exists on a map.
 *
 * It used to be a pin, which meant a world with no map could hold no places at
 * all: a scene had no Setting to offer, a character's Current Location had
 * nothing in it, and the `@` picker would not make one. A novel set in a
 * kitchen, an office and her mother's house could record none of it — while
 * forty screens outside Maps consume places, almost all of them needing only
 * which place it is.
 */
beforeEach(async () => {
  await db.delete()
  await db.open()
})
afterAll(async () => { await db.delete() })

describe('a place with no map', () => {
  it('can be made in a world that has no map at all', async () => {
    const place = await createLocationMarker({
      worldId: 'w', mapLayerId: null, name: 'The kitchen', description: '', iconType: 'building',
    })
    expect(place.mapLayerId).toBeNull()
    expect(await db.locationMarkers.count()).toBe(1)
  })

  it('and joins a map later, landing where it can be found', async () => {
    /*
      The half that did not exist for mapped places either: nothing anywhere
      wrote `mapLayerId` after creation, so a pin dropped on the wrong map
      stayed there. "Make it now, draw the map later" depends on this.
    */
    const place = await createLocationMarker({
      worldId: 'w', mapLayerId: null, name: 'The kitchen', description: '', iconType: 'building',
    })
    const layer = await createMapLayer({
      worldId: 'w', name: 'The house', description: '', parentMapId: null,
      imageId: null, imageWidth: 800, imageHeight: 600, scalePixelsPerUnit: null, scaleUnit: null,
    })

    await updateLocationMarker(place.id, {
      mapLayerId: layer.id, x: Math.round(layer.imageWidth / 2), y: Math.round(layer.imageHeight / 2),
    })

    const moved = await db.locationMarkers.get(place.id)
    expect(moved?.mapLayerId).toBe(layer.id)
    // At the centre — findable, to be dragged where it belongs.
    expect([moved?.x, moved?.y]).toEqual([400, 300])
  })

  it('and can be taken off a map again', async () => {
    // The pair. Without this the control is a one-way door, and a pin put on
    // the wrong map could be moved but never withdrawn.
    const layer = await createMapLayer({
      worldId: 'w', name: 'The house', description: '', parentMapId: null,
      imageId: null, imageWidth: 800, imageHeight: 600, scalePixelsPerUnit: null, scaleUnit: null,
    })
    const place = await createLocationMarker({
      worldId: 'w', mapLayerId: layer.id, name: 'The kitchen', description: '',
      x: 10, y: 10, iconType: 'building',
    })

    await updateLocationMarker(place.id, { mapLayerId: null })
    expect((await db.locationMarkers.get(place.id))?.mapLayerId).toBeNull()
  })
})
