import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { importWorld, type WorldExportFile } from '@/lib/exportImport'
import { db } from '@/db/database'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeExport(overrides: Partial<WorldExportFile> = {}): WorldExportFile {
  return {
    version: 1,
    exportedAt: Date.now(),
    world: { id: 'world-test', name: 'Test World', description: '', coverImageId: null, createdAt: 1000, updatedAt: 1000 },
    mapLayers: [],
    locationMarkers: [],
    characters: [],
    items: [],
    characterSnapshots: [],
    characterMovements: [],
    itemPlacements: [],
    locationSnapshots: [],
    itemSnapshots: [],
    relationships: [],
    relationshipSnapshots: [],
    timelines: [],
    chapters: [],
    events: [],
    blobs: [],
    travelModes: [],
    ...overrides,
  }
}

function makeFile(data: unknown): File {
  return new File([JSON.stringify(data)], 'export.pwk', { type: 'application/json' })
}

// ── validateImport (via importWorld) ──────────────────────────────────────────

describe('importWorld — validation', () => {
  it('rejects non-JSON files', async () => {
    const file = new File(['not json {{'], 'bad.pwk', { type: 'application/json' })
    await expect(importWorld(file)).rejects.toThrow('could not parse JSON')
  })

  it('rejects a non-object payload', async () => {
    await expect(importWorld(makeFile(42))).rejects.toThrow('not an object')
  })

  it('rejects a missing version field', async () => {
    const { version: _v, ...noVersion } = makeExport()
    await expect(importWorld(makeFile(noVersion))).rejects.toThrow('missing version')
  })

  it('rejects an unsupported version number', async () => {
    await expect(importWorld(makeFile(makeExport({ version: 99 as never })))).rejects.toThrow('Unsupported export version')
  })

  it('rejects a missing world object', async () => {
    const bad = { ...makeExport(), world: null }
    await expect(importWorld(makeFile(bad))).rejects.toThrow('missing world')
  })

  it('rejects a world without an id', async () => {
    const bad = { ...makeExport(), world: { name: 'No ID' } }
    await expect(importWorld(makeFile(bad))).rejects.toThrow('world missing id or name')
  })

  it('rejects when a required array field is not an array', async () => {
    const bad = { ...makeExport(), characters: 'oops' }
    await expect(importWorld(makeFile(bad))).rejects.toThrow('characters is not an array')
  })

  it('rejects when characterMovements is present but not an array', async () => {
    const bad = { ...makeExport(), characterMovements: 'bad' }
    await expect(importWorld(makeFile(bad))).rejects.toThrow('characterMovements is not an array')
  })
})

describe('importWorld — successful import', () => {
  it('returns the world id on success', async () => {
    await db.delete()
    await db.open()

    const worldId = await importWorld(makeFile(makeExport()))
    expect(worldId).toBe('world-test')
  })

  it('writes the world to the database', async () => {
    await db.delete()
    await db.open()

    await importWorld(makeFile(makeExport()))
    const stored = await db.worlds.get('world-test')
    expect(stored).toBeDefined()
    expect(stored!.name).toBe('Test World')
  })

  it('writes associated data arrays to the database', async () => {
    await db.delete()
    await db.open()

    const data = makeExport({
      characters: [{
        id: 'char-1', worldId: 'world-test', name: 'Aria',
        aliases: [], description: '', portraitImageId: null, tags: [], isAlive: true,
        createdAt: 1000, updatedAt: 1000,
      }],
    })

    await importWorld(makeFile(data))
    const chars = await db.characters.where('worldId').equals('world-test').toArray()
    expect(chars).toHaveLength(1)
    expect(chars[0].name).toBe('Aria')
  })

  it('defaults characterMovements to [] when absent from the file', async () => {
    await db.delete()
    await db.open()

    const { characterMovements: _cm, ...withoutMovements } = makeExport()
    const worldId = await importWorld(makeFile(withoutMovements))
    expect(worldId).toBe('world-test')
    const movements = await db.characterMovements.where('worldId').equals('world-test').toArray()
    expect(movements).toHaveLength(0)
  })

  it('imports blobs and converts base64 back to Blob objects', async () => {
    await db.delete()
    await db.open()

    // "hello" in base64 is "aGVsbG8="
    const data = makeExport({
      blobs: [{ id: 'blob-1', worldId: 'world-test', mimeType: 'text/plain', dataBase64: btoa('hello'), createdAt: 1000 }],
    })

    await importWorld(makeFile(data))

    const stored = await db.blobs.get('blob-1')
    expect(stored).toBeDefined()
    expect(stored!.id).toBe('blob-1')
    expect(stored!.worldId).toBe('world-test')
    expect(stored!.mimeType).toBe('text/plain')
    expect(stored!.createdAt).toBe(1000)
    // data is truthy — fake-indexeddb stores the Blob object
    expect(stored!.data).toBeTruthy()
  })

  it('overwrites existing data for the same world id', async () => {
    await db.delete()
    await db.open()

    await importWorld(makeFile(makeExport({ world: { id: 'world-test', name: 'First', description: '', coverImageId: null, createdAt: 1, updatedAt: 1 } })))
    await importWorld(makeFile(makeExport({ world: { id: 'world-test', name: 'Second', description: '', coverImageId: null, createdAt: 1, updatedAt: 1 } })))

    const stored = await db.worlds.get('world-test')
    expect(stored!.name).toBe('Second')
  })
})
