import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/database'
import { blobEntryUrl } from '@/db/hooks/useBlobs'
import { serializeWorldForSync, importWorldFromJson } from '@/lib/exportImport'
import type { BlobEntry } from '@/types'

describe('blobEntryUrl', () => {
  it('returns the external URL for a linked image', () => {
    const entry: BlobEntry = { id: 'b1', worldId: 'w', mimeType: 'image/png', url: 'https://cdn.example/x.png', createdAt: 0 }
    expect(blobEntryUrl(entry)).toBe('https://cdn.example/x.png')
  })

  it('returns undefined for a missing entry or one with neither data nor url', () => {
    expect(blobEntryUrl(undefined)).toBeUndefined()
    expect(blobEntryUrl({ id: 'b', worldId: 'w', mimeType: '', createdAt: 0 })).toBeUndefined()
  })
})

describe('linked images survive export/import', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('round-trips a linked-image blob without turning it into binary data', async () => {
    const worldId = 'w1'
    await db.worlds.put({ id: worldId, name: 'W', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: 0, updatedAt: 0 })
    await db.blobs.put({ id: 'link1', worldId, mimeType: 'image/png', url: 'https://cdn.example/hero.png', createdAt: 0 })
    await db.characters.put({ id: 'c1', worldId, name: 'Hero', aliases: [], description: '', portraitImageId: 'link1', tags: [], isAlive: true, color: null, createdAt: 0, updatedAt: 0 })

    const json = await serializeWorldForSync(worldId)
    expect(json).toContain('https://cdn.example/hero.png')

    // Re-import into a clean database.
    await db.delete()
    await db.open()
    const newWorldId = await importWorldFromJson(json)

    const blob = await db.blobs.get('link1')
    expect(blob?.url).toBe('https://cdn.example/hero.png')
    expect(blob?.data).toBeUndefined()

    // The character still points at the linked blob.
    const chars = await db.characters.where('worldId').equals(newWorldId).toArray()
    expect(chars[0].portraitImageId).toBe('link1')
  })
})
