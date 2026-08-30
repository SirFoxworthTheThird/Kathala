import { describe, it, expect } from 'vitest'

/**
 * **If a snapshot write spreads an existing record, it must name the scene it
 * writes to.**
 *
 * This rule exists because the same mistake has now been made four times, in
 * four places, and cost a writer's data every time. The shape is always
 * identical: `useBestSnapshots` (or `resolveSnapshot`) returns each character's
 * *last known* record at or before the cursor — a record whose `eventId` is
 * often an **earlier scene** — and the caller spreads it into `upsertSnapshot`.
 * The `eventId` rides along, and the write lands on that earlier scene,
 * rewriting an assertion the writer made about a moment they were not editing.
 *
 * - The continuity checker's "Move to <place>" fix wrote defaults over it.
 * - The Current State tab's item hand-off erased the previous holder's
 *   chapter-one inventory.
 * - The map's character panel did the same on its inventory transfer — found by
 *   grepping for the shape rather than by anybody hitting it.
 *
 * Each fix was one word. Nothing about the types stops the next one, because a
 * resolved snapshot and a record at this scene are the same type, and a spread
 * is exactly the operation that hides the difference.
 *
 * So: spreading is allowed, and naming the scene is compulsory. A write that
 * says `eventId: activeEventId` is making a claim the reader can check; one that
 * inherits it silently is not. Two of the current call sites name an `eventId`
 * they would have inherited correctly anyway — that is the point. The rule has
 * to be uniform, or the dangerous case hides among the safe ones.
 *
 * **What this does not catch**, stated plainly because a rule oversold is worse
 * than no rule: writing `eventId: resolved.eventId` on purpose passes, and is
 * exactly as wrong as inheriting it. Checked — mutating a call site to that form
 * leaves this green. The rule turns an invisible mistake into a visible one; it
 * does not decide whether the visible answer is right. That is a reviewer's job,
 * and now there is something on the line for them to look at.
 */

const sources = import.meta.glob(['../../features/**/*.tsx', '../../features/**/*.ts', '../../db/**/*.ts'], {
  eager: true, query: '?raw', import: 'default',
}) as Record<string, string>

/** The object literal of every `upsertSnapshot({ … })` call, brace-balanced. */
export function upsertSnapshotArguments(src: string): string[] {
  const out: string[] = []
  const marker = 'upsertSnapshot({'
  let from = 0
  for (;;) {
    const at = src.indexOf(marker, from)
    if (at === -1) return out
    let depth = 0
    let i = at + marker.length - 1
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') {
        depth--
        if (depth === 0) break
      }
    }
    out.push(src.slice(at + marker.length - 1, i + 1))
    from = i + 1
  }
}

const spreads = (arg: string) => /\.\.\./.test(arg)
const namesScene = (arg: string) => /\beventId\s*:/.test(arg)

describe('a snapshot write that spreads names its scene', () => {
  it('has sources to read, and finds the calls in them', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50)
    const calls = Object.values(sources).flatMap(upsertSnapshotArguments)
    expect(calls.length).toBeGreaterThan(5)
    expect(calls.some(spreads)).toBe(true)
  })

  it('names the scene at every spreading call site', () => {
    const offenders: string[] = []
    for (const [path, src] of Object.entries(sources)) {
      for (const arg of upsertSnapshotArguments(src)) {
        if (spreads(arg) && !namesScene(arg)) {
          offenders.push(`${path}: ${arg.replace(/\s+/g, ' ').slice(0, 120)}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('reads the calls it claims to read, so the scan is not vacuous', () => {
    // The exact shape that caused the fault, three times over.
    const bad = 'await upsertSnapshot({ ...s, inventoryItemIds: [] })'
    expect(upsertSnapshotArguments(bad)).toHaveLength(1)
    expect(spreads(upsertSnapshotArguments(bad)[0])).toBe(true)
    expect(namesScene(upsertSnapshotArguments(bad)[0])).toBe(false)

    // …and the shape that is fine.
    const good = 'await upsertSnapshot({ ...s, eventId: activeEventId, inventoryItemIds: [] })'
    expect(namesScene(upsertSnapshotArguments(good)[0])).toBe(true)

    // A nested brace does not end the argument early.
    const nested = 'upsertSnapshot({ ...s, eventId: id, meta: { a: 1 }, x: 2 })'
    expect(upsertSnapshotArguments(nested)[0]).toContain('x: 2')

    // A call with no spread is not the rule's business.
    expect(spreads(upsertSnapshotArguments('upsertSnapshot({ eventId: e, worldId: w })')[0])).toBe(false)
  })
})
