import type { CharacterSnapshot } from '@/types'
import type { ChapterStub, EventStub } from '@/lib/snapshotUtils'

/** A scene, with the title needed to name it in the sentence shown to the writer. */
export type TitledEvent = EventStub & { title: string }

/**
 * Where an edit to an earlier scene stops mattering, and what it would take to
 * carry it forward (**F2**).
 *
 * A `CharacterSnapshot` is a whole state record, not a delta of the field that
 * changed. So recording one fact at a scene pins every other fact there, and the
 * most natural draft-two edit — going back to say "actually she's had this since
 * chapter one" — stops dead at the next scene that recorded anything at all. The
 * writer is told nothing.
 *
 * The model is not the problem and is not changed here: a record at a later
 * scene **is** the writer's statement about that scene, and an earlier edit must
 * not overwrite it. What was wrong is the silence.
 *
 * So this answers two questions after a save:
 *
 *  - **Which later records still show the value you just replaced?** Those are
 *    the ones that merely inherited it, and they are what "carry it forward"
 *    would rewrite.
 *  - **Where does the run end?** At the first later record holding something
 *    else. That is a decision the writer already made, and it is left alone —
 *    the same rule the continuity checker's move fix follows.
 *
 * When nothing later holds the old value there is nothing to say, and the caller
 * stays quiet: the change either reaches the end of the book or runs straight
 * into a decision that was made on purpose.
 */

export type CarryField =
  | 'isAlive'
  | 'currentLocationMarkerId'
  | 'inventoryItemIds'
  | 'inventoryNotes'
  | 'statusNotes'
  | 'travelModeId'

/** What the app calls each field when it has to name one in a sentence. */
export const CARRY_FIELD_LABEL: Record<CarryField, string> = {
  isAlive: 'status',
  currentLocationMarkerId: 'location',
  inventoryItemIds: 'inventory',
  inventoryNotes: 'inventory notes',
  statusNotes: 'notes',
  travelModeId: 'travel mode',
}

export interface CarryTarget {
  snapshot: CharacterSnapshot
  chapterNumber: number
  sceneTitle: string
}

export interface CarryForwardPlan {
  /** Later records still showing the replaced value, in narrative order. */
  targets: CarryTarget[]
  /** The record that ends the run, where something else was already decided. */
  stopsAt: CarryTarget | null
}

/** Order-insensitive for arrays, plain equality otherwise. */
export function sameFieldValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    const x = [...a].map(String).sort()
    const y = [...b].map(String).sort()
    return x.every((v, i) => v === y[i])
  }
  return a === b
}

export function carryForwardPlan(args: {
  /** Every snapshot for the character being edited. */
  snapshots: CharacterSnapshot[]
  /** The scene just saved. */
  fromEventId: string
  field: CarryField
  /** The value that scene held *before* the edit. */
  previousValue: unknown
  events: TitledEvent[]
  chapters: ChapterStub[]
}): CarryForwardPlan {
  const { snapshots, fromEventId, field, previousValue, events, chapters } = args

  const chapterNumber = new Map(chapters.map((c) => [c.id, c.number]))
  const order = new Map<string, number>()
  const titleOf = new Map<string, string>()
  const chapterOf = new Map<string, number>()
  const ordered = [...events].sort((a, b) => {
    const byChapter = (chapterNumber.get(a.chapterId) ?? 0) - (chapterNumber.get(b.chapterId) ?? 0)
    return byChapter !== 0 ? byChapter : a.sortOrder - b.sortOrder
  })
  ordered.forEach((e, i) => {
    order.set(e.id, i)
    chapterOf.set(e.id, chapterNumber.get(e.chapterId) ?? 0)
    titleOf.set(e.id, e.title)
  })

  const from = order.get(fromEventId)
  if (from === undefined) return { targets: [], stopsAt: null }

  const later = snapshots
    .filter((s) => {
      const at = order.get(s.eventId)
      return at !== undefined && at > from
    })
    .sort((a, b) => (order.get(a.eventId) ?? 0) - (order.get(b.eventId) ?? 0))

  const describe = (s: CharacterSnapshot): CarryTarget => ({
    snapshot: s,
    chapterNumber: chapterOf.get(s.eventId) ?? 0,
    sceneTitle: titleOf.get(s.eventId) ?? '',
  })

  const targets: CarryTarget[] = []
  for (const s of later) {
    if (sameFieldValue(s[field], previousValue)) {
      targets.push(describe(s))
      continue
    }
    // A different value here is a decision already taken; the run ends.
    return { targets, stopsAt: describe(s) }
  }
  return { targets, stopsAt: null }
}

/** The sentence shown after a save, or null when there is nothing to say. */
export function describeCarryForward(
  plan: CarryForwardPlan,
  characterName: string,
  field: CarryField,
): string | null {
  const first = plan.targets[0]
  if (!first) return null
  const where = `Ch. ${first.chapterNumber} · ${first.sceneTitle || 'untitled scene'}`
  const rest = plan.targets.length - 1
  const alsoAfter = rest > 0 ? ` and ${rest} scene${rest === 1 ? '' : 's'} after it` : ''
  return `${characterName}'s ${CARRY_FIELD_LABEL[field]} is recorded again at ${where}${alsoAfter}, without this change.`
}
