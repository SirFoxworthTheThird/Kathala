import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db } from '@/db/database'
import { applyWorldImport, serializeWorldForSync } from '@/lib/exportImport'
import { updateEvent } from '@/db/hooks/useTimeline'
import { deleteCharacter } from '@/db/hooks/useCharacters'
import { moveTo, inPositionOrder } from '@/lib/fractionalOrder'
import { readFolderSyncState, pushWorldToFolder, markPulled } from '@/features/worlds/folderSyncRunner'
import type { FolderBinding } from '@/lib/folderSync'
import type { Operation } from '@/types/operation'

/**
 * Two machines keeping one world in the same synced folder, driven through the
 * real runner rather than the pieces underneath it.
 *
 * `folderSyncState.test.ts` covers the state machine and `mergeDivergent.test.ts`
 * covers the merge, but nothing exercised the seam where they meet — and the
 * property that matters is only visible there. A sync system is judged on
 * convergence: after edits on both sides have travelled in both directions, the
 * two devices have to *agree*, not merely each end up with something reasonable.
 * That cannot be asserted from either half on its own.
 */

const W = 'w-folder'
const FILE = 'Divergent.pwk'

// ── A folder both devices can see ───────────────────────────────────────────
// Only the parts of the File System Access API the runner actually touches.

interface StoredFile { text: string; lastModified: number }

// No captured closures: the runner persists the handle into IndexedDB, and a
// function on it would fail to structured-clone where a real handle does not.
class FakeFolder {
  files = new Map<string, StoredFile>()

  read(name: string): string {
    const f = this.files.get(name)
    if (!f) throw new Error(`no such file: ${name}`)
    return f.text
  }

  // A prototype method, deliberately: an arrow-function property would be an
  // *own* property of the instance and structured clone would refuse it, where
  // a real directory handle clones fine. The Map is captured rather than `this`
  // for the same reason it is not aliased — it is the only part needed here.
  async getFileHandle(name: string, opts?: { create?: boolean }) {
    const files = this.files
    if (!files.has(name) && !opts?.create) {
      throw new DOMException(`no such file: ${name}`, 'NotFoundError')
    }
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
          // The filesystem stamps the file, not the writer — which is exactly
          // what the runner reads back rather than trusting its own clock.
          close: async () => { files.set(name, { text: buffer, lastModified: clock }) },
        }
      },
    }
  }
}

// ── Clock ───────────────────────────────────────────────────────────────────
// Real timestamps decide which side wins a scalar conflict, so the test has to
// own them. Date.now is stubbed rather than using fake timers, which deadlock
// against fake-indexeddb.

let clock = 1_000_000
/** Comfortably past MODIFIED_TOLERANCE_MS, so a write is seen as a real change. */
function tick(ms = 5_000) { clock += ms }

let folder: FakeFolder

// ── Devices ─────────────────────────────────────────────────────────────────
// One process, one IndexedDB, so a "device" is its own disk image: a .pwk of
// everything it holds. Booting one restores that image over the database.

interface Device {
  name: string
  image: string | null
  /** Device-local and deliberately absent from .pwk, so it is carried separately. */
  journal: Operation[]
  binding: FolderBinding
}

function newDevice(name: string): Device {
  return {
    name,
    image: null,
    journal: [],
    binding: {
      worldId: W,
      handle: folder as unknown as FileSystemDirectoryHandle,
      fileName: FILE,
      lastSyncedAt: 0,
    },
  }
}

async function clearAll() {
  await Promise.all(db.tables.map((t) => t.clear()))
}

/**
 * Run a block as `device`: restore its disk image and journal, do the work,
 * save both back.
 *
 * The journal has to be restored separately, because it is exactly what a `.pwk`
 * leaves out — and a replace-import clears it as a discontinuity. Without it
 * `latestSeq` would read 0 on every boot and the binding's `lastSyncedSeq`
 * comparison would report every device as clean, which is the one signal these
 * tests turn on.
 */
async function on<T>(device: Device, fn: () => Promise<T>): Promise<T> {
  await clearAll()
  if (device.image) await applyWorldImport(JSON.parse(device.image), 'replace')
  if (device.journal.length) await db.operations.bulkPut(device.journal)
  const result = await fn()
  device.image = await serializeWorldForSync(W)
  device.journal = await db.operations.where('worldId').equals(W).toArray()
  return result
}

/** Take the folder's copy and fold it into whatever this device already has. */
async function pull(device: Device) {
  await applyWorldImport(JSON.parse(folder.read(FILE)), 'merge')
  device.binding = await markPulled(W, device.binding)
}

async function stateOf(device: Device) {
  return (await readFolderSyncState(W, device.binding)).state
}

// ── The world both devices start from ───────────────────────────────────────

const character = (over: Record<string, unknown> = {}) => ({
  id: 'c-ana', worldId: W, name: 'Ana', description: '', aliases: [], tags: [],
  color: null, portraitImageId: null, isAlive: true, birthDate: null,
  createdAt: 1_000, updatedAt: 1_000, ...over,
})

const event = (over: Record<string, unknown> = {}) => ({
  id: 'ev-1', worldId: W, chapterId: 'ch-1', title: 'The Meeting', description: '',
  sortOrder: 1, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
  tags: [], threadIds: [], povCharacterId: null, locationMarkerId: null,
  status: 'draft', createdAt: 1_000, updatedAt: 1_000, ...over,
})

async function seed(events = [event()]) {
  await db.worlds.put({
    id: W, name: 'Divergent', description: '', coverImageId: null, theme: null,
    continuityStaleThreshold: 5, createdAt: 1_000, updatedAt: 1_000,
  } as never)
  await db.characters.put(character() as never)
  await db.events.bulkPut(events as never)
}

/** What the two devices have to agree on. */
async function storyState() {
  const byId = <T extends { id: string }>(rows: T[]) =>
    rows.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const [events, characters, tombstones] = await Promise.all([
    db.events.toArray(), db.characters.toArray(), db.tombstones.toArray(),
  ])
  return { events: byId(events), characters: byId(characters), tombstones: byId(tombstones) }
}

beforeEach(async () => {
  clock = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => clock)
  folder = new FakeFolder()
  await clearAll()
})

afterEach(() => { vi.restoreAllMocks() })

describe('a world shared through a synced folder', () => {
  it('converges after both devices edit offline and exchange through the folder', async () => {
    const a = newDevice('A')
    const b = newDevice('B')

    // A starts the world and puts it in the folder.
    await on(a, async () => {
      await seed()
      expect(await stateOf(a)).toBe('never-synced')
      tick()
      a.binding = await pushWorldToFolder(W, a.binding)
      expect(await stateOf(a)).toBe('in-sync')
    })

    // B picks it up from the folder for the first time.
    await on(b, async () => {
      await applyWorldImport(JSON.parse(folder.read(FILE)), 'replace')
      b.binding = await markPulled(W, b.binding)
      expect(await stateOf(b)).toBe('in-sync')
    })

    // ── Both go offline and edit the same scene, differently ────────────────
    // A adds someone to the cast first…
    tick()
    await on(a, async () => {
      await updateEvent('ev-1', { involvedCharacterIds: ['c-ana'] })
      // A has work the folder has not seen, and the folder has not moved.
      expect(await stateOf(a)).toBe('local-ahead')
    })

    // …and B retitles it afterwards, so B holds the later write.
    tick()
    await on(b, async () => {
      await updateEvent('ev-1', { title: 'The Reckoning' })
      expect(await stateOf(b)).toBe('local-ahead')
    })

    // A gets to the folder first.
    tick()
    await on(a, async () => {
      a.binding = await pushWorldToFolder(W, a.binding)
    })

    // ── B comes back to a folder that moved under it ────────────────────────
    await on(b, async () => {
      // Both sides moved: the one state auto-save refuses to resolve alone.
      expect(await stateOf(b)).toBe('conflict')

      await pull(b)

      const ev = await db.events.get('ev-1')
      // B's retitle is the later write, so it keeps the scalar…
      expect(ev?.title).toBe('The Reckoning')
      // …and A's cast addition still arrives on the back of the *older* record,
      // which is precisely what whole-record merge threw away.
      expect(ev?.involvedCharacterIds).toEqual(['c-ana'])

      tick()
      b.binding = await pushWorldToFolder(W, b.binding)
    })

    // ── A catches up ────────────────────────────────────────────────────────
    const bState = await on(b, storyState)

    const aState = await on(a, async () => {
      // A pushed and then did nothing, so only the folder has moved.
      expect(await stateOf(a)).toBe('remote-ahead')
      await pull(a)
      expect(await stateOf(a)).toBe('in-sync')
      return storyState()
    })

    // The point of the whole exercise: not "each device kept something
    // sensible" but "the two devices hold the same thing".
    expect(aState).toEqual(bState)
    expect(aState.events[0].title).toBe('The Reckoning')
    expect(aState.events[0].involvedCharacterIds).toEqual(['c-ana'])
  })

  it('keeps both reorders when each device moves a different card', async () => {
    const a = newDevice('A')
    const b = newDevice('B')

    await on(a, async () => {
      await seed([
        event({ id: 'ev-a', title: 'A', sortOrder: 1 }),
        event({ id: 'ev-b', title: 'B', sortOrder: 2 }),
        event({ id: 'ev-c', title: 'C', sortOrder: 3 }),
      ])
      tick()
      a.binding = await pushWorldToFolder(W, a.binding)
    })

    await on(b, async () => {
      await applyWorldImport(JSON.parse(folder.read(FILE)), 'replace')
      b.binding = await markPulled(W, b.binding)
    })

    /**
     * Drag a card, the way the board does: ask fractionalOrder where it goes and
     * write exactly what it says.
     *
     * The single-write assertion is the one that matters. Two devices converge
     * here only because each move touched one row; a `moveTo` that went back to
     * renumbering the column would still order this device correctly on its own
     * and only fall apart once the two were merged. Checking the write count
     * catches that at the point it is introduced rather than three steps later.
     */
    async function drag(id: string, toIndex: number) {
      const rows = (await db.events.toArray()).map((e) => ({ id: e.id, sortOrder: e.sortOrder }))
      const writes = moveTo(rows, id, toIndex)
      expect(writes).toHaveLength(1)
      for (const w of writes) await updateEvent(w.id, { sortOrder: w.sortOrder })
    }

    // A drags C to the front.
    tick()
    await on(a, async () => {
      await drag('ev-c', 0)
      tick()
      a.binding = await pushWorldToFolder(W, a.binding)
    })

    // B, not yet knowing about that, drags B to the end.
    tick()
    await on(b, async () => {
      await drag('ev-b', 2)
      expect(await stateOf(b)).toBe('conflict')
      await pull(b)
      tick()
      b.binding = await pushWorldToFolder(W, b.binding)
    })

    const order = async () =>
      inPositionOrder(await db.events.toArray()).map((e) => e.title)

    const bOrder = await on(b, order)
    const aOrder = await on(a, async () => { await pull(a); return order() })

    // Neither move was a renumbering, so neither had to overwrite the other.
    expect(bOrder).toEqual(['C', 'A', 'B'])
    expect(aOrder).toEqual(bOrder)
  })

  it('does not resurrect a character the other device deleted', async () => {
    const a = newDevice('A')
    const b = newDevice('B')

    await on(a, async () => {
      await seed()
      tick()
      a.binding = await pushWorldToFolder(W, a.binding)
    })

    await on(b, async () => {
      await applyWorldImport(JSON.parse(folder.read(FILE)), 'replace')
      b.binding = await markPulled(W, b.binding)
    })

    // A deletes Ana. The tombstone is what will carry that across.
    tick()
    await on(a, async () => {
      await deleteCharacter('c-ana')
      expect(await db.characters.get('c-ana')).toBeUndefined()
      tick()
      a.binding = await pushWorldToFolder(W, a.binding)
    })

    // B still holds her, and merging must not read "absent here" as "new there".
    await on(b, async () => {
      expect(await db.characters.get('c-ana')).toBeDefined()
      await pull(b)
      expect(await db.characters.get('c-ana')).toBeUndefined()
    })

    // The opposite case, so the deletion is not just an unconditional drop: an
    // edit made after the deletion means someone still wanted the record.
    const c = newDevice('C')
    await on(c, async () => {
      await applyWorldImport(JSON.parse(folder.read(FILE)), 'replace')
      c.binding = await markPulled(W, c.binding)
      // Re-create it locally, later than the tombstone, then merge again.
      await db.characters.put(character({ name: 'Ana the Quick', updatedAt: clock + 10_000 }) as never)
      await pull(c)
      expect((await db.characters.get('c-ana'))?.name).toBe('Ana the Quick')
    })
  })
})
