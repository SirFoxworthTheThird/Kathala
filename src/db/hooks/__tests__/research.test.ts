import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld, deleteWorld } from '@/db/hooks/useWorlds'
import { createCharacter, deleteCharacter } from '@/db/hooks/useCharacters'
import { createItem, deleteItem } from '@/db/hooks/useItems'
import { createLocationMarker, deleteLocationMarker } from '@/db/hooks/useLocationMarkers'
import { createTimeline, createChapter, createEvent, deleteChapter, deleteEvent, deleteTimeline } from '@/db/hooks/useTimeline'
import { undoLast } from '@/db/hooks/useOperations'
import { makeSeries } from '@/db/hooks/useSeries'
import {
  addResearchClip, addResearchFile, addResearchLink, attachResearch, deleteResearchItem, detachResearch, reorderResearch, updateResearchItem,
} from '@/db/hooks/useResearch'
import { applyWorldImport, importWorldFromJson, previewWorldMerge, serializeWorldForSync } from '@/lib/exportImport'
import { MAX_FILE_BYTES } from '@/lib/research'

/**
 * Research and reference material in the store (issue #700): files kept as
 * they came, links and clippings, attached and taken off, journalled with
 * their files, taken off what is deleted without being lost, the series', and
 * carried by a backup with or without their files (D-3).
 *
 * In jsdom a Blob stored in fake-indexeddb comes back as a plain object, so
 * these check the rows: that the file's row is there, which backup carries it.
 * That a file's bytes come back as they went is `e2e/research.spec.ts`'s, in
 * a browser.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function book() {
  const world = await createWorld({ name: 'Saltmouth', description: '' })
  const tl = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#888' })
  const ch = await createChapter({ worldId: world.id, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
  const ev = (k: number) => createEvent({ worldId: world.id, chapterId: ch.id, timelineId: tl.id, title: `S${k}`, description: '', locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: k })
  const s1 = await ev(0)
  const s2 = await ev(1)
  const anna = await createCharacter({ worldId: world.id, name: 'Anna', description: '' })
  const ledger = await createItem({ worldId: world.id, name: 'The ledger', description: '', iconType: 'other', tags: [] })
  const quay = await createLocationMarker({ worldId: world.id, mapLayerId: null, name: 'The quay', description: '', iconType: 'landmark' })
  return { world, ch, s1, s2, anna, ledger, quay }
}

const png = (bytes = 8) => new File([new Uint8Array(bytes).fill(7)], 'harbour at dawn.png', { type: 'image/png' })
const all = () => db.researchItems.toArray()

describe('adding research', () => {
  it('a file is stored as it came, in blobs, never in the record; named by its file', async () => {
    const { world, s1 } = await book()
    const item = await addResearchFile(world.id, png(64), { attachedTo: [{ kind: 'scene', id: s1.id }] })
    expect(item).toMatchObject({ kind: 'file', title: 'harbour at dawn', mimeType: 'image/png', size: 64, fileName: 'harbour at dawn.png', attachedTo: [{ kind: 'scene', id: s1.id }] })
    const stored = await db.researchItems.get(item.id)
    expect(JSON.stringify(stored)).not.toMatch(/data/)
    const blob = await db.blobs.get(item.blobId!)
    expect(blob).toMatchObject({ id: item.blobId, mimeType: 'image/png', worldId: world.id })
  })

  it('a file over 20 MB, or not an image or PDF, is refused, and nothing is stored', async () => {
    const { world } = await book()
    const big = new File([new Uint8Array(1)], 'big.pdf', { type: 'application/pdf' })
    Object.defineProperty(big, 'size', { value: MAX_FILE_BYTES + 1 })
    await expect(addResearchFile(world.id, big)).rejects.toThrow('A research file can be at most 20 MB')
    await expect(addResearchFile(world.id, new File(['x'], 'a.txt', { type: 'text/plain' }))).rejects.toThrow('is not an image or a PDF')
    expect([await db.researchItems.count(), await db.blobs.count()]).toEqual([0, 0])
  })

  it('a link is kept as an address and named by its host; a clipping by its first line, with its source', async () => {
    const { world } = await book()
    const link = await addResearchLink(world.id, ' https://tides.example.org/saltmouth ', { toWorld: true })
    expect(link).toMatchObject({ kind: 'link', url: 'https://tides.example.org/saltmouth', title: 'tides.example.org', toWorld: true })
    await expect(addResearchLink(world.id, 'javascript:alert(1)')).rejects.toThrow('http:// or https://')
    const clip = await addResearchClip(world.id, 'I shall weigh true.\nAnd keep the ledger open.', ' Guild rules, 1790 ')
    expect(clip).toMatchObject({ kind: 'clip', title: 'I shall weigh true.', text: 'I shall weigh true.\nAnd keep the ledger open.', source: 'Guild rules, 1790' })
    await expect(addResearchClip(world.id, '  ', '')).rejects.toThrow('A clipping needs its words.')
    expect((await all()).map((i) => i.order).sort()).toEqual([0, 1])
  })
})

describe('changing research', () => {
  it('attaches, takes off, renames and reorders, each one undo', async () => {
    const { world, s1, anna } = await book()
    const a = await addResearchLink(world.id, 'https://a.example.org')
    const b = await addResearchLink(world.id, 'https://b.example.org')
    await attachResearch(a.id, { kind: 'scene', id: s1.id })
    await attachResearch(a.id, { kind: 'scene', id: s1.id })
    await attachResearch(a.id, { kind: 'character', id: anna.id })
    expect((await db.researchItems.get(a.id))?.attachedTo).toEqual([{ kind: 'scene', id: s1.id }, { kind: 'character', id: anna.id }])
    await detachResearch(a.id, { kind: 'scene', id: s1.id })
    expect((await db.researchItems.get(a.id))?.attachedTo).toEqual([{ kind: 'character', id: anna.id }])
    await undoLast(world.id)
    expect((await db.researchItems.get(a.id))?.attachedTo).toHaveLength(2)

    await updateResearchItem(a.id, { title: 'Harbour tides', note: 'Spring tides in March' })
    expect(await db.researchItems.get(a.id)).toMatchObject({ title: 'Harbour tides', note: 'Spring tides in March' })
    await expect(updateResearchItem(a.id, { url: 'nope' })).rejects.toThrow('not a web address')

    await reorderResearch([b.id, a.id])
    expect([(await db.researchItems.get(b.id))?.order, (await db.researchItems.get(a.id))?.order]).toEqual([0, 1])
    await undoLast(world.id)
    expect([(await db.researchItems.get(a.id))?.order, (await db.researchItems.get(b.id))?.order]).toEqual([0, 1])
  })

  it('deleting an item deletes its file, with a tombstone; one undo brings both back', async () => {
    const { world } = await book()
    const item = await addResearchFile(world.id, png())
    await deleteResearchItem(item.id)
    expect(await db.researchItems.get(item.id)).toBeUndefined()
    expect(await db.blobs.get(item.blobId!)).toBeUndefined()
    expect(await db.tombstones.where('entityId').equals(item.id).count()).toBe(1)
    await undoLast(world.id)
    expect(await db.researchItems.get(item.id)).toBeDefined()
    expect(await db.blobs.get(item.blobId!)).toMatchObject({ mimeType: 'image/png' })
  })
})

describe('what is deleted takes its attachments, not the research (D-5)', () => {
  it('a scene, a chapter, a character, an item and a place each leave the research, attached to them no longer', async () => {
    const { world, ch, s1, s2, anna, ledger, quay } = await book()
    const r = await addResearchLink(world.id, 'https://a.example.org', {
      attachedTo: [{ kind: 'scene', id: s1.id }, { kind: 'scene', id: s2.id }, { kind: 'character', id: anna.id }, { kind: 'item', id: ledger.id }, { kind: 'place', id: quay.id }],
    })
    const on = async () => (await db.researchItems.get(r.id))!.attachedTo.map((l) => l.kind).sort()

    await deleteEvent(s1.id)
    expect(await on()).toEqual(['character', 'item', 'place', 'scene'])
    await undoLast(world.id)
    expect(await on()).toEqual(['character', 'item', 'place', 'scene', 'scene'])

    await deleteCharacter(anna.id)
    await deleteItem(ledger.id)
    await deleteLocationMarker(quay.id)
    expect(await on()).toEqual(['scene', 'scene'])
    await undoLast(world.id)
    expect(await on()).toEqual(['place', 'scene', 'scene'])

    await deleteChapter(ch.id)
    expect(await on()).toEqual(['place'])
    // The item stays, and with nothing left would be listed as attached to nothing.
    expect(await db.researchItems.count()).toBe(1)
  })

  it('a timeline leaves the research on its scenes, and its undo puts it back', async () => {
    const { world, s1, s2, anna } = await book()
    const r = await addResearchLink(world.id, 'https://a.example.org', {
      attachedTo: [{ kind: 'scene', id: s1.id }, { kind: 'scene', id: s2.id }, { kind: 'character', id: anna.id }],
    })
    const on = async () => (await db.researchItems.get(r.id))!.attachedTo.map((l) => l.kind).sort()
    await deleteTimeline(s1.timelineId)
    expect(await on()).toEqual(['character'])
    await undoLast(world.id)
    expect(await on()).toEqual(['character', 'scene', 'scene'])
  })

  it('a world takes its research with it', async () => {
    const { world } = await book()
    await addResearchClip(world.id, 'Words.', '')
    await deleteWorld(world.id)
    expect(await db.researchItems.count()).toBe(0)
  })
})

describe('research in a series (D-4)', () => {
  it('is the series’, with its files', async () => {
    const { world } = await book()
    const item = await addResearchFile(world.id, png())
    const series = await makeSeries(world.id, 'The Salt Books')
    expect((await db.researchItems.get(item.id))?.worldId).toBe(series.id)
    expect((await db.blobs.get(item.blobId!))?.worldId).toBe(series.id)
    const later = await addResearchClip(world.id, 'Made in the book.', '')
    expect(later.worldId).toBe(series.id)
  })
})

describe('research in a backup (D-3)', () => {
  it('travels with its files, or without them, saying so in neither case by losing an item', async () => {
    const { world, s1 } = await book()
    const file = await addResearchFile(world.id, png(16), { attachedTo: [{ kind: 'scene', id: s1.id }] })
    await addResearchLink(world.id, 'https://a.example.org')
    // So it can be serialized here, where a stored Blob does not come back as one: the row, by its id, is what is checked.
    await db.blobs.update(file.blobId!, { data: undefined, url: 'https://files.example.org/harbour.png' })
    const whole = JSON.parse(await serializeWorldForSync(world.id))
    expect(whole.version).toBeGreaterThanOrEqual(23)
    expect(whole.researchItems).toHaveLength(2)
    expect(whole.blobs.map((b: { id: string }) => b.id)).toContain(file.blobId)
    const bare = JSON.parse(await serializeWorldForSync(world.id, { withoutResearchFiles: true }))
    expect(bare.researchItems).toHaveLength(2)
    expect(bare.blobs.map((b: { id: string }) => b.id)).not.toContain(file.blobId)

    // Brought back over the world here, without its files: the file here is kept.
    await importWorldFromJson(JSON.stringify(bare))
    expect(await db.blobs.get(file.blobId!)).toMatchObject({ mimeType: 'image/png' })
    // Into a library that has never had it: the item comes, its file does not.
    await deleteWorld(world.id)
    await db.blobs.clear()
    await importWorldFromJson(JSON.stringify(bare))
    expect(await db.researchItems.get(file.id)).toMatchObject({ title: 'harbour at dawn', attachedTo: [{ kind: 'scene', id: s1.id }] })
    expect(await db.blobs.get(file.blobId!)).toBeUndefined()
    // And the whole backup brings the file.
    await importWorldFromJson(JSON.stringify(whole))
    expect(await db.blobs.get(file.blobId!)).toMatchObject({ mimeType: 'image/png' })

    // A file before research imports as none.
    const older = { ...whole, version: 22 }
    delete older.researchItems
    await importWorldFromJson(JSON.stringify(older))
    expect(await db.researchItems.count()).toBe(0)
  })

  it('merge: an item made there arrives, and one deleted here is not brought back', async () => {
    const { world } = await book()
    const kept = await addResearchLink(world.id, 'https://kept.example.org')
    const gone = await addResearchLink(world.id, 'https://gone.example.org')
    const theirs = JSON.parse(await serializeWorldForSync(world.id))
    theirs.researchItems.push({ ...kept, id: 'from-there', title: 'Made there', url: 'https://there.example.org', order: 5 })
    await deleteResearchItem(gone.id)
    await applyWorldImport((await previewWorldMerge(JSON.stringify(theirs))).parsed, 'merge')
    expect((await all()).map((i) => i.title).sort()).toEqual(['Made there', 'kept.example.org'])
  })
})
