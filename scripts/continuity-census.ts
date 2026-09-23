import { describe, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { computeContinuityIssues, type ContinuityInput } from '../src/lib/continuity/computeIssues'

/**
 * Run the continuity checker over every book on the Library shelf.
 *
 * Not a test — nothing here asserts, and it is kept out of `npm run test` by
 * its own config. It answers the question the unit tests cannot: *what does
 * this checker actually say about forty-six real novels?*
 *
 * The first run of it found that three checks produced 89% of all output and
 * that all three were wrong. `prose-untagged` fired per name rather than per
 * scene — 4,894 warnings, three quarters of everything. `prose-dead` reported
 * Billy Bones thirty-eight times on *Treasure Island*, where he dies in chapter
 * three and the whole plot is his map. `dup-item` called an item recorded both
 * in a hand and at a place a contradiction, at `error` severity, 552 times —
 * and not one of those was two people holding the same thing.
 *
 * None of that was visible from a unit test, because a unit test is written by
 * the same person who wrote the rule and asks it the question it was built to
 * answer. A corpus asks a different one.
 *
 *   npm run census
 *   KATHALA_LIBRARY=../elsewhere npm run census
 */

const LIBRARY = join(process.env.KATHALA_LIBRARY ?? '../Kathala-Library', 'library')
const OUT = process.env.CENSUS_OUT ?? 'continuity-census.txt'

/** Only the kinds named here are listed one by one, for reading in full. */
const DETAIL = (process.env.KINDS ?? '').split(',').filter(Boolean)

type Bag = Record<string, unknown[]>

/** A `.pwk` is the same collections the app holds, so it maps straight across. */
function inputFor(world: Record<string, unknown>): ContinuityInput {
  const b = world as unknown as Bag
  const arr = (k: string) => (Array.isArray(b[k]) ? b[k] : []) as never[]
  return {
    worldId: (world.world as { id: string }).id,
    world: world.world as never,
    chapters: arr('chapters'), allEvents: arr('events'), characters: arr('characters'),
    rels: arr('relationships'), items: arr('items'), snapshots: arr('characterSnapshots'),
    knowledgeFacts: arr('knowledgeFacts'), knowledgeReveals: arr('knowledgeReveals'),
    sceneTexts: arr('sceneTexts'), allRelSnaps: arr('relationshipSnapshots'),
    allItemPlacements: arr('itemPlacements'), allLocationSnapshots: arr('locationSnapshots'),
    allMarkers: arr('locationMarkers'), allLayers: arr('mapLayers'),
    travelModes: arr('travelModes'), allMovements: arr('characterMovements'),
    artifacts: arr('crossTimelineArtifacts'), allMapRoutes: arr('mapRoutes'),
    allMapRegions: arr('mapRegions'), allRegionSnapshots: arr('mapRegionSnapshots'),
    allFactions: arr('factions'), allMemberships: arr('factionMemberships'),
    allFactionRels: arr('factionRelationships'), allItemSnapshots: arr('itemSnapshots'),
    plotThreads: arr('plotThreads'),
  }
}

describe('continuity census', () => {
  it('reports what the checker says about every shipped book', () => {
    if (!existsSync(LIBRARY)) {
      throw new Error(
        `No library at ${LIBRARY}.\n` +
        '  Clone SirFoxworthTheThird/Kathala-Library beside this repository,\n' +
        '  or set KATHALA_LIBRARY to where it lives.',
      )
    }

    const books = readdirSync(LIBRARY).filter((f) => f.endsWith('.pwk')).sort()
    const rows: string[] = []
    const detail: string[] = []
    const byKind = new Map<string, number>()
    const samples = new Map<string, string>()
    let total = 0

    for (const file of books) {
      const name = file.replace('.pwk', '')
      const world = JSON.parse(readFileSync(join(LIBRARY, file), 'utf8')) as Record<string, unknown>
      const issues = computeContinuityIssues(inputFor(world))
      total += issues.length

      const counts = new Map<string, number>()
      for (const i of issues) {
        counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1)
        byKind.set(i.kind, (byKind.get(i.kind) ?? 0) + 1)
        if (!samples.has(i.kind)) samples.set(i.kind, `[${name}] ${i.severity} — ${i.message}`)
        if (DETAIL.includes(i.kind)) detail.push(`[${name}] ${i.kind} :: ${i.message} :: ${i.detail ?? ''}`)
      }
      const scenes = (world.events as unknown[] | undefined)?.length ?? 0
      rows.push(
        `${String(issues.length).padStart(5)}  ${String(scenes).padStart(4)} scenes  ${name}  ` +
        [...counts].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join(' '),
      )
    }

    const share = (n: number) => `${((n / total) * 100).toFixed(1)}%`
    const report = [
      `${total} issues across ${books.length} books`,
      '',
      '=== PER BOOK ===', ...rows,
      '',
      '=== BY KIND ===',
      ...[...byKind].sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${String(n).padStart(6)}  ${share(n).padStart(6)}  ${k}`),
      '',
      '=== ONE OF EACH ===',
      ...[...samples].sort().map(([k, s]) => `— ${k}\n   ${s}`),
      ...(detail.length ? ['', `=== EVERY ${DETAIL.join(', ')} ===`, ...detail] : []),
    ].join('\n')

    writeFileSync(OUT, `${report}\n`)
    process.stdout.write(`${report}\n\ncensus: written to ${OUT}\n`)
  })
})
