import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createCharacter, updateCharacter } from '@/db/hooks/useCharacters'
import { createTimeline, createChapter, createEvent, updateEvent } from '@/db/hooks/useTimeline'
import { makeSeries, addBook, leaveSeries } from '@/db/hooks/useSeries'
import { serializeSeries, readSeriesFile, importSeriesData } from '@/lib/exportImport'
import { saveFolderBinding, loadFolderBinding, type FolderBinding } from '@/lib/folderSync'
import {
  readFolderSyncState, pushWorldToFolder, pushConflictCopy, markPulled,
  loadSyncBinding, syncVersion, seriesFileName, autoSaveToFolder,
} from '@/features/worlds/folderSyncRunner'
import { previewSyncFile } from '@/features/worlds/cloudSyncHelpers'
import type { Operation } from '@/types/operation'

/*
  A series kept in a folder (issue #698): one file, the series and every book
  in it, since a book cannot come back over itself on its own. Driven through
  the real runner, on two devices that share the folder, as
  `folderSyncRoundTrip.test.ts` does for a world.
*/

interface StoredFile { text: string; lastModified: number }

let clock = 1_000_000
const tick = (ms = 5_000) => { clock += ms }

// As in folderSyncRoundTrip.test.ts: only what the runner touches, and no own functions, so it clones.
class FakeFolder {
  files = new Map<string, StoredFile>()
  read(name: string): string {
    const f = this.files.get(name)
    if (!f) throw new Error(`no such file: ${name}`)
    return f.text
  }
  async queryPermission() { return 'granted' as const }
  async getFileHandle(name: string, opts?: { create?: boolean }) {
    const files = this.files
    if (!files.has(name) && !opts?.create) throw new DOMException(`no such file: ${name}`, 'NotFoundError')
    return {
      getFile: async () => {
        const f = files.get(name)
        if (!f) throw new DOMException('gone', 'NotFoundError')
        return { lastModified: f.lastModified, text: async () => f.text }
      },
      createWritable: async () => {
        let buffer = ''
        return {
          write: async (chunk: string) => { buffer += chunk },
          close: async () => { files.set(name, { text: buffer, lastModified: clock }) },
        }
      },
    }
  }
}

let folder: FakeFolder

async function clearAll() {
  await Promise.all(db.tables.map((t) => t.clear()))
}

beforeEach(async () => {
  clock = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => clock)
  folder = new FakeFolder()
  await db.delete()
  await db.open()
})

afterEach(() => { vi.restoreAllMocks() })

async function scene(worldId: string, title: string) {
  const tl = await createTimeline({ worldId, name: 'Main', description: '', color: '#fff' })
  const ch = await createChapter({ worldId, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
  return createEvent({ worldId, chapterId: ch.id, timelineId: tl.id, title, description: '', locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0 })
}

/** The Salt Books: book one with Anna and a scene; book two with a scene. */
async function saltBooks() {
  const one = await createWorld({ name: 'The Salt Road', description: '' })
  const anna = await createCharacter({ worldId: one.id, name: 'Anna', description: '' })
  const s1 = await scene(one.id, 'The gate')
  const series = await makeSeries(one.id, 'The Salt Books')
  const two = await addBook(series.id, 'The Second Road')
  const s2 = await scene(two.id, 'The harbour')
  return { one, two, series, anna, s1, s2 }
}

const binding = (worldId: string, fileName: string): FolderBinding => ({
  worldId, handle: folder as unknown as FileSystemDirectoryHandle, fileName, lastSyncedAt: 0,
})

/**
 * A binding read back from IndexedDB, given the folder again: a real directory
 * handle survives the store, and the fake's methods, being its class's, do not.
 */
async function found(worldId: string): Promise<FolderBinding> {
  const b = await loadSyncBinding(worldId)
  if (!b) throw new Error('no binding')
  return { ...b, handle: folder as unknown as FileSystemDirectoryHandle }
}

const stateOf = async (b: FolderBinding) => (await readFolderSyncState(b.worldId, b)).state

describe('a book’s folder is its series’', () => {
  it('a book reads its series’ binding, and a save writes the whole series as one file', async () => {
    const { one, two, series } = await saltBooks()
    await saveFolderBinding(binding(series.id, seriesFileName(series.name)))
    // Either book finds the series' folder.
    expect((await loadSyncBinding(one.id))?.worldId).toBe(series.id)
    expect((await loadSyncBinding(two.id))?.worldId).toBe(series.id)
    const b = (await found(two.id))
    expect(await stateOf(b)).toBe('never-synced')
    tick()
    const pushed = await pushWorldToFolder(b.worldId, b)
    expect(await stateOf(pushed)).toBe('in-sync')
    // The file is the series' file: its cast once, and both books.
    const file = JSON.parse(folder.read('The_Salt_Books_series.pwk'))
    expect(file.type).toBe('series')
    expect(file.series.world.id).toBe(series.id)
    expect(file.series.characters.map((c: { name: string }) => c.name)).toEqual(['Anna'])
    expect(file.books.map((p: { world: { id: string } }) => p.world.id).sort()).toEqual([one.id, two.id].sort())
  })

  it('a world on its own keeps its own binding and its own file', async () => {
    const alone = await createWorld({ name: 'Alone', description: '' })
    await saveFolderBinding(binding(alone.id, 'Alone.pwk'))
    const b = (await found(alone.id))
    expect(b.worldId).toBe(alone.id)
    tick()
    await pushWorldToFolder(b.worldId, b)
    const file = JSON.parse(folder.read('Alone.pwk'))
    expect(file.type).not.toBe('series')
    expect(file.world.id).toBe(alone.id)
  })

  it('an edit in any book, or a book added or taken out, is the series’ edit', async () => {
    const { one, two, series, s2 } = await saltBooks()
    await saveFolderBinding(binding(series.id, seriesFileName(series.name)))
    let b = (await found(one.id))
    tick()
    b = await pushWorldToFolder(b.worldId, b)
    expect(await stateOf(b)).toBe('in-sync')
    // Book two's scene retitled: the series has moved, though book one has not.
    await updateEvent(s2.id, { title: 'The quay' })
    expect(await stateOf(b)).toBe('local-ahead')
    tick()
    b = await pushWorldToFolder(b.worldId, b)
    expect(await stateOf(b)).toBe('in-sync')
    // A book added, with nothing written in it yet.
    const three = await addBook(series.id, 'The Third Road')
    expect(await stateOf(b)).toBe('local-ahead')
    tick()
    b = await pushWorldToFolder(b.worldId, b)
    // And taken out again.
    await leaveSeries(three.id)
    expect(await stateOf(b)).toBe('local-ahead')
    expect(String(await syncVersion(series.id))).toContain(two.id)
    expect(String(await syncVersion(series.id))).not.toContain(three.id)
  })
})

describe('two devices keeping a series in one folder', () => {
  interface Device { image: string; journal: Operation[]; binding: FolderBinding }

  /** Run as a device: its library restored, the work done, the library kept again. */
  async function on<T>(device: Device, seriesId: string, fn: () => Promise<T>): Promise<T> {
    await clearAll()
    await importSeriesData(readSeriesFile(JSON.parse(device.image)), 'replace')
    await db.operations.clear()
    if (device.journal.length) await db.operations.bulkPut(device.journal)
    const result = await fn()
    device.image = await serializeSeries(seriesId)
    device.journal = await db.operations.toArray()
    return result
  }

  it('an edit in book two on one device reaches the other, through the series’ file', async () => {
    const { series, anna, s1, s2 } = await saltBooks()
    const name = seriesFileName(series.name)
    // A saves the series to the folder; B starts from the same series.
    let bindingA = binding(series.id, name)
    tick()
    bindingA = await pushWorldToFolder(series.id, bindingA)
    const start = await serializeSeries(series.id)
    const a: Device = { image: start, journal: await db.operations.toArray(), binding: bindingA }
    const b: Device = { image: start, journal: [], binding: binding(series.id, name) }
    await on(b, series.id, async () => { b.binding = await markPulled(series.id, b.binding) })

    // A retitles book two's scene and renames Anna, a book's edit and the series' cast's.
    tick()
    await on(a, series.id, async () => {
      await updateEvent(s2.id, { title: 'The quay' })
      await updateCharacter(anna.id, { name: 'Anna Vell' })
      expect(await stateOf(a.binding)).toBe('local-ahead')
      tick()
      a.binding = await pushWorldToFolder(series.id, a.binding)
    })

    // B sees the folder ahead, and the preview counts what comes, in the cast and in book two.
    await on(b, series.id, async () => {
      expect(await stateOf(b.binding)).toBe('remote-ahead')
      const { preview, apply } = await previewSyncFile(series.id, folder.read(name))
      expect(preview.events.updated).toBe(1)
      expect(preview.characters.updated).toBe(1)
      await apply('merge')
      b.binding = await markPulled(series.id, b.binding)
      expect(await stateOf(b.binding)).toBe('in-sync')
      expect((await db.events.get(s2.id))?.title).toBe('The quay')
      expect((await db.characters.get(anna.id))?.name).toBe('Anna Vell')
      expect((await db.characters.get(anna.id))?.worldId).toBe(series.id)
    })

    // Both edit, B first to the folder: A's next save cannot write over it, and goes to a side copy.
    tick()
    await on(b, series.id, async () => {
      await updateEvent(s1.id, { title: 'The gate at dusk' })
      tick()
      b.binding = await pushWorldToFolder(series.id, b.binding)
    })
    tick()
    await on(a, series.id, async () => {
      await updateEvent(s2.id, { title: 'The quay at dawn' })
      expect(await stateOf(a.binding)).toBe('conflict')
      a.binding = await pushConflictCopy(series.id, a.binding)
      expect(JSON.parse(folder.read(name)).books.flatMap((p: { events: Array<{ title: string }> }) => p.events.map((e) => e.title))).toContain('The gate at dusk')
      expect(JSON.parse(folder.read(a.binding.conflictFileName!)).type).toBe('series')
    })
  })

  it('a file of another series in the folder is not brought in', async () => {
    const { series } = await saltBooks()
    const other = await createWorld({ name: 'Other', description: '' })
    const otherSeries = await makeSeries(other.id, 'Other Books')
    const json = await serializeSeries(otherSeries.id)
    await expect(previewSyncFile(series.id, json)).rejects.toThrow(/another series/)
  })
})

describe('a book bound to a folder before it was in a series', () => {
  it('gives its folder to its series, for the series’ file, and its own binding goes', async () => {
    const one = await createWorld({ name: 'The Salt Road', description: '' })
    await saveFolderBinding(binding(one.id, 'The_Salt_Road.pwk'))
    const series = await makeSeries(one.id, 'The Salt Books')
    const b = (await found(one.id))
    expect(b).toMatchObject({ worldId: series.id, fileName: 'The_Salt_Books_series.pwk' })
    // The folder is the book's, given to its series; the book's own binding is gone.
    expect(await loadFolderBinding(one.id)).toBeNull()
    expect(await loadFolderBinding(series.id)).toMatchObject({ fileName: 'The_Salt_Books_series.pwk', handle: expect.anything() })
    // No series file there yet: the next save writes it.
    expect(await stateOf(b)).toBe('never-synced')
  })

  it('a series’ file another device put there is loaded or kept apart, never written over', async () => {
    const one = await createWorld({ name: 'The Salt Road', description: '' })
    await saveFolderBinding(binding(one.id, 'The_Salt_Road.pwk'))
    const series = await makeSeries(one.id, 'The Salt Books')
    // Another device got there first.
    folder.files.set('The_Salt_Books_series.pwk', { text: await serializeSeries(series.id), lastModified: clock })
    const b = (await found(one.id))
    expect(await stateOf(b)).toBe('remote-ahead')
    await scene(one.id, 'Written here since')
    expect(await stateOf(b)).toBe('conflict')
  })
})

describe('auto-save in a book of a series', () => {
  it('saves the series, whole, after an edit in a book, and nothing while the folder is in step', async () => {
    const { one, two, series, s2 } = await saltBooks()
    await saveFolderBinding(binding(series.id, seriesFileName(series.name)))
    const name = seriesFileName(series.name)
    // Nothing there yet: book two's look saves the series.
    tick()
    expect(await autoSaveToFolder(two.id, found)).toBe('saved')
    const first = folder.files.get(name)!
    expect(JSON.parse(first.text).type).toBe('series')
    // In step, a change the journal does not hold (a cursor moved, a panel opened) writes nothing.
    tick()
    expect(await autoSaveToFolder(one.id, found)).toBe('in-sync')
    expect(folder.files.get(name)).toBe(first)
    // An edit in book two, looked at from book one: the series is saved again, with it.
    await updateEvent(s2.id, { title: 'The quay' })
    tick()
    expect(await autoSaveToFolder(one.id, found)).toBe('saved')
    const titles = JSON.parse(folder.read(name)).books.flatMap((p: { events: Array<{ title: string }> }) => p.events.map((e) => e.title))
    expect(titles).toContain('The quay')
  })

  it('never writes over a series another device saved: left to load, or kept apart once this one has edits', async () => {
    const { one, series, s1 } = await saltBooks()
    const name = seriesFileName(series.name)
    await saveFolderBinding(binding(series.id, name))
    tick()
    expect(await autoSaveToFolder(one.id, found)).toBe('saved')
    // Another device saves the series to the folder.
    tick()
    const theirs = { text: folder.read(name).replace('"The gate"', '"The gate, theirs"'), lastModified: clock }
    folder.files.set(name, theirs)
    tick()
    expect(await autoSaveToFolder(one.id, found)).toBe('remote-ahead')
    expect(folder.files.get(name)).toBe(theirs)
    // And with an edit here too, this device's goes to a side copy.
    await updateEvent(s1.id, { title: 'The gate, ours' })
    tick()
    expect(await autoSaveToFolder(one.id, found)).toBe('conflict-copy')
    expect(folder.files.get(name)).toBe(theirs)
    expect([...folder.files.keys()].some((k) => k.includes('conflict copy'))).toBe(true)
  })

  it('a book with no folder, nor its series, is not saved', async () => {
    const { two } = await saltBooks()
    expect(await autoSaveToFolder(two.id, async (id) => loadSyncBinding(id))).toBe('unbound')
  })
})
