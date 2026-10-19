import type { CharacterSnapshot } from '@/types'
import { lastKnownRecords, type Story } from './stateEngine'

/*
  An edit carried over the records it made stale (run 11's record-drift plan,
  option A: `docs/records/run-11-record-drift-plan.md`).

  A person's record holds their whole inventory, copied from their last one
  whenever anything is written for them. So an item moved at scene S, from
  Anna to Bruno, is still in the copy of Anna's inventory at every later
  scene she was recorded at — and the later record wins. Writer run 11 gave
  the Book to Bruno at S1 and found it back with Anna at S2 (W-3); burned a
  leaf and found it in Lucia's hands for fourteen scenes after (W-8).

  The walk goes through the later scenes of S's era, in book order, for as
  long as the item's holders there — as the records stood *before* the edit —
  are the ones it had at S before the edit. Those records said nothing about
  the item: they are copies. Each loses it from whoever the edit took it from,
  and gains it for whoever the edit gave it to. The first scene where the
  holders were anything else, or where the item was put somewhere or had its
  condition set, is the writer's next word about it, and the walk stops there.

  No record says which inventories were copied, and none has to: a scene where
  the old holder still held the item is, by the stop rule, one where nothing
  was said of it. The stop rule is `itemCarryPlan`'s (`carryForward.ts`), which
  the Current State panel offers on request; a header has no such offer, and
  the run's drift all came through headers, so this is done as part of the
  edit, in its undo step.
*/

/** The people holding `itemId` at `sceneId`, each by their last record there. */
export function holdersAt(itemId: string, sceneId: string, records: readonly CharacterSnapshot[], story: Story): Set<string> {
  return new Set(
    lastKnownRecords([...records], sceneId, story, 'person', (s) => s.characterId)
      .filter((s) => s.inventoryItemIds.includes(itemId))
      .map((s) => s.characterId),
  )
}

const same = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((x) => b.has(x))

/**
 * The inventories to rewrite after an edit at `from` moved `itemId` from the
 * holders `before` to the holders `after`: one entry per record, by id, with
 * its whole new inventory. Empty when the edit moved nothing.
 *
 * `original` is every record of the world as it stood before the edit, and
 * the holders the walk compares are read from it: read from the records after
 * it, somebody given the item at `from` with no record later carries it
 * through every later scene, and the walk would stop at the first. `current`
 * is the records after the edit, which are the ones rewritten. `stated` is the
 * scenes where the item was put somewhere or had its condition set: statements
 * about it, which stop the walk as a change of holder does.
 */
export function staleCopies({ itemId, from, before, after, original, current, stated, story }: {
  itemId: string
  from: string
  before: ReadonlySet<string>
  after: ReadonlySet<string>
  original: readonly CharacterSnapshot[]
  current: readonly CharacterSnapshot[]
  stated: ReadonlySet<string>
  story: Story
}): Array<{ id: string; eventId: string; inventoryItemIds: string[] }> {
  if (same(before, after)) return []
  const start = story.position(from)
  if (start === -1) return []
  const era = story.timelineOf(from)
  const lost = [...before].filter((p) => !after.has(p))
  const gained = [...after].filter((p) => !before.has(p))

  // The later scenes in this era that anything could be said of the item at, in book order.
  const scenes = [...new Set([...original, ...current].map((s) => s.eventId).concat([...stated]))]
    .filter((id) => {
      const at = story.position(id)
      return at !== -1 && at > start && story.sameEra(era, story.timelineOf(id))
    })
    .sort((a, b) => story.position(a) - story.position(b))

  const edits: Array<{ id: string; eventId: string; inventoryItemIds: string[] }> = []
  for (const scene of scenes) {
    if (stated.has(scene)) break
    if (!same(holdersAt(itemId, scene, original, story), before)) break
    for (const r of current) {
      if (r.eventId !== scene) continue
      const has = r.inventoryItemIds.includes(itemId)
      if (has && lost.includes(r.characterId)) {
        edits.push({ id: r.id, eventId: scene, inventoryItemIds: r.inventoryItemIds.filter((i) => i !== itemId) })
      } else if (!has && gained.includes(r.characterId)) {
        edits.push({ id: r.id, eventId: scene, inventoryItemIds: [...r.inventoryItemIds, itemId] })
      }
    }
  }
  return edits
}
