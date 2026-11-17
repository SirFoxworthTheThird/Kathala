/*
  Where the series' people, items and places appear, book by book (issue #698,
  part 4). A shared character is in every book's cast list, so a list, a delete
  and the *in this book only* mark each need to know which books actually tell
  of them.

  A scene tells of a person when they are on it (cast, on the phone, or its
  point of view) or a state of theirs is recorded there; of an item when it is
  on the scene or its holder, place or condition is said there; of a place when
  the scene is set there or its state is said there. A person merely mentioned
  is not counted: that is how a reader meets them too, by not meeting them.
*/

interface Scene {
  id: string
  involvedCharacterIds?: readonly string[]
  remoteCharacterIds?: readonly string[]
  povCharacterId?: string | null
  involvedItemIds?: readonly string[]
  locationMarkerId?: string | null
}

export interface BookRows {
  book: { id: string; name: string; seriesIndex?: number }
  events: readonly Scene[]
  characterSnapshots: ReadonlyArray<{ characterId: string; eventId: string }>
  itemCustody: ReadonlyArray<{ itemId: string; eventId: string }>
  itemSnapshots: ReadonlyArray<{ itemId: string; eventId: string }>
  itemPlacements: ReadonlyArray<{ itemId: string; eventId: string }>
  locationSnapshots: ReadonlyArray<{ locationMarkerId: string; eventId: string }>
}

/** Each entity a book tells of, with the scenes it is in. A record at a scene the book has not got is not counted. */
export function scenesOf(rows: BookRows): Map<string, Set<string>> {
  const scenes = new Set(rows.events.map((e) => e.id))
  const out = new Map<string, Set<string>>()
  const add = (entityId: string | null | undefined, sceneId: string) => {
    if (!entityId || !scenes.has(sceneId)) return
    let set = out.get(entityId)
    if (!set) out.set(entityId, (set = new Set()))
    set.add(sceneId)
  }
  for (const e of rows.events) {
    for (const id of e.involvedCharacterIds ?? []) add(id, e.id)
    for (const id of e.remoteCharacterIds ?? []) add(id, e.id)
    add(e.povCharacterId, e.id)
    for (const id of e.involvedItemIds ?? []) add(id, e.id)
    add(e.locationMarkerId, e.id)
  }
  for (const r of rows.characterSnapshots) add(r.characterId, r.eventId)
  for (const r of rows.itemCustody) add(r.itemId, r.eventId)
  for (const r of rows.itemSnapshots) add(r.itemId, r.eventId)
  for (const r of rows.itemPlacements) add(r.itemId, r.eventId)
  for (const r of rows.locationSnapshots) add(r.locationMarkerId, r.eventId)
  return out
}

export interface Appearance {
  bookId: string
  bookName: string
  /** The book's place in the series. */
  index: number
  scenes: number
}

/** Each entity's appearances across a series' books, in reading order. */
export function seriesAppearances(books: readonly BookRows[]): Map<string, Appearance[]> {
  const ordered = [...books].sort((a, b) => (a.book.seriesIndex ?? 0) - (b.book.seriesIndex ?? 0))
  const out = new Map<string, Appearance[]>()
  ordered.forEach((rows, k) => {
    for (const [entityId, scenes] of scenesOf(rows)) {
      const list = out.get(entityId) ?? []
      list.push({ bookId: rows.book.id, bookName: rows.book.name, index: rows.book.seriesIndex ?? k + 1, scenes: scenes.size })
      out.set(entityId, list)
    }
  })
  return out
}

/**
 * The book an entity first appears in, where that is not `bookId` and it does
 * not appear in `bookId` at all: what a list in `bookId` says beside it, so a
 * character from book three does not read as one book one forgot.
 */
export function firstElsewhere(appearances: readonly Appearance[] | undefined, bookId: string): Appearance | null {
  if (!appearances?.length || appearances.some((a) => a.bookId === bookId)) return null
  return appearances[0]
}

/** The books, as a sentence: "The Salt Road (3 scenes) and The Second Road (1 scene)". */
export function booksSentence(appearances: readonly Appearance[]): string {
  const parts = appearances.map((a) => `${a.bookName} (${a.scenes} ${a.scenes === 1 ? 'scene' : 'scenes'})`)
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
}

/**
 * What a delete in a series says: every book that tells of what is deleted, so
 * deleting a character from book two is seen to take them from book one too.
 */
export function deleteInSeriesLine(name: string, kind: 'character' | 'item' | 'place', appearances: readonly Appearance[]): string {
  const them = kind === 'character' ? 'them' : 'it'
  if (!appearances.length) return `${name} is not in any book of the series yet. Deleting removes ${them} from the series.`
  const states = kind === 'character' ? 'their states' : kind === 'item' ? 'who holds it and its condition' : 'its states'
  return `${name} appears in ${booksSentence(appearances)}. Deleting removes ${them}, and ${states}, from every book in the series.`
}

/**
 * Rows as a book sees them: one kept to another book (`onlyInBook`, D-4's
 * *in this book only*) is not among them. A row of any other kind, or one
 * shared by the series, is.
 */
export function seenFrom<T>(rows: readonly T[], bookId: string | null): T[] {
  return rows.filter((r) => {
    const only = (r as { onlyInBook?: string | null }).onlyInBook
    return !only || only === bookId
  })
}
