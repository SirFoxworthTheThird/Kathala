/*
  Joining a book to a series (issue #698, part 3).

  A book written on its own, or made with *Start a sequel*, has its own copies of
  the cast, items, places and maps, factions and lore. Start a sequel keeps no
  link to what it copied, so each copy is matched to the series' own by its name
  and kind, and the writer confirms each pair. Then every reference to a matched
  copy, in every row the book has, is pointed at the series' record, and the copy
  is removed. A copy not matched joins the series' bible as it is.

  This file is the pure half: what is offered, what follows from what is
  confirmed, and how a row is rewritten. `joinSeries` (useSeries.ts) reads and
  writes.
*/

type Row = Record<string, unknown> & { id: string }
export type Rows = Partial<Record<string, Row[]>>

/** The kinds a writer confirms, one copy at a time, in the order the dialog shows them. */
export const OFFERED = [
  { table: 'characters', label: 'People' },
  { table: 'items', label: 'Items' },
  { table: 'mapLayers', label: 'Maps' },
  { table: 'locationMarkers', label: 'Places' },
  { table: 'mapRoutes', label: 'Routes' },
  { table: 'mapRegions', label: 'Regions' },
  { table: 'travelModes', label: 'Travel modes' },
  { table: 'factions', label: 'Factions' },
  { table: 'loreCategories', label: 'Lore categories' },
  { table: 'lorePages', label: 'Lore pages' },
] as const

export type OfferedTable = (typeof OFFERED)[number]['table']

/** What a row is called: a lore page by its title, everything else by its name. */
export function nameOf(row: Row): string {
  return String(row.title ?? row.name ?? '')
}

/** A name as it is compared: case, accents, and runs of space do not tell two apart. */
export function nameKey(name: string): string {
  return name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** A person's names: their name and every alias. */
function namesOf(row: Row): string[] {
  const aliases = Array.isArray(row.aliases) ? (row.aliases as unknown[]).filter((a): a is string => typeof a === 'string') : []
  return [nameOf(row), ...aliases].map(nameKey).filter(Boolean)
}

export interface Candidate {
  id: string
  name: string
  /** How it matched: the same name, or one's name among the other's aliases. */
  by: 'name' | 'alias'
}

export interface Offer {
  table: OfferedTable
  copy: { id: string; name: string }
  /** The series' records it may be, best first. */
  candidates: Candidate[]
  /** The one suggested: the only best candidate, and not the suggestion for another copy. */
  suggested: string | null
}

/**
 * Each of the book's copies of a shared kind, with the series' records it may be.
 * A record is suggested for one copy only: two copies of one person would put
 * two records of them at one scene.
 */
export function offerMatches(bible: Rows, book: Rows): Offer[] {
  const offers: Offer[] = []
  for (const { table } of OFFERED) {
    const theirs = bible[table] ?? []
    const taken = new Set<string>()
    const mine = [...(book[table] ?? [])].sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
    const found = mine.map((copy) => {
      const key = nameKey(nameOf(copy))
      const keys = new Set(table === 'characters' ? namesOf(copy) : [key])
      const candidates: Candidate[] = []
      for (const t of theirs) {
        if (nameKey(nameOf(t)) === key && key) candidates.push({ id: t.id, name: nameOf(t), by: 'name' })
        else if (table === 'characters' && namesOf(t).some((n) => keys.has(n))) candidates.push({ id: t.id, name: nameOf(t), by: 'alias' })
      }
      candidates.sort((a, b) => (a.by === b.by ? a.name.localeCompare(b.name) : a.by === 'name' ? -1 : 1))
      return { copy: { id: copy.id, name: nameOf(copy) }, candidates }
    })
    // The same name first, then by alias: a copy matched by its own name has the stronger claim.
    const suggested = new Map<string, string>()
    for (const pass of ['name', 'alias'] as const) {
      for (const { copy, candidates } of found) {
        const best = candidates.filter((c) => c.by === candidates[0]?.by)
        if (best[0]?.by !== pass || best.length !== 1 || taken.has(best[0].id)) continue
        taken.add(best[0].id)
        suggested.set(copy.id, best[0].id)
      }
    }
    for (const { copy, candidates } of found) offers.push({ table, copy, candidates, suggested: suggested.get(copy.id) ?? null })
  }
  return offers
}

/** The pairs a writer has confirmed, copy id to series id; the suggestions, until they change one. */
export function suggestedPairs(offers: Offer[]): Map<string, string> {
  return new Map(offers.filter((o) => o.suggested).map((o) => [o.copy.id, o.suggested!]))
}

/** Why a set of pairs cannot be joined, or null: two copies taken for one record, or a pair of the wrong kind. */
export function pairsProblem(offers: Offer[], pairs: Map<string, string>): string | null {
  const byCopy = new Map(offers.map((o) => [o.copy.id, o]))
  const seen = new Map<string, string>()
  for (const [copyId, bibleId] of pairs) {
    const offer = byCopy.get(copyId)
    if (!offer) return 'A pair is for a record the book does not have.'
    if (!offer.candidates.some((c) => c.id === bibleId)) return `${offer.copy.name} is not matched to one of the series' own.`
    const before = seen.get(bibleId)
    if (before) return `${before} and ${offer.copy.name} are both matched to ${offer.candidates.find((c) => c.id === bibleId)!.name}. A record can be the match of one copy only.`
    seen.set(bibleId, offer.copy.name)
  }
  return null
}

const pairKey = (a: unknown, b: unknown) => [String(a), String(b)].sort().join('|')

/**
 * Every id the join points elsewhere: the confirmed pairs, and what follows from
 * them. A relationship between two matched people, a membership of a matched
 * person in a matched faction, a stance between two matched factions, and a
 * label with the same text on a matched map are the series' own where it has
 * them already; otherwise they join it.
 */
export function joinIds(bible: Rows, book: Rows, pairs: Map<string, string>): Map<string, string> {
  const ids = new Map(pairs)
  const to = (id: unknown) => ids.get(String(id)) ?? String(id)
  const follow = (table: string, key: (r: Row, map: (id: unknown) => string) => string | null) => {
    const theirs = new Map<string, string>()
    for (const r of bible[table] ?? []) {
      const k = key(r, (id) => String(id))
      if (k && !theirs.has(k)) theirs.set(k, r.id)
    }
    for (const r of book[table] ?? []) {
      const k = key(r, to)
      const match = k ? theirs.get(k) : undefined
      if (match) ids.set(r.id, match)
    }
  }
  follow('relationships', (r, m) => pairKey(m(r.characterAId), m(r.characterBId)))
  follow('factionMemberships', (r, m) => `${m(r.factionId)}|${m(r.characterId)}`)
  follow('factionRelationships', (r, m) => pairKey(m(r.factionAId), m(r.factionBId)))
  follow('mapAnnotations', (r, m) => (r.text ? `${m(r.mapLayerId)}|${nameKey(String(r.text))}` : null))
  return ids
}

/**
 * An id where it stands inside a longer string, between anything but a letter or
 * a digit. A warning's id joins its parts with \`-\` (\`dead-in-event-<person>-<scene>\`),
 * which nanoid also writes, so a hyphen is allowed beside it: an id of 21 random
 * characters is not found inside another string by chance.
 */
const idIn = (id: string) => new RegExp(`(?<![A-Za-z0-9])${id.replace(/[-]/g, '\\-')}(?![A-Za-z0-9])`, 'g')

/** Long enough that it names nothing else inside a string. Shorter ids, as tests make, are rewritten only whole. */
const EMBEDDABLE = 16

/**
 * A value with every id in `ids` pointed at its new one: a string that is one,
 * a string that names one inside it (a custody row's id, a dismissed warning's),
 * in arrays, in nested objects, and as an object's key. Anything else, such as
 * an image's bytes, is left as it is.
 */
export function rewrite<T>(value: T, ids: Map<string, string>, embedded = embeddedOf(ids)): T {
  if (typeof value === 'string') {
    const whole = ids.get(value)
    if (whole !== undefined) return whole as T
    let out: string = value
    for (const [from, to, re] of embedded) if (out.includes(from)) out = out.replace(re, to)
    return out as T
  }
  if (Array.isArray(value)) return value.map((v) => rewrite(v, ids, embedded)) as T
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[rewrite(k, ids, embedded)] = rewrite(v, ids, embedded)
    return out as T
  }
  return value
}

export function embeddedOf(ids: Map<string, string>): Array<[string, string, RegExp]> {
  return [...ids].filter(([from]) => from.length >= EMBEDDABLE).map(([from, to]) => [from, to, idIn(from)])
}

/** Fields a copy fills where the series' own record has none: plain words and images, never a reference to a scene. */
const FILLS = ['description', 'notes', 'body', 'portraitImageId', 'imageId', 'coverImageId', 'color', 'birthDate'] as const
/** Lists the copy's are added to. */
const UNIONS = ['aliases', 'tags'] as const

const blank = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)

/**
 * The series' record with what a matched copy adds: a field it has left empty,
 * and the copy's aliases and tags. The series' word stands wherever it has one.
 * Returns null where the copy adds nothing.
 */
export function filledFrom(theirs: Row, copy: Row): Row | null {
  const out: Row = { ...theirs }
  let changed = false
  for (const f of FILLS) {
    if (blank(theirs[f]) && !blank(copy[f])) {
      out[f] = copy[f]
      changed = true
    }
  }
  for (const f of UNIONS) {
    if (!Array.isArray(copy[f])) continue
    const have = Array.isArray(theirs[f]) ? (theirs[f] as unknown[]) : []
    const keys = new Set(have.map((v) => (typeof v === 'string' ? nameKey(v) : v)))
    const extra = (copy[f] as unknown[]).filter((v) => !keys.has(typeof v === 'string' ? nameKey(v) : v))
    // A person's own name is not an alias of theirs.
    const own = nameKey(nameOf(theirs))
    const added = f === 'aliases' ? extra.filter((v) => typeof v !== 'string' || nameKey(v) !== own) : extra
    if (added.length) {
      out[f] = [...have, ...added]
      changed = true
    }
  }
  return changed ? out : null
}

/** Every string a row names at its top level or in a list: where it may point at another row. */
function namedBy(row: Row): string[] {
  const out: string[] = []
  for (const v of Object.values(row)) {
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) for (const x of v) if (typeof x === 'string') out.push(x)
  }
  return out
}

export interface LeavePlan {
  /** Rows kept to the book leaving, and what reaches them: they go with it, keeping their ids. */
  moved: Set<string>
  /** Rows kept to another book, and what reaches them: the book leaving takes no copy. */
  leftBehind: Set<string>
  /** Every other row of the bible, to the id of the book's own copy of it. */
  ids: Map<string, string>
}

/**
 * What a book leaving its series takes with it (issue #698): its own copy of
 * every record the series shares, under new ids, so neither side's later edits
 * reach the other. A record kept to this book (\`onlyInBook\`) is the book's
 * already, and moves rather than being copied; a relationship or membership
 * that reaches one goes with it. A record kept to another book, and what
 * reaches that, stays behind: this book has no part of it.
 */
export function planLeave(bible: Rows, bookId: string, mint: () => string): LeavePlan {
  const rows = Object.values(bible).flatMap((r) => r ?? [])
  const grow = (seed: Set<string>, others: (r: Row) => boolean) => {
    for (let changed = true; changed;) {
      changed = false
      for (const r of rows) {
        if (seed.has(r.id) || !others(r)) continue
        if (namedBy(r).some((v) => v !== r.id && seed.has(v))) {
          seed.add(r.id)
          changed = true
        }
      }
    }
    return seed
  }
  const only = (r: Row) => (r.onlyInBook as string | null | undefined) ?? null
  const moved = grow(new Set(rows.filter((r) => only(r) === bookId).map((r) => r.id)), (r) => only(r) === null)
  const leftBehind = grow(new Set(rows.filter((r) => only(r) !== null && only(r) !== bookId).map((r) => r.id)), (r) => !moved.has(r.id))
  const ids = new Map<string, string>()
  for (const r of rows) if (!moved.has(r.id) && !leftBehind.has(r.id)) ids.set(r.id, mint())
  return { moved, leftBehind, ids }
}
