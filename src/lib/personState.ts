import type { CharacterSnapshot } from '@/types'
import { lastBefore, lastKnown, lastKnownOne, type Story } from './stateEngine'

/*
  A person's state as sparse statements (next-plan.md, Part B2).

  A record used to hold a person's whole state at its scene — where they are,
  whether they live, how they travel, notes on them and on what they carry —
  copied from their last record for every field the writer did not touch. So
  "Anna is at the Quay" also restated that she was alive, on foot and the rest,
  and a correction at an earlier scene stopped at the first later record that
  had copied the old value (W-2's place drift; F2, the carry-forward toast).

  Here a record holds only the fields said at its scene, and each field is
  read on its own: the last record at or before the scene, in its era, that
  says it. A field a record does not have is `undefined` — absent, not null:
  `null` is a place of nowhere, and is said.
*/

/** The parts of a person's state that are said, and read, one by one. */
export const FACETS = ['alive', 'place', 'travel', 'status', 'carrying'] as const
export type Facet = (typeof FACETS)[number]

/** A person's record as stored: identity, and whichever facets its scene says. */
export type PersonRecord = Omit<CharacterSnapshot, 'isAlive' | 'currentLocationMarkerId' | 'currentMapLayerId' | 'travelModeId' | 'statusNotes' | 'inventoryNotes' | 'inventoryItemIds'>
  & Partial<Pick<CharacterSnapshot, 'isAlive' | 'currentLocationMarkerId' | 'currentMapLayerId' | 'travelModeId' | 'statusNotes' | 'inventoryNotes' | 'inventoryItemIds'>>

/** The record fields each facet is: a place is its marker and the map it is on, said together. */
const FIELDS: Record<Facet, readonly (keyof CharacterSnapshot)[]> = {
  alive: ['isAlive'],
  place: ['currentLocationMarkerId', 'currentMapLayerId'],
  travel: ['travelModeId'],
  status: ['statusNotes'],
  carrying: ['inventoryNotes'],
}

/** What a person is with nothing said: alive, nowhere in particular, no notes. */
const UNSAID = {
  isAlive: true,
  currentLocationMarkerId: null,
  currentMapLayerId: null,
  travelModeId: null,
  statusNotes: '',
  inventoryNotes: '',
} satisfies Partial<CharacterSnapshot>

/** Whether `record` says `facet` at its scene. A place is said by its marker; its map goes with it. */
export function says(record: PersonRecord, facet: Facet): boolean {
  return (record as Record<string, unknown>)[FIELDS[facet][0]] !== undefined
}

function valueOf(record: PersonRecord, facet: Facet): unknown[] {
  return FIELDS[facet].map((f) => (record as Record<string, unknown>)[f] ?? (UNSAID as Record<string, unknown>)[f] ?? null)
}

const same = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((v, i) => v === b[i])

/**
 * A person's whole state, from `anchor` — the record the state is read at, the
 * last one at or before the moment — and, for each facet, the record that last
 * said it (none: what a person is with nothing said). The identity is the
 * anchor's, and so is `revived`, which marks a scene rather than carrying. The
 * inventory is left as the anchor has it, for custody to answer (Part B1).
 */
function compose(anchor: PersonRecord, by: Partial<Record<Facet, PersonRecord>>): CharacterSnapshot {
  const out: Record<string, unknown> = { ...UNSAID, ...anchor, inventoryItemIds: anchor.inventoryItemIds ?? [] }
  const unsaid: Record<string, unknown> = UNSAID
  for (const facet of FACETS) {
    const from = by[facet] as Record<string, unknown> | undefined
    for (const f of FIELDS[facet]) out[f] = from ? from[f] ?? unsaid[f] : unsaid[f]
  }
  return out as unknown as CharacterSnapshot
}

/** One person's state at `cursor`, each facet read on its own; undefined with no record at or before it. */
export function personAt(records: readonly PersonRecord[], cursor: string | null, story: Story): CharacterSnapshot | undefined {
  const anchor = lastKnownOne(records, cursor, story, 'person')?.record
  if (!anchor) return undefined
  const by: Partial<Record<Facet, PersonRecord>> = {}
  for (const facet of FACETS) by[facet] = lastKnownOne(records.filter((r) => says(r, facet)), cursor, story, 'person')?.record
  return compose(anchor, by)
}

/**
 * Every person's state at `cursor`, each facet read on its own: what
 * `lastKnownRecords` gave, record by record, with each field from the record
 * that last said it. With no cursor there is no moment to read at, and each
 * person is read at their most recently updated record's own scene — that
 * record whole, as it was shown before facets were said apart.
 */
export function peopleAt(records: readonly PersonRecord[], cursor: string | null, story: Story): CharacterSnapshot[] {
  const anchors = lastKnown(records, cursor, story, 'person', (r) => r.characterId)
  if (cursor === null) {
    const whole = new Map(wholeRecords(records, story).map((r) => [r.id, r]))
    return [...anchors.values()].map(({ record }) => whole.get(record.id)!)
  }
  const by = new Map<Facet, Map<string, PersonRecord>>()
  for (const facet of FACETS) {
    const known = lastKnown(records.filter((r) => says(r, facet)), cursor, story, 'person', (r) => r.characterId)
    by.set(facet, new Map([...known].map(([id, k]) => [id, k.record])))
  }
  return [...anchors].map(([id, { record }]) => compose(record, Object.fromEntries(FACETS.map((f) => [f, by.get(f)!.get(id)]))))
}

/**
 * Each record whole, as it reads at its own scene: the fields it says, and the
 * rest from the records before it. For the screens that walk records — a
 * person's history, the checker, a chapter's diff — so that a record which
 * says only where somebody is still reads as their whole state there.
 */
export function wholeRecords(records: readonly PersonRecord[], story: Story): CharacterSnapshot[] {
  const byPerson = new Map<string, PersonRecord[]>()
  for (const r of records) byPerson.set(r.characterId, [...(byPerson.get(r.characterId) ?? []), r])
  return records.map((r) => {
    const own = byPerson.get(r.characterId)!
    const by: Partial<Record<Facet, PersonRecord>> = {}
    for (const facet of FACETS) {
      // Its own word first; else the last before it — the scene may be gone, and then only its own word is known.
      by[facet] = says(r, facet) ? r : lastBefore(own.filter((x) => says(x, facet)), r.eventId, story, 'person')
    }
    return compose(r, by)
  })
}

/**
 * Records with each facet kept only where it changes: the migration's walk.
 * A field equal to the person's state before the record — in its era, as
 * `lastBefore` reads it — says nothing, and goes; so does one at a person's
 * first record that says only what a person is with nothing said. Every scene
 * then reads as it did: each dropped field was the value read there anyway.
 *
 * `keep` keeps a facet that repeats, for a repeat that was a statement — the
 * header placing its cast at the scene's place, which keeps them there however
 * an earlier scene is later changed.
 */
export function sparseRecords<T extends CharacterSnapshot>(
  records: readonly T[],
  story: Story,
  keep: (record: T, facet: Facet) => boolean = () => false,
): { records: PersonRecord[]; dropped: Record<Facet, number>; kept: Record<Facet, number> } {
  const dropped = Object.fromEntries(FACETS.map((f) => [f, 0])) as Record<Facet, number>
  const kept = Object.fromEntries(FACETS.map((f) => [f, 0])) as Record<Facet, number>
  const byPerson = new Map<string, T[]>()
  for (const r of records) byPerson.set(r.characterId, [...(byPerson.get(r.characterId) ?? []), r])
  const out = records.map((r): PersonRecord => {
    // A record whose scene is gone, with no stored place either, is never read; it is left whole.
    if (story.position(r.eventId) === -1 && r.sortKey == null) return r
    const before = lastBefore(byPerson.get(r.characterId)!, r.eventId, story, 'person')
    const sparse = { ...r } as Record<string, unknown>
    for (const facet of FACETS) {
      const was = before ? valueOf(before, facet) : valueOf({} as PersonRecord, facet)
      if (!same(valueOf(r, facet), was)) continue
      if (keep(r, facet)) { kept[facet]++; continue }
      for (const f of FIELDS[facet]) delete sparse[f]
      dropped[facet]++
    }
    return sparse as PersonRecord
  })
  return { records: out, dropped, kept }
}
