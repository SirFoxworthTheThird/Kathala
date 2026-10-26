import 'fake-indexeddb/auto'
import { describe, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { db } from '../src/db/database'
import { importWorldFromJson } from '../src/lib/exportImport'
import { lastKnownOne, lastKnownRecords, storyOf } from '../src/lib/stateEngine'
import { FACETS, peopleAt, personAt, sparseRecords, wholeRecords, type Facet } from '../src/lib/personState'
import type { CharacterSnapshot } from '../src/types'

/**
 * The equivalence probe for Part B2 (next-plan.md): a person's state as
 * sparse statements — each field kept only where it changes — against the
 * whole-state records every book has, read every way the app reads them.
 *
 * Not a test: it reads the Library, which is not part of this repository, and
 * asserts nothing. Every reading that differs is counted by facet and by how it
 * was read, with a sample of each to be read by a person:
 *
 * - `atScene`: a person's state at every scene of the book, as Current State,
 *   the map and the brief read it (`resolveCharacterSnapshot`).
 * - `scoped`: everybody's state at each scene of one timeline, among that
 *   timeline's records only, as the map's playback reads it.
 * - `noCursor`: everybody's state with no moment chosen — each person's most
 *   recently updated record.
 * - `whole`: each record read whole at its own scene, as a person's history,
 *   the checker and a chapter's diff read them.
 *
 * Each world goes in through the app's own import, as a user's would.
 *
 *   npm run probe:person
 *   KATHALA_LIBRARY=../elsewhere PROBE_OUT=person.txt npm run probe:person
 */

const LIBRARY = join(process.env.KATHALA_LIBRARY ?? '../Kathala-Library', 'library')
const OUT = process.env.PROBE_OUT ?? 'person-probe.txt'
const LOCAL = ['docs/records', 'e2e/fixtures', 'src/test/fixtures/worlds']
const READINGS = ['atScene', 'scoped', 'noCursor', 'whole'] as const
type Reading = (typeof READINGS)[number]

interface BookResult {
  name: string
  people: number
  scenes: number
  records: number
  /** Facet values across every record, and those dropped as repeats of the state before. */
  said: number
  dropped: Record<Facet, number>
  /** Place repeats kept as statements: at a scene set there, with the person in its cast. */
  pins: number
  readings: Record<Reading, number>
  differs: Record<Reading, Record<Facet | 'anchor', number>>
  ms: { whole: number; sparse: number; wholeRecords: number }
  samples: string[]
}

const FIELD_OF: Record<Facet, (s: CharacterSnapshot) => unknown> = {
  alive: (s) => s.isAlive,
  place: (s) => `${s.currentLocationMarkerId}|${s.currentMapLayerId}`,
  travel: (s) => s.travelModeId,
  status: (s) => s.statusNotes,
  // Two of the Library's records have no inventory notes at all; read, that is none.
  carrying: (s) => s.inventoryNotes ?? '',
}

async function probe(name: string, json: string): Promise<BookResult> {
  await Promise.all(db.tables.map((t) => t.clear()))
  const worldId = await importWorldFromJson(json)
  const [events, chapters, timelines, world, characters, full] = await Promise.all([
    db.events.where('worldId').equals(worldId).toArray(),
    db.chapters.where('worldId').equals(worldId).toArray(),
    db.timelines.where('worldId').equals(worldId).toArray(),
    db.worlds.get(worldId),
    db.characters.where('worldId').equals(worldId).toArray(),
    db.characterSnapshots.where('worldId').equals(worldId).toArray() as Promise<CharacterSnapshot[]>,
  ])
  const story = storyOf(events, chapters, timelines, { pinsSetClock: world?.pinsSetClock })
  const eventById = new Map(events.map((e) => [e.id, e]))
  const nameOf = new Map<string, string>([...characters.map((c) => [c.id, c.name] as [string, string]), ...events.map((e) => [e.id, `“${e.title}”`] as [string, string])])
  const label = (id: string) => nameOf.get(id) ?? id

  // A place said again where the scene is set, with the person in it: the header placing its cast, kept as said.
  const pin = (r: CharacterSnapshot, facet: Facet) => {
    if (facet !== 'place') return false
    const e = eventById.get(r.eventId)
    return !!e && !!r.currentLocationMarkerId && e.locationMarkerId === r.currentLocationMarkerId && e.involvedCharacterIds.includes(r.characterId)
  }
  const { records: sparse, dropped, kept } = sparseRecords(full, story, pin)

  const zero = () => Object.fromEntries([...FACETS, 'anchor'].map((k) => [k, 0])) as Record<Facet | 'anchor', number>
  const r: BookResult = {
    name, people: new Set(full.map((s) => s.characterId)).size, scenes: events.length, records: full.length,
    said: full.length * FACETS.length, dropped, pins: kept.place,
    readings: Object.fromEntries(READINGS.map((k) => [k, 0])) as Record<Reading, number>,
    differs: Object.fromEntries(READINGS.map((k) => [k, zero()])) as BookResult['differs'],
    ms: { whole: 0, sparse: 0, wholeRecords: 0 },
    samples: [],
  }
  const seen = new Set<string>()
  const compare = (reading: Reading, before: CharacterSnapshot | undefined, after: CharacterSnapshot | undefined, where: string) => {
    r.readings[reading]++
    if (!before && !after) return
    if (!before || !after || before.eventId !== after.eventId) {
      r.differs[reading].anchor++
      const key = `${reading}|anchor`
      if (!seen.has(key) && r.samples.length < 30) { seen.add(key); r.samples.push(`${reading} anchor: ${where}: ${before?.eventId ? label(before.eventId) : 'none'} → ${after?.eventId ? label(after.eventId) : 'none'}`) }
      return
    }
    for (const facet of FACETS) {
      const [a, b] = [FIELD_OF[facet](before), FIELD_OF[facet](after)]
      if (a === b) continue
      r.differs[reading][facet]++
      const key = `${reading}|${facet}|${before.characterId}`
      if (!seen.has(key) && r.samples.length < 30) { seen.add(key); r.samples.push(`${reading} ${facet}: ${where}: ${String(a)} → ${String(b)}`) }
    }
  }

  const fullBy = new Map<string, CharacterSnapshot[]>()
  for (const s of full) fullBy.set(s.characterId, [...(fullBy.get(s.characterId) ?? []), s])
  const sparseBy = new Map<string, typeof sparse>()
  for (const s of sparse) sparseBy.set(s.characterId, [...(sparseBy.get(s.characterId) ?? []), s])

  for (const [who, own] of fullBy) {
    const mine = sparseBy.get(who) ?? []
    for (const e of events) {
      let t = performance.now()
      // `resolveCharacterSnapshot`'s reading; the hook module is not importable here, outside the app.
      const before = lastKnownOne(own, e.id, story, 'person')?.record
      r.ms.whole += performance.now() - t
      t = performance.now()
      const after = personAt(mine, e.id, story)
      r.ms.sparse += performance.now() - t
      compare('atScene', before, after, `${label(who)} at ${label(e.id)}`)
    }
  }

  for (const tl of timelines) {
    const scope = new Set(events.filter((e) => e.timelineId === tl.id).map((e) => e.id))
    if (scope.size === 0) continue
    const inScope = sparse.filter((s) => scope.has(s.eventId))
    for (const sceneId of scope) {
      // `selectBestCharacterSnapshots`'s reading, scoped.
      const before = new Map(lastKnownRecords(full.filter((s) => scope.has(s.eventId)), sceneId, story, 'person', (s) => s.characterId).map((s) => [s.characterId, s]))
      const after = new Map(peopleAt(inScope, sceneId, story).map((s) => [s.characterId, s]))
      for (const who of new Set([...before.keys(), ...after.keys()])) compare('scoped', before.get(who), after.get(who), `${label(who)} at ${label(sceneId)} in ${tl.name}`)
    }
  }

  const noneBefore = new Map(lastKnownRecords(full, null, story, 'person', (s) => s.characterId).map((s) => [s.characterId, s]))
  const noneAfter = new Map(peopleAt(sparse, null, story).map((s) => [s.characterId, s]))
  for (const who of new Set([...noneBefore.keys(), ...noneAfter.keys()])) compare('noCursor', noneBefore.get(who), noneAfter.get(who), `${label(who)} with no moment`)

  const t0 = performance.now()
  const filled = wholeRecords(sparse, story)
  r.ms.wholeRecords = performance.now() - t0
  full.forEach((s, i) => compare('whole', s, filled[i], `${label(s.characterId)}'s record at ${label(s.eventId)}`))
  return r
}

describe('person probe', () => {
  it('compares a person’s state as sparse statements with whole-state records, in every book', async () => {
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
    const sum = (f: (b: BookResult) => number) => results.reduce((n, b) => n + f(b), 0)
    const facets = [...FACETS, 'anchor'] as const
    const reading = (k: Reading) => `${k} ${sum((b) => b.readings[k])} readings: ${facets.map((f) => `${f} ${sum((b) => b.differs[k][f])}`).join(', ')}`
    const droppedAll = sum((b) => FACETS.reduce((n, f) => n + b.dropped[f], 0))
    const report = [
      `${results.length} worlds probed${failed.length ? `, ${failed.length} not read` : ''}`,
      `${sum((b) => b.records)} records of ${sum((b) => b.people)} people over ${sum((b) => b.scenes)} scenes: ${sum((b) => b.said)} field values, ${droppedAll} dropped as repeats (${FACETS.map((f) => `${f} ${sum((b) => b.dropped[f])}`).join(', ')}); ${sum((b) => b.pins)} place repeats kept as the header's word`,
      'differences, by how the state is read:',
      ...READINGS.map((k) => `  ${reading(k)}`),
      `time reading every person at every scene: whole ${Math.round(sum((b) => b.ms.whole))} ms, sparse ${Math.round(sum((b) => b.ms.sparse))} ms`,
      `time reading a world's records whole (wholeRecords), the most: ${[...results].sort((a, b) => b.ms.wholeRecords - a.ms.wholeRecords).slice(0, 3).map((b) => `${b.name} ${b.records} records ${Math.round(b.ms.wholeRecords)} ms`).join('; ')}`,
      '',
      `${'world'.padEnd(48)} people scenes records dropped  pins ${READINGS.map((k) => k.padStart(8)).join(' ')}`,
      ...results.map((b) => [
        b.name.padEnd(48), String(b.people).padStart(6), String(b.scenes).padStart(6), String(b.records).padStart(7),
        String(FACETS.reduce((n, f) => n + b.dropped[f], 0)).padStart(7), String(b.pins).padStart(5),
        ...READINGS.map((k) => String(facets.reduce((n, f) => n + b.differs[k][f], 0)).padStart(8)),
      ].join(' ')),
      ...(failed.length ? ['', '=== NOT READ ===', ...failed] : []),
      '',
      '=== SAMPLES ===',
      ...results.filter((b) => b.samples.length).flatMap((b) => [`[${b.name}]`, ...b.samples.map((s) => `  ${s}`)]),
    ].join('\n')
    writeFileSync(OUT, `${report}\n`)
    process.stdout.write(`${report.split('\n').slice(0, 10).join('\n')}\n\nprobe: written to ${OUT}\n`)
  })
})
