import { describe, it, expect } from 'vitest'

/**
 * The importable copy of a world and the shipped one agree about its lore.
 *
 * **EX-501** requires `example/` and `public/library/` to stay synchronized, and
 * nothing enforced it. Giving all 488 shipped lore pages a reveal point
 * (**R4a**) touched only `public/library/`, and eleven worlds silently ended up
 * with two versions of themselves — the downloadable one gated, the importable
 * one not. Nothing failed, because nothing was looking.
 *
 * Matched by world id rather than by filename: the two directories name the
 * same world differently (`the-wise-man-s-fear.pwk` against
 * `The Wise Man's Fear.pwk`), and the id is what an import actually keys on.
 *
 * **Scoped to lore, deliberately, and this is the honest part.** Nine other
 * worlds already differ between the two copies in ways that predate this rule
 * being tested at all — *Harry Potter* in six collections including its cast and
 * factions, *The Woman in White* in its chapters and events, *Fellowship* in its
 * items, four more in their blobs. Widening this test to every collection would
 * fail on those, and choosing which side of each is authoritative is an
 * authoring decision, not one a test should make on its own. Recorded here so
 * the narrowing is visible rather than quietly convenient.
 */

const libraryFiles = import.meta.glob('../../../public/library/*.pwk', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

const exampleFiles = import.meta.glob('../../../example/*.pwk', {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

interface Lore { id: string; visibleFromEventId: string | null; body: string }
interface World { world: { id: string }; lorePages?: Lore[] }

const parse = (files: Record<string, string>) =>
  new Map(Object.entries(files).map(([path, text]) => {
    const w = JSON.parse(text) as World
    return [w.world.id, { name: path.slice(path.lastIndexOf('/') + 1), world: w }] as const
  }))

const library = parse(libraryFiles)
const examples = parse(exampleFiles)

/** Just the lore facts the two copies must agree on, by page id. */
const loreOf = (w: World) =>
  Object.fromEntries((w.lorePages ?? []).map((p) => [p.id, [p.visibleFromEventId, p.body]]))

describe('example/ and public/library/ agree', () => {
  it('has both directories, holding the same worlds', () => {
    // Without this the rule below passes on an empty glob, or on two sets that
    // never meet and therefore never disagree.
    expect(library.size).toBeGreaterThan(20)
    expect(examples.size).toBe(library.size)
    expect([...library.keys()].filter((id) => !examples.has(id))).toEqual([])
  })

  it.each([...library.keys()].sort())('%s carries the same lore in both copies', (worldId) => {
    const shipped = library.get(worldId)!
    const importable = examples.get(worldId)!
    expect(loreOf(importable.world), `${importable.name} and ${shipped.name} disagree`)
      .toEqual(loreOf(shipped.world))
  })
})
