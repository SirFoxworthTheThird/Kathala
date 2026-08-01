import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createLocationMarker, updateLocationMarker, deleteLocationMarker } from '@/db/hooks/useLocationMarkers'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

function makeMarkerData(overrides = {}) {
  return {
    worldId: 'world-1',
    mapLayerId: 'layer-1',
    name: 'Ironforge',
    description: 'A dwarven city',
    x: 100,
    y: 200,
    iconType: 'city' as const,
    ...overrides,
  }
}

// ── createLocationMarker ──────────────────────────────────────────────────────

describe('createLocationMarker', () => {
  it('persists the marker with id and timestamps', async () => {
    const marker = await createLocationMarker(makeMarkerData())
    expect(marker.id).toBeTruthy()
    expect(marker.name).toBe('Ironforge')
    expect(marker.x).toBe(100)
    expect(marker.y).toBe(200)
    expect(marker.iconType).toBe('city')
    expect(marker.linkedMapLayerId).toBeNull()
    expect(marker.tags).toEqual([])
    expect(marker.createdAt).toBeGreaterThan(0)
    expect(marker.updatedAt).toBe(marker.createdAt)

    const stored = await db.locationMarkers.get(marker.id)
    expect(stored).toBeDefined()
    expect(stored!.worldId).toBe('world-1')
  })

  it('stores a linkedMapLayerId when provided', async () => {
    const marker = await createLocationMarker(makeMarkerData({ linkedMapLayerId: 'sublayer-1' }))
    expect(marker.linkedMapLayerId).toBe('sublayer-1')
  })

  it('defaults linkedMapLayerId to null when not provided', async () => {
    const marker = await createLocationMarker(makeMarkerData())
    expect(marker.linkedMapLayerId).toBeNull()
  })

  it('stores tags when provided', async () => {
    const marker = await createLocationMarker(makeMarkerData({ tags: ['capital', 'safe'] }))
    expect(marker.tags).toEqual(['capital', 'safe'])
  })

  it('generates unique ids', async () => {
    const a = await createLocationMarker(makeMarkerData())
    const b = await createLocationMarker(makeMarkerData({ name: 'Stonehaven' }))
    expect(a.id).not.toBe(b.id)
  })
})

// ── updateLocationMarker ──────────────────────────────────────────────────────

describe('updateLocationMarker', () => {
  it('updates the specified fields and bumps updatedAt', async () => {
    const marker = await createLocationMarker(makeMarkerData())
    await new Promise((r) => setTimeout(r, 5))

    await updateLocationMarker(marker.id, { name: 'Deepforge', x: 150, y: 250 })

    const stored = await db.locationMarkers.get(marker.id)
    expect(stored!.name).toBe('Deepforge')
    expect(stored!.x).toBe(150)
    expect(stored!.y).toBe(250)
    expect(stored!.updatedAt).toBeGreaterThan(marker.updatedAt)
  })

  it('can link a sub-map layer', async () => {
    const marker = await createLocationMarker(makeMarkerData())
    await updateLocationMarker(marker.id, { linkedMapLayerId: 'sub-1' })
    const stored = await db.locationMarkers.get(marker.id)
    expect(stored!.linkedMapLayerId).toBe('sub-1')
  })
})

// ── deleteLocationMarker ──────────────────────────────────────────────────────

describe('deleteLocationMarker', () => {
  it('removes the marker from the database', async () => {
    const marker = await createLocationMarker(makeMarkerData())
    await deleteLocationMarker(marker.id)
    expect(await db.locationMarkers.get(marker.id)).toBeUndefined()
  })

  it('is a no-op for a non-existent id', async () => {
    await expect(deleteLocationMarker('ghost')).resolves.toBeUndefined()
  })

  it('only deletes the targeted marker', async () => {
    const a = await createLocationMarker(makeMarkerData({ name: 'A' }))
    const b = await createLocationMarker(makeMarkerData({ name: 'B' }))
    await deleteLocationMarker(a.id)
    expect(await db.locationMarkers.get(b.id)).toBeDefined()
  })
})

// ── imageId (v53) ─────────────────────────────────────────────────────────────

describe('a location picture', () => {
  it('defaults to none, and can be given one at creation', async () => {
    const plain = await createLocationMarker(makeMarkerData())
    expect(plain.imageId).toBeNull()

    const withPicture = await createLocationMarker(makeMarkerData({ imageId: 'blob-1' }))
    expect(withPicture.imageId).toBe('blob-1')
    expect((await db.locationMarkers.get(withPicture.id))!.imageId).toBe('blob-1')
  })

  it('can be set and then cleared', async () => {
    const marker = await createLocationMarker(makeMarkerData())

    await updateLocationMarker(marker.id, { imageId: 'blob-2' })
    expect((await db.locationMarkers.get(marker.id))!.imageId).toBe('blob-2')

    // Clearing has to persist as null rather than being dropped as undefined,
    // or the field silently reverts to "never set" and a merge cannot tell the
    // difference between removing a picture and never having had one.
    await updateLocationMarker(marker.id, { imageId: null })
    const cleared = await db.locationMarkers.get(marker.id)
    expect(cleared!.imageId).toBeNull()
    expect('imageId' in cleared!).toBe(true)
  })

  it('is backfilled onto markers written before v53', async () => {
    // The upgrade itself, not the create path: a real pre-v53 row has no
    // imageId key at all, and reading it as undefined would make every old
    // location behave differently from every new one.
    await db.close()
    await db.delete()

    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('PlotWeaveDB', 52)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('locationMarkers')) {
          req.result.createObjectStore('locationMarkers', { keyPath: 'id' })
        }
      }
      req.onsuccess = () => {
        const handle = req.result
        const tx = handle.transaction('locationMarkers', 'readwrite')
        tx.objectStore('locationMarkers').put({
          id: 'pre-v53', worldId: 'world-1', mapLayerId: 'layer-1',
          linkedMapLayerId: null, name: 'Old Town', description: '',
          x: 1, y: 2, iconType: 'town', tags: [], factionId: null,
          createdAt: 1, updatedAt: 1,
        })
        tx.oncomplete = () => { handle.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })

    await db.open()

    const upgraded = await db.locationMarkers.get('pre-v53')
    expect(upgraded).toBeDefined()
    expect(upgraded!.imageId).toBeNull()
  })
})
