import { useLiveQuery } from 'dexie-react-hooks'
import { db, bibleOf } from '@/db/database'
import { loadStory } from './useStory'
import { stateAt } from '@/lib/stateAt'
import type { PersonRecord } from '@/lib/personState'
import type { FieldValue, ItemCustody, ItemSnapshot, LocationSnapshot, MapRegionSnapshot, World } from '@/types'

/*
  Each book of a series opens where the book before it ended (issue #698, D-2).

  For a book after the first, every shared character, item, place and region
  starts from its state at the last scene of the book before: alive or dead,
  where they are and how they travel, what they carry, an item's condition, a
  place's and a region's state. A relationship's state stays in its book.

  Nothing is stored. The opening is a set of records made when read, from the
  book before as it stands: a correction there shows here at once. Each is put
  before this book's first scene by its `sortKey` (`OPENING_KEY`), at a scene no
  story has, so every resolver reads it as the earliest record, in every era,
  and a record this book makes overrides it from that scene on. A book's own
  records stay its own (`inBook`); the opening is added to them, where state is
  read, by `withOpening`.

  The end of a book is its last scene in book order. In a book of several
  eras, that is the last scene's era: a character only in another era's
  timeline at the end is not carried.
*/

/** Before every chapter: a stored position the opening records sort by. */
export const OPENING_KEY = -0.5

/** The scene the opening records of `bookId` are said at: one no story has. */
export const openingScene = (bookId: string) => `opening:${bookId}`

/** Whether a record is one of an opening's, made when read, not stored. */
export const isOpening = (record: { eventId: string }) => record.eventId.startsWith('opening:')

export interface Opening {
  /** The book it is the end of; null for a book that opens on nothing. */
  from: World | null
  people: PersonRecord[]
  custody: ItemCustody[]
  items: ItemSnapshot[]
  places: LocationSnapshot[]
  regions: MapRegionSnapshot[]
  /** Custom fields' values over time (issue #699): each as it stood at the end of the book before. */
  fields: FieldValue[]
}

export const NO_OPENING: Opening = Object.freeze({ from: null, people: [], custody: [], items: [], places: [], regions: [], fields: [] }) as Opening

export type OpeningKind = 'people' | 'custody' | 'items' | 'places' | 'regions' | 'fields'
const ALL: readonly OpeningKind[] = ['people', 'custody', 'items', 'places', 'regions', 'fields']

/** The book before `worldId` in its series, or undefined for a first book or one on its own. */
export async function bookBefore(worldId: string): Promise<World | undefined> {
  const book = await db.worlds.get(worldId)
  if (!book?.seriesId || !book.seriesIndex) return undefined
  const books = await db.worlds.where('seriesId').equals(book.seriesId).toArray()
  return books
    .filter((b) => (b.seriesIndex ?? 0) < book.seriesIndex!)
    .sort((a, b) => (b.seriesIndex ?? 0) - (a.seriesIndex ?? 0))[0]
}

/**
 * How `worldId` opens: the state each shared entity ended the book before in,
 * as records before this book's first scene. Only the kinds asked for are
 * read, so a write inside a transaction reads only the tables it names.
 */
export async function openingOf(worldId: string, kinds: readonly OpeningKind[] = ALL, depth = 0): Promise<Opening> {
  const before = await bookBefore(worldId)
  // A series is short; a loop in its order is a fault, and opens on nothing rather than without end.
  if (!before || depth > 50) return NO_OPENING
  const want = new Set(kinds)
  /*
    Each read awaited on its own, and only the kinds asked for: a write calls
    this inside a transaction, where awaiting anything but IndexedDB (a plain
    \`Promise.resolve\` for a kind not wanted) lets the transaction commit early.
  */
  const prior = await openingOf(before.id, kinds, depth + 1)
  const story = await loadStory(before.id)
  const events = await db.events.where('worldId').equals(before.id).toArray()
  const people: PersonRecord[] = want.has('people') ? await db.characterSnapshots.where('worldId').equals(before.id).toArray() : []
  const custody: ItemCustody[] = want.has('custody') ? await db.itemCustody.where('worldId').equals(before.id).toArray() : []
  const items: ItemSnapshot[] = want.has('items') ? await db.itemSnapshots.where('worldId').equals(before.id).toArray() : []
  const places: LocationSnapshot[] = want.has('places') ? await db.locationSnapshots.where('worldId').equals(before.id).toArray() : []
  const regions: MapRegionSnapshot[] = want.has('regions') ? await db.mapRegionSnapshots.where('worldId').equals(before.id).toArray() : []
  const fieldRows: FieldValue[] = want.has('fields') ? await db.fieldValues.where('worldId').equals(before.id).toArray() : []
  const defs = want.has('fields') ? await db.customFieldDefs.where('worldId').equals(bibleOf(before.id)).toArray() : []
  const things = want.has('custody') || want.has('items') || want.has('fields') ? await db.items.where('worldId').equals(bibleOf(before.id)).toArray() : []

  // The end of the book before: its last scene in book order.
  const last = events.reduce<string | null>((best, e) => (best === null || story.position(e.id) > story.position(best) ? e.id : best), null)
  const at = openingScene(worldId)
  const now = Date.now()
  const stamp = { worldId, eventId: at, sortKey: OPENING_KEY, createdAt: now, updatedAt: now }
  // A book with no scenes ends where it began.
  if (!last) {
    const moved = <T extends { id: string }>(rows: T[]) => rows.map((r) => ({ ...r, ...stamp, id: `${at}:${r.id}` }))
    return { from: before, people: moved(prior.people), custody: moved(prior.custody), items: moved(prior.items), places: moved(prior.places), regions: moved(prior.regions), fields: moved(prior.fields) }
  }

  const moment = stateAt({
    people: [...prior.people, ...people],
    ...(want.has('custody') ? { custody: { rows: [...prior.custody, ...custody], collective: new Set(things.filter((i) => i.isCollective).map((i) => i.id)) } } : {}),
    items: { records: [...prior.items, ...items], keptInEra: new Set(things.filter((i) => i.staysInEra).map((i) => i.id)) },
    places: [...prior.places, ...places],
    regions: [...prior.regions, ...regions],
    ...(want.has('fields') ? { fields: { rows: [...prior.fields, ...fieldRows], kindOf: new Map(defs.map((d) => [d.id, d.kind])), keptInEra: new Set(things.filter((i) => i.staysInEra).map((i) => i.id)) } } : {}),
  }, last, story)

  const openingPeople: PersonRecord[] = moment.people.map((p) => ({
    ...stamp,
    id: `${at}:${p.characterId}`,
    characterId: p.characterId,
    isAlive: p.isAlive,
    currentLocationMarkerId: p.currentLocationMarkerId,
    currentMapLayerId: p.currentMapLayerId,
    travelModeId: p.travelModeId,
    statusNotes: p.statusNotes,
    inventoryNotes: p.inventoryNotes,
  }))
  const openingCustody: ItemCustody[] = []
  if (moment.holdings) {
    for (const [itemId, c] of moment.holdings.ofItem) {
      openingCustody.push({ ...stamp, id: `${at}:${itemId}`, itemId, holderId: c.holderId, placeId: c.placeId })
    }
    for (const [itemId, holders] of moment.holdings.sharedBy) {
      for (const holderId of holders) openingCustody.push({ ...stamp, id: `${at}:${itemId}:${holderId}`, itemId, holderId, placeId: null, has: true })
    }
  }
  const restamp = <T extends { id: string }>(rows: T[]) => rows.map((r) => ({ ...r, ...stamp, id: `${at}:${r.id}` }))
  return {
    from: before,
    people: want.has('people') ? openingPeople : [],
    custody: openingCustody,
    items: want.has('items') ? restamp(moment.items) : [],
    places: want.has('places') ? restamp(moment.places) : [],
    regions: want.has('regions') ? restamp(moment.regions) : [],
    // A value cleared by the end says nothing to the next book.
    fields: restamp(moment.fields.filter((f) => f.value !== null)),
  }
}

/** The opening, live: it changes as the book before does. */
export function useOpening(worldId: string | null | undefined): Opening {
  return useLiveQuery(async () => (worldId && bibleOf(worldId) !== worldId ? openingOf(worldId) : NO_OPENING), [worldId], NO_OPENING)
}

/** A book's own records with its opening's of the same kind before them; the same array where there is none. */
export function withOpening<T>(rows: T[], opening: readonly T[]): T[] {
  return opening.length ? [...opening, ...rows] as T[] : rows
}
