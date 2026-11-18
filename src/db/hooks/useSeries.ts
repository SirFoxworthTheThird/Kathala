import { useLiveQuery } from 'dexie-react-hooks'
import { useParams } from 'react-router-dom'
import { useAppStore } from '@/store'
import type { Table } from 'dexie'
import { db, SHARED, bibleOf } from '@/db/database'
import { createWorld, deleteWorld } from '@/db/hooks/useWorlds'
import { generateId } from '@/lib/id'
import { ENTITY_TABLE } from '@/lib/entityTables'
import type { World } from '@/types'
import type { Tombstone } from '@/types/operation'
import { seriesAppearances, type Appearance, type BookRows } from '@/lib/seriesAppearances'
import { offerMatches, pairsProblem, joinIds, rewrite, embeddedOf, filledFrom, planLeave, type Offer, type Rows } from '@/lib/seriesJoin'

/*
  A series (issue #698, D-1): a world of its own kind that holds the bible its
  books share. Its books point to it by `seriesId`, in reading order by
  `seriesIndex`, and read its cast, items, places, factions and lore through
  `bibleOf`. Everything a book tells — timelines, chapters, scenes, prose and
  every record made at a scene — stays the book's.
*/

/** A series' books, in reading order. */
export async function booksOf(seriesId: string): Promise<World[]> {
  const books = await db.worlds.where('seriesId').equals(seriesId).toArray()
  return books.sort((a, b) => (a.seriesIndex ?? 0) - (b.seriesIndex ?? 0) || a.createdAt - b.createdAt)
}

export function useSeriesBooks(seriesId: string | null | undefined): World[] {
  return useLiveQuery(async () => (seriesId ? booksOf(seriesId) : []), [seriesId], [])
}

/** The series a book belongs to, or undefined for a book on its own. */
export function useSeriesOf(worldId: string | null | undefined): World | undefined {
  return useLiveQuery(async () => {
    if (!worldId) return undefined
    const world = await db.worlds.get(worldId)
    return world?.seriesId ? db.worlds.get(world.seriesId) : undefined
  }, [worldId])
}

/** Every value in a row, at its top level and in its arrays: where an image id may be named. */
function namedIn(row: unknown): string[] {
  const out: string[] = []
  for (const v of Object.values(row as Record<string, unknown>)) {
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) for (const x of v) if (typeof x === 'string') out.push(x)
  }
  return out
}

/** The tables a series is made in: the worlds, the bible's tables, images and tombstones. */
const seriesTables = (): Table[] => [db.worlds, ...SHARED.map((t) => db.table(t)), db.blobs, db.tombstones]

/**
 * Make a series of a book (D-1). The series is made, the book becomes its
 * first, and the book's cast, items, places and maps, factions and lore move to
 * the series, with the images they show and the tombstones of those deleted,
 * all in one transaction: a page closed part-way leaves the book as it was.
 * The book's own story, and its journal, stay where they are.
 */
export async function makeSeries(worldId: string, name: string): Promise<World> {
  const book = await db.worlds.get(worldId)
  if (!book) throw new Error('That book is not there.')
  if (book.seriesId) throw new Error(`"${book.name}" is already a book of a series.`)
  if (book.kind === 'series') throw new Error(`"${book.name}" is a series.`)
  const now = Date.now()
  const series: World = {
    id: generateId(),
    name: name.trim() || `${book.name} series`,
    description: '',
    coverImageId: null,
    theme: null,
    continuityStaleThreshold: book.continuityStaleThreshold,
    kind: 'series',
    createdAt: now,
    updatedAt: now,
  }
  await db.transaction('rw', seriesTables(), async () => {
    await db.worlds.add(series)
    const named = new Set<string>()
    for (const name of SHARED) {
      const rows = await db.table(name).where('worldId').equals(worldId).toArray()
      for (const row of rows) for (const v of namedIn(row)) named.add(v)
      await db.table(name).where('worldId').equals(worldId).modify({ worldId: series.id })
    }
    await db.blobs.where('worldId').equals(worldId).filter((b) => named.has(b.id)).modify({ worldId: series.id })
    const sharedEntities = new Set(Object.entries(ENTITY_TABLE).filter(([, t]) => (SHARED as readonly string[]).includes(t)).map(([e]) => e))
    await db.tombstones.where('worldId').equals(worldId).filter((t) => sharedEntities.has(t.entityType)).modify({ worldId: series.id })
    // Last, so the rows above move by the book's own id; from here the book reads its bible in the series.
    await db.worlds.update(worldId, { seriesId: series.id, seriesIndex: 1, updatedAt: now })
  })
  return series
}

/** A new book at the end of a series, reading the series' bible from its first page. */
export async function addBook(seriesId: string, name: string): Promise<World> {
  const series = await db.worlds.get(seriesId)
  if (series?.kind !== 'series') throw new Error('That is not a series.')
  const books = await booksOf(seriesId)
  const world = await createWorld({ name: name.trim() || `Book ${books.length + 1}`, description: '' })
  await db.worlds.update(world.id, { seriesId, seriesIndex: (books.at(-1)?.seriesIndex ?? books.length) + 1 })
  return { ...world, seriesId, seriesIndex: (books.at(-1)?.seriesIndex ?? books.length) + 1 }
}

/**
 * Where each of the series' people, items and places appears, book by book
 * (part 4): empty for a book on its own. Read live, since a scene written in any
 * book changes it.
 */
export function useSeriesAppearances(worldId: string | null | undefined): Map<string, Appearance[]> {
  return useLiveQuery(async () => (worldId && inSeries(worldId) ? appearancesIn(bibleOf(worldId)) : NO_APPEARANCES), [worldId], NO_APPEARANCES)
}

const NO_APPEARANCES = new Map<string, Appearance[]>()

/** Each entity's appearances across a series' books. */
export async function appearancesIn(seriesId: string): Promise<Map<string, Appearance[]>> {
  const books: BookRows[] = []
  for (const book of await booksOf(seriesId)) {
    const by = <T,>(table: string) => db.table(table).where('worldId').equals(book.id).toArray() as Promise<T[]>
    books.push({
      book,
      events: await by('events'),
      characterSnapshots: await by('characterSnapshots'),
      itemCustody: await by('itemCustody'),
      itemSnapshots: await by('itemSnapshots'),
      itemPlacements: await by('itemPlacements'),
      locationSnapshots: await by('locationSnapshots'),
    })
  }
  return seriesAppearances(books)
}

/** Every series on the shelf, by name: what a book may join. */
export function useAllSeries(): World[] {
  return useLiveQuery(async () => (await db.worlds.toArray()).filter((w) => w.kind === 'series').sort((a, b) => a.name.localeCompare(b.name)), [], [])
}

/**
 * What Join a series offers a book for a series, live, with the book and series
 * it was read for: a read for the last pair can still be what is in hand while
 * the next is read. Undefined until there is one.
 */
export function useJoinOffers(worldId: string | null, seriesId: string | null): { for: string; offers: Offer[] } | undefined {
  return useLiveQuery(
    async () => (worldId && seriesId ? { for: `${worldId}|${seriesId}`, offers: await joinOffers(worldId, seriesId) } : undefined),
    [worldId, seriesId],
  )
}

/** A book's copies and the series' records they may be: what Join a series offers. */
export async function joinOffers(worldId: string, seriesId: string): Promise<Offer[]> {
  const [bible, book] = await Promise.all([rowsOf(seriesId, SHARED), rowsOf(worldId, SHARED)])
  return offerMatches(bible, book)
}

async function rowsOf(worldId: string, tables: readonly string[]): Promise<Rows> {
  const out: Rows = {}
  for (const t of tables) out[t] = (await db.table(t).where('worldId').equals(worldId).toArray()) as Rows[string]
  return out
}

export interface Joined {
  /** Copies removed, each now the series' own. */
  matched: number
  /** The book's own shared records that joined the series' bible. */
  added: number
}

/**
 * Join a book written on its own, or made with Start a sequel, to the end of a
 * series (part 3). `pairs` is what the writer confirmed: each of the book's
 * copies and the series' record it is. In one transaction, every row the book
 * has is rewritten to point at the series' records instead of the copies — its
 * scenes' casts and places, every record made at a scene, its notes and tasks,
 * the warnings it dismissed — and the copies are removed. A copy fills what the
 * series' record has left empty. The book's other shared records join the
 * series' bible, with their images and tombstones. The book's journal is reset:
 * its operations name the copies, and an undo would bring one back.
 */
export async function joinSeries(worldId: string, seriesId: string, pairs: Map<string, string>): Promise<Joined> {
  const [book, series] = await Promise.all([db.worlds.get(worldId), db.worlds.get(seriesId)])
  if (!book) throw new Error('That book is not there.')
  if (series?.kind !== 'series') throw new Error('That is not a series.')
  if (book.seriesId) throw new Error(`"${book.name}" is already a book of a series.`)
  if (book.kind === 'series') throw new Error(`"${book.name}" is a series.`)
  const tables = db.tables.map((t) => t.name).filter((t) => t !== 'worlds' && t !== 'operations')
  const shared = new Set<string>(SHARED)
  let result: Joined = { matched: 0, added: 0 }

  await db.transaction('rw', db.tables, async () => {
    const bible = await rowsOf(seriesId, SHARED)
    const mine = await rowsOf(worldId, tables)
    const problem = pairsProblem(offerMatches(bible, mine), pairs)
    if (problem) throw new Error(problem)
    const ids = joinIds(bible, mine, pairs)
    const embedded = embeddedOf(ids)
    const now = Date.now()
    const theirs = new Map<string, { table: string; row: NonNullable<Rows[string]>[number] }>(SHARED.flatMap((t) => (bible[t] ?? []).map((r) => [r.id, { table: t, row: r }] as [string, { table: string; row: typeof r }])))
    const dropped: Rows[string] = []
    let added = 0

    for (const t of tables) {
      if (t === 'blobs' || t === 'tombstones') continue
      for (const row of mine[t] ?? []) {
        if (shared.has(t) && ids.has(row.id)) {
          // A copy: the series' record takes its place, with what it adds.
          dropped.push(row)
          const target = theirs.get(ids.get(row.id)!)
          // The copy as the series will read it: a custom field linking to another copy links to the series' record.
          const filled = target && filledFrom(target.row, rewrite(row, ids, embedded))
          if (filled) {
            await db.table(target.table).put({ ...filled, updatedAt: now, version: ((filled.version as number | undefined) ?? 1) + 1 })
            target.row = filled
          }
          await db.table(t).delete(row.id)
          continue
        }
        const next = rewrite(row, ids, embedded)
        if (shared.has(t)) {
          next.worldId = seriesId
          added++
        }
        if (next.id !== row.id) await db.table(t).delete(row.id)
        if (next.id !== row.id || JSON.stringify(next) !== JSON.stringify(row)) await db.table(t).put(next)
      }
    }

    // Images: the ones the bible's records now show go with it; one only a removed copy showed goes.
    const shown = new Set<string>()
    for (const t of SHARED) {
      for (const r of await db.table(t).where('worldId').equals(seriesId).toArray()) for (const v of namedIn(r)) shown.add(v)
    }
    const stillMine = new Set<string>()
    for (const t of tables) {
      if (shared.has(t) || t === 'blobs') continue
      for (const r of await db.table(t).where('worldId').equals(worldId).toArray()) for (const v of namedIn(r)) stillMine.add(v)
    }
    const copiesShowed = new Set(dropped.flatMap(namedIn))
    if (book.coverImageId) stillMine.add(book.coverImageId)
    for (const blob of mine.blobs ?? []) {
      if (shown.has(blob.id)) await db.blobs.update(blob.id, { worldId: seriesId })
      else if (copiesShowed.has(blob.id) && !stillMine.has(blob.id)) await db.blobs.delete(blob.id)
    }

    // Tombstones: pointed like everything else; a shared record's go to the series, as makeSeries moves them.
    const sharedEntities = new Set(Object.entries(ENTITY_TABLE).filter(([, t]) => shared.has(t)).map(([e]) => e))
    for (const stone of mine.tombstones ?? []) {
      const next = rewrite(stone, ids, embedded)
      if (sharedEntities.has(String(next.entityType))) next.worldId = seriesId
      if (next.id !== stone.id) await db.tombstones.delete(stone.id)
      await db.tombstones.put(next as unknown as Tombstone)
    }

    await db.operations.where('worldId').equals(worldId).delete()
    const books = await db.worlds.where('seriesId').equals(seriesId).toArray()
    const last = Math.max(0, ...books.map((b) => b.seriesIndex ?? 0))
    // Last, so every row above moved by the book's own id; from here the book reads its bible in the series.
    await db.worlds.put({ ...rewrite(book, ids, embedded), seriesId, seriesIndex: last + 1, updatedAt: now })
    result = { matched: dropped.length, added }
  })
  return result
}

/**
 * Take a book out of its series (issue #698): it becomes a book on its own,
 * with its own copy of everything the series shares, so an edit on either side
 * no longer reaches the other. Its scenes, states, notes and every other row it
 * has point at its copies. What is kept to it (\`onlyInBook\`) goes with it; what
 * is kept to another book stays. The pictures its copies show are copied too.
 * Its journal is reset, since its operations name the series' records. The
 * books left are numbered again, in order. One transaction.
 */
export async function leaveSeries(bookId: string): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await leaveSeriesNow(bookId)
  })
}

async function leaveSeriesNow(bookId: string): Promise<void> {
  const book = await db.worlds.get(bookId)
  if (!book?.seriesId) throw new Error('That book is not in a series.')
  const seriesId = book.seriesId
  const bible = await rowsOf(seriesId, SHARED)
  const plan = planLeave(bible, bookId, generateId)
  // The pictures the book's records will show: copied under new ids, so deleting the series' leaves the book's.
  const shown = new Set<string>()
  for (const t of SHARED) for (const r of bible[t] ?? []) if (!plan.leftBehind.has(r.id)) for (const v of namedIn(r)) shown.add(v)
  const pictures = (await db.blobs.where('worldId').equals(seriesId).toArray()).filter((b) => shown.has(b.id))
  for (const b of pictures) plan.ids.set(b.id, generateId())
  const embedded = embeddedOf(plan.ids)

  // First, out of the series: from here a row written with the book's id stays the book's.
  await db.worlds.update(bookId, { seriesId: undefined, seriesIndex: undefined, readEarlierBooks: undefined, updatedAt: Date.now() })

  for (const t of SHARED) {
    for (const row of bible[t] ?? []) {
      if (plan.leftBehind.has(row.id)) continue
      const { onlyInBook, ...rest } = rewrite(row, plan.ids, embedded) as typeof row & { onlyInBook?: string | null }
      void onlyInBook
      await db.table(t).put({ ...rest, worldId: bookId })
    }
  }
  for (const b of pictures) await db.blobs.put({ ...b, id: plan.ids.get(b.id)!, worldId: bookId })

  // Every row of the book's own, pointed at its copies.
  const own = db.tables.map((t) => t.name).filter((t) => t !== 'worlds' && t !== 'operations' && t !== 'blobs' && !(SHARED as readonly string[]).includes(t))
  for (const t of own) {
    for (const row of await db.table(t).where('worldId').equals(bookId).toArray()) {
      const next = rewrite(row, plan.ids, embedded)
      if (next.id !== row.id) await db.table(t).delete(row.id)
      if (next.id !== row.id || JSON.stringify(next) !== JSON.stringify(row)) await db.table(t).put(next)
    }
  }
  await db.operations.where('worldId').equals(bookId).delete()
  const stays = await db.worlds.get(bookId)
  if (stays) await db.worlds.put(rewrite(stays, plan.ids, embedded))

  // The books left, numbered again from one.
  const left = (await db.worlds.where('seriesId').equals(seriesId).toArray()).sort((a, b) => (a.seriesIndex ?? 0) - (b.seriesIndex ?? 0))
  for (const [k, b] of left.entries()) if (b.seriesIndex !== k + 1) await db.worlds.update(b.id, { seriesIndex: k + 1 })
}

/**
 * Undo a series and keep its books (issue #698): each book leaves with its own
 * copy of what the series shared, as \`leaveSeries\` does, and then the series
 * and its records are deleted. One transaction.
 */
export async function dissolveSeries(seriesId: string): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    const series = await db.worlds.get(seriesId)
    if (series?.kind !== 'series') throw new Error('That is not a series.')
    for (const book of await booksOf(seriesId)) await leaveSeriesNow(book.id)
    await deleteWorld(seriesId)
  })
}

/** Delete a series: each of its books, then the series and its bible. */
export async function deleteSeries(seriesId: string): Promise<void> {
  for (const book of await booksOf(seriesId)) await deleteWorld(book.id)
  await deleteWorld(seriesId)
}

/** Whether a world's shared rows are a series': it is a book of one. */
export const inSeries = (worldId: string): boolean => bibleOf(worldId) !== worldId

/**
 * The book a screen about a shared entity is showing it in (issue #698). A
 * shared character's own \`worldId\` is its series', not the book open: its
 * scenes, chapters and states are the book's, read by the book's id. The book
 * in the address first, then the book open, then the entity's own world, which
 * is the book for one not in a series.
 */
export function useBookOf(entity: { worldId: string }): string {
  const { worldId } = useParams<{ worldId: string }>()
  const active = useAppStore((s) => s.activeWorldId)
  return worldId ?? active ?? entity.worldId
}
