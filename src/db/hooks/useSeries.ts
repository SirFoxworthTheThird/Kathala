import { useLiveQuery } from 'dexie-react-hooks'
import type { Table } from 'dexie'
import { db, SHARED, bibleOf } from '@/db/database'
import { createWorld, deleteWorld } from '@/db/hooks/useWorlds'
import { generateId } from '@/lib/id'
import { ENTITY_TABLE } from '@/lib/entityTables'
import type { World } from '@/types'

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

/** Delete a series: each of its books, then the series and its bible. */
export async function deleteSeries(seriesId: string): Promise<void> {
  for (const book of await booksOf(seriesId)) await deleteWorld(book.id)
  await deleteWorld(seriesId)
}

/** Whether a world's shared rows are a series': it is a book of one. */
export const inSeries = (worldId: string): boolean => bibleOf(worldId) !== worldId
