import 'fake-indexeddb/auto'
import { describe, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { db } from '../src/db/database'
import { importWorldFromJson } from '../src/lib/exportImport'
import { custodyAt, deriveCustody, legacyCustodyAt, sharedHoldersAt, type Custody, type CustodyStatement } from '../src/lib/custody'
import { storyOf } from '../src/lib/stateEngine'
import { wholeRecords } from '../src/lib/personState'
import { bookPosition, chapterNumbers } from '../src/lib/bookOrder'

/**
 * The equivalence probe for Part B1 (next-plan.md): item custody as statements,
 * derived from the records every book already has, against custody as the app
 * reads it today — at every item and every scene, and every person and scene.
 *
 * Not a test: it reads the Library, which is not part of this repository, and
 * it asserts nothing. It is what the migration has to answer to: every reading
 * that changes is counted by its cause, and a sample of each is written out to
 * be read by a person.
 *
 * Each world goes in through the app's own import, as a user's would, so what
 * is probed is what the migration would find in IndexedDB.
 *
 *   npm run probe:custody
 *   KATHALA_LIBRARY=../elsewhere PROBE_OUT=custody.txt npm run probe:custody
 */

const LIBRARY = join(process.env.KATHALA_LIBRARY ?? '../Kathala-Library', 'library')
const OUT = process.env.PROBE_OUT ?? 'custody-probe.txt'
/** The writer runs' worlds and the app's own fixtures, beside the Library's books. */
const LOCAL = ['docs/records', 'e2e/fixtures', 'src/test/fixtures/worlds']

/**
 * Why a reading changed, where it did.
 *
 * Where an item is (the Items roster, the map, the checker), today: a placement
 * wins, then any holder.
 * - `carrierNamed`: the same place, and the statements name who has it there —
 *   a placement at its carrier's place. Not a change of where it is.
 * - `pickedUp`: today it lies where it was put; the statements say whoever's
 *   inventory took it in at a later scene has it. Today a placement wins over
 *   every later inventory, so a thing once put down could never be picked up.
 * - `copyOutvoted`: today somebody holds it by a record that only copied their
 *   last one; the statements follow the change made since — a hand-off, a
 *   placement, a release.
 * - `twoHandsKept`: today two or more hold it at once; the statements keep one
 *   of them.
 * - `releasedAfterPickUp`: today it lies where it was put; the statements say
 *   it was picked up since, and then its holder's inventory stopped listing it
 *   — so nothing is said of where it is. `pickedUp`'s consequence.
 * - `other`: anything else. Each is a question about the walk, and sampled.
 * - `sharedDiffers`: for a collective item (`Item.isCollective`), who has some
 *   is not who today's records list. Each person's share is their own
 *   statement and a copy repeats it, so this must be 0.
 *
 * What a person holds (Current State, the header, the cast), today: their last
 * record's inventory, whatever else says.
 * - `copyDropped…`: today they hold it by a copy; the statements say it lies
 *   somewhere (`copyDroppedPlaced`: today's own answer to where it is, too),
 *   that somebody else holds it (`copyDroppedOther`), or nothing
 *   (`copyDroppedNowhere`).
 * - `gained`: the statements give them something their record does not list.
 *   Every holder comes from an inventory that took the item in, and a holder
 *   whose record stops listing it releases it, so this must be 0.
 */
const WHERE = ['carrierNamed', 'pickedUp', 'copyOutvoted', 'twoHandsKept', 'releasedAfterPickUp', 'other', 'sharedDiffers'] as const
const HELD = ['copyDroppedPlaced', 'copyDroppedOther', 'copyDroppedNowhere', 'gained'] as const
type Cause = (typeof WHERE)[number] | (typeof HELD)[number]
type Count = Record<Cause, number>

interface BookResult {
  name: string
  scenes: number
  items: number
  collective: number
  /** Records listing at least one item, and item mentions across them: every copy of every fact. */
  listing: number
  mentions: number
  placements: number
  statements: number
  readings: number
  personReadings: number
  ambiguous: number
  /** Statements the import stored that the walk here does not derive, or the other way round: must be 0. */
  storedDiffers: number
  count: Count
  /** Distinct items behind each cause. */
  itemsBy: Record<Cause, Set<string>>
  samples: string[]
}

const describeCustody = (c: Custody, name: (id: string) => string) =>
  c.holderId ? `held by ${name(c.holderId)}` : c.placeId ? `at ${name(c.placeId)}` : 'nowhere said'

async function probe(name: string, json: string): Promise<BookResult> {
  await Promise.all(db.tables.map((t) => t.clear()))
  const worldId = await importWorldFromJson(json)
  const [events, chapters, timelines, world, items, characters, markers, asStored, placements] = await Promise.all([
    db.events.where('worldId').equals(worldId).toArray(),
    db.chapters.where('worldId').equals(worldId).toArray(),
    db.timelines.where('worldId').equals(worldId).toArray(),
    db.worlds.get(worldId),
    db.items.where('worldId').equals(worldId).toArray(),
    db.characters.where('worldId').equals(worldId).toArray(),
    db.locationMarkers.where('worldId').equals(worldId).toArray(),
    db.characterSnapshots.where('worldId').equals(worldId).toArray(),
    db.itemPlacements.where('worldId').equals(worldId).toArray(),
  ])
  const story = storyOf(events, chapters, timelines, { pinsSetClock: world?.pinsSetClock })
  // Each record whole at its scene (Part B2), as the migration derives custody from them.
  const snapshots = wholeRecords(asStored, story)
  const numbers = chapterNumbers(chapters)
  const scenes = [...events]
    .sort((a, b) => bookPosition(numbers.get(a.chapterId) ?? 0, a.sortOrder) - bookPosition(numbers.get(b.chapterId) ?? 0, b.sortOrder) || a.id.localeCompare(b.id))
    .map((e) => e.id)
  const names = new Map<string, string>([
    ...events.map((e) => [e.id, `“${e.title}”`] as [string, string]),
    ...items.map((i) => [i.id, i.name] as [string, string]),
    ...characters.map((c) => [c.id, c.name] as [string, string]),
    ...markers.map((m) => [m.id, m.name] as [string, string]),
  ])
  const nameOf = (id: string) => names.get(id) ?? id
  // The items the world has, as the migration derives them: a record naming one it has not got is an orphan, for the health check.
  const itemIds = items.map((i) => i.id)
  const known = new Set(itemIds)

  const collective = new Set(items.filter((i) => i.isCollective).map((i) => i.id))
  const { statements, ambiguities } = deriveCustody({ itemIds, collective, placements, snapshots, scenes, story })
  const byItem = new Map<string, CustodyStatement[]>(itemIds.map((id) => [id, []]))
  for (const s of statements) byItem.get(s.itemId)!.push(s)

  const causes: Cause[] = [...WHERE, ...HELD]
  const r: BookResult = {
    name, scenes: scenes.length, items: itemIds.length, collective: collective.size,
    listing: snapshots.filter((s) => s.inventoryItemIds.length).length,
    mentions: snapshots.reduce((n, s) => n + s.inventoryItemIds.length, 0),
    placements: placements.length, statements: statements.length,
    readings: 0, personReadings: 0, ambiguous: ambiguities.length,
    storedDiffers: 0,
    count: Object.fromEntries(causes.map((k) => [k, 0])) as Count,
    itemsBy: Object.fromEntries(causes.map((k) => [k, new Set<string>()])) as Record<Cause, Set<string>>,
    samples: [],
  }
  /*
    What the import stored (`ensureCustody`) against what the walk derives
    here: the migration and the import derive by one function, so a
    difference is a path that drops or changes rows on the way in.
  */
  const key = (x: { itemId: string; eventId: string; holderId: string | null; placeId: string | null; has?: boolean }) =>
    `${x.itemId}|${x.eventId}|${x.holderId}|${x.placeId}|${x.has ?? ''}`
  const stored = new Set((await db.itemCustody.where('worldId').equals(worldId).toArray()).map(key))
  const derived = new Set(statements.map(key))
  for (const k of stored) if (!derived.has(k)) r.storedDiffers++
  for (const k of derived) if (!stored.has(k)) r.storedDiffers++

  const seen = new Set<string>()
  const note = (cause: Cause, itemId: string, line: () => string) => {
    r.count[cause]++
    r.itemsBy[cause].add(itemId)
    // One sample per cause and item, so a long run of one change is read once.
    const key = `${cause}|${itemId}`
    if (!seen.has(key) && r.samples.length < 40) { seen.add(key); r.samples.push(`${cause}: ${line()}`) }
  }

  /** Whether the statements have the item held at some scene after its last placement, by `sceneId`. */
  const pickedUpSince = (itemId: string, sceneId: string) => {
    const own = (byItem.get(itemId) ?? []).filter((x) => story.position(x.eventId) <= story.position(sceneId))
    const lastPlaced = Math.max(-1, ...own.filter((x) => x.placeId).map((x) => story.position(x.eventId)))
    return own.some((x) => x.holderId && story.position(x.eventId) > lastPlaced)
  }

  for (const sceneId of scenes) {
    const { placeOf, holdersOf, inventoryOf } = legacyCustodyAt(placements, snapshots, sceneId, story)
    const holderNow = new Map<string, string>()
    const sharedNow = new Map<string, string[]>()
    for (const itemId of itemIds) {
      r.readings++
      if (collective.has(itemId)) {
        const now = sharedHoldersAt(byItem.get(itemId)!, sceneId, story).sort()
        sharedNow.set(itemId, now)
        const today = [...(holdersOf.get(itemId) ?? [])].sort()
        if (now.join() !== today.join()) note('sharedDiffers', itemId, () => `${nameOf(itemId)} at ${nameOf(sceneId)}: today ${today.map(nameOf).join(', ') || 'nobody'}; statements ${now.map(nameOf).join(', ') || 'nobody'}`)
        continue
      }
      const now = custodyAt(byItem.get(itemId)!, sceneId, story).custody
      if (now.holderId) holderNow.set(itemId, now.holderId)
      const place = placeOf.get(itemId) ?? null
      const holders = place ? [] : holdersOf.get(itemId) ?? []
      const today: Custody = { holderId: holders[0] ?? null, placeId: place }
      const said = () => `${nameOf(itemId)} at ${nameOf(sceneId)}: today ${holders.length > 1 ? `held by ${holders.map(nameOf).join(' and ')}` : describeCustody(today, nameOf)}; statements: ${describeCustody(now, nameOf)}`
      if (holders.length > 1) { note(now.holderId && holders.includes(now.holderId) ? 'twoHandsKept' : 'copyOutvoted', itemId, said); continue }
      if (today.holderId === now.holderId && today.placeId === now.placeId) continue
      // Where it is agrees; the statements also say who has it there.
      if (place && now.placeId === place) { note('carrierNamed', itemId, said); continue }
      if (place && now.holderId) note('pickedUp', itemId, said)
      else if (today.holderId) note('copyOutvoted', itemId, said)
      else if (place && !now.holderId && !now.placeId && pickedUpSince(itemId, sceneId)) note('releasedAfterPickUp', itemId, said)
      else note('other', itemId, said)
    }
    for (const [characterId, today] of inventoryOf) {
      r.personReadings++
      for (const itemId of today) {
        if (!known.has(itemId)) continue
        if (holderNow.get(itemId) === characterId || sharedNow.get(itemId)?.includes(characterId)) continue
        const now = custodyAt(byItem.get(itemId) ?? [], sceneId, story).custody
        note(now.holderId ? 'copyDroppedOther' : now.placeId ? 'copyDroppedPlaced' : 'copyDroppedNowhere', itemId, () => `${nameOf(characterId)} at ${nameOf(sceneId)} lists ${nameOf(itemId)}; statements: ${describeCustody(now, nameOf)}`)
      }
    }
    for (const [itemId, characterId] of holderNow) {
      if ((inventoryOf.get(characterId) ?? []).includes(itemId)) continue
      note('gained', itemId, () => `${nameOf(characterId)} given ${nameOf(itemId)} at ${nameOf(sceneId)}, which their record there does not list`)
    }
    for (const [itemId, holders] of sharedNow) {
      for (const characterId of holders) {
        if ((inventoryOf.get(characterId) ?? []).includes(itemId)) continue
        note('gained', itemId, () => `${nameOf(characterId)} given some ${nameOf(itemId)} at ${nameOf(sceneId)}, which their record there does not list`)
      }
    }
  }
  for (const a of ambiguities.slice(0, 3)) r.samples.push(`taken by two at once: ${nameOf(a.itemId)} at ${nameOf(a.sceneId)} by ${a.holders.map(nameOf).join(' and ')}; kept ${nameOf(a.kept)}`)
  return r
}

describe('custody probe', () => {
  it('compares custody as statements with custody as read today, in every book', async () => {
    if (!existsSync(LIBRARY)) throw new Error(`No library at ${LIBRARY}. Clone SirFoxworthTheThird/Kathala-Library beside this repository, or set KATHALA_LIBRARY.`)
    const files = [
      ...readdirSync(LIBRARY).filter((f) => f.endsWith('.pwk')).sort().map((f) => join(LIBRARY, f)),
      ...LOCAL.flatMap((dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.pwk')).sort().map((f) => join(dir, f)) : [])),
    ]
    const results: BookResult[] = []
    const failed: string[] = []
    for (const file of files) {
      const name = file.replace(/^.*\//, '').replace('.pwk', '')
      try { results.push(await probe(name, readFileSync(file, 'utf8'))) } catch (err) { failed.push(`${name}: ${String(err).split('\n')[0]}`) }
    }
    const causes: Cause[] = [...WHERE, ...HELD]
    const sum = (f: (b: BookResult) => number) => results.reduce((n, b) => n + f(b), 0)
    const cause = (k: Cause) => `${k} ${sum((b) => b.count[k])} (${sum((b) => b.itemsBy[k].size)} items, ${results.filter((b) => b.count[k]).length} worlds)`
    const rows = results.map((b) => [
      b.name.padEnd(48), String(b.scenes).padStart(5), String(b.items).padStart(5), String(b.mentions).padStart(7), String(b.placements).padStart(6), String(b.statements).padStart(6),
      ...causes.map((k) => String(b.count[k]).padStart(6)),
    ].join(' '))
    const report = [
      `${results.length} worlds probed${failed.length ? `, ${failed.length} not read` : ''}`,
      `${sum((b) => b.items)} items (${sum((b) => b.collective)} collective); ${sum((b) => b.mentions)} item mentions in ${sum((b) => b.listing)} records, and ${sum((b) => b.placements)} placements → ${sum((b) => b.statements)} statements`,
      `where it is, ${sum((b) => b.readings)} item × scene readings: ${WHERE.map(cause).join('; ')}`,
      `what a person holds, ${sum((b) => b.personReadings)} person × scene readings: ${HELD.map(cause).join('; ')}`,
      `taken by two at once at one scene: ${sum((b) => b.ambiguous)}`,
      `stored by the import and not derived here, or derived and not stored: ${sum((b) => b.storedDiffers)}`,
      '',
      `${'world'.padEnd(48)} scenes items mentions placed stmts ${causes.map((k) => k.slice(0, 6).padStart(6)).join(' ')}`,
      ...rows,
      ...(failed.length ? ['', '=== NOT READ ===', ...failed] : []),
      '',
      '=== SAMPLES (one per cause and item) ===',
      ...results.filter((b) => b.samples.length).flatMap((b) => [`[${b.name}]`, ...b.samples.map((s) => `  ${s}`)]),
    ].join('\n')
    writeFileSync(OUT, `${report}\n`)
    process.stdout.write(`${report.split('\n').slice(0, 6).join('\n')}\n\nprobe: written to ${OUT}\n`)
  })
})
