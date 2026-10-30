import type { CharacterSnapshot } from '@/types'
import type { Placed } from '@/lib/bookOrder'
import type { Story } from '@/lib/stateEngine'

/** A scene, with the title needed to name it in the sentence shown to the writer. */
export type TitledEvent = Placed & { id: string; title: string }

type ChapterStub = { id: string; number: number }

/** A later record an item could be carried into, and where it is in the book. */
export interface CarryTarget {
  snapshot: CharacterSnapshot
  chapterNumber: number
  sceneTitle: string
}

/**
 * An item held at a scene and missing from the holder's later records: where
 * carrying it forward would put it back (**T-2**).
 *
 * A toast just after a save used to ask it, from the value the save
 * replaced, and only then. A writer run recorded every character's state
 * first and handed the items out afterwards — the natural order for a book
 * already written — so every later record predated the item and it vanished
 * the scene after it was given. The toast went in seven seconds, and after any
 * other change at that scene was never offered again: the value it compared
 * against was no longer the one those records held. Ilse had 63 of them.
 *
 * So this asks the question from the records alone, any time: the holder's
 * later records that lack the item, in order, up to the first that has it or
 * the first scene where it is somewhere else — another character holds it, or
 * it is placed at a location. Those are decisions about the item, and the run
 * stops at them. Empty when the next record already has it.
 */
export function itemCarryPlan(args: {
  characterId: string
  itemId: string
  /** The scene the item is held at. */
  fromEventId: string
  /** Every character's records in the world. */
  snapshots: CharacterSnapshot[]
  placements: ReadonlyArray<{ itemId: string; eventId: string }>
  events: TitledEvent[]
  chapters: ChapterStub[]
  /** The book's eras: the run is through this era's scenes only. Without it, one era. */
  story?: Story
}): CarryTarget[] {
  const { characterId, itemId, fromEventId, snapshots, placements, events, chapters, story } = args
  const chapterNumber = new Map(chapters.map((c) => [c.id, c.number]))
  const ordered = [...events].sort((a, b) => {
    const byChapter = (chapterNumber.get(a.chapterId) ?? 0) - (chapterNumber.get(b.chapterId) ?? 0)
    return byChapter !== 0 ? byChapter : a.sortOrder - b.sortOrder
  })
  const from = ordered.findIndex((e) => e.id === fromEventId)
  if (from < 0) return []

  const placed = new Set(placements.filter((p) => p.itemId === itemId).map((p) => p.eventId))
  const targets: CarryTarget[] = []
  const era = story?.timelineOf(fromEventId) ?? null
  for (const scene of ordered.slice(from + 1)) {
    if (story && !story.sameEra(era, story.timelineOf(scene.id))) continue
    const here = snapshots.filter((s) => s.eventId === scene.id)
    if (placed.has(scene.id) || here.some((s) => s.characterId !== characterId && s.inventoryItemIds.includes(itemId))) break
    const own = here.find((s) => s.characterId === characterId)
    if (!own) continue
    if (own.inventoryItemIds.includes(itemId)) break
    targets.push({ snapshot: own, chapterNumber: chapterNumber.get(scene.chapterId) ?? 0, sceneTitle: scene.title })
  }
  return targets
}
