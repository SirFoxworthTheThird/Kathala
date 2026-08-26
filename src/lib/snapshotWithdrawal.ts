import { resolveSnapshot, type ChapterStub, type EventStub, type SnapBase } from './snapshotUtils'
import { computeSortKeySync } from './sortKey'

/**
 * What removing one recorded state does to the scenes around it.
 *
 * The delta model means a record is an assertion at one scene and every later
 * scene without its own record reads back through it. That makes a record made
 * by accident expensive in a way a writer cannot see: a blind run saved an
 * empty Current State for a character at two scenes he is not in, and the rest
 * of the book read "Unknown / not set" from then on, because an empty record is
 * a statement that his whereabouts are unknown rather than an absence of one.
 *
 * So withdrawing has to be offered, and it has to say what it will do before it
 * does it. `fallback` is the record that takes over at the same scene once this
 * one is gone — the same lookup the panel does — and `followers` counts the
 * later scenes reading from the record being removed, which will follow it back
 * to `fallback`. Records at later scenes of their own are untouched: this is a
 * withdrawal of one assertion, not a cascade.
 */
export interface WithdrawalOutcome<T extends SnapBase> {
  fallback: T | undefined
  followers: number
}

export function withdrawalOutcome<T extends SnapBase & { id: string }>(
  own: T[],
  snapshotId: string,
  allEvents: EventStub[],
  allChapters: ChapterStub[],
): WithdrawalOutcome<T> {
  const removed = own.find((s) => s.id === snapshotId)
  if (!removed) return { fallback: undefined, followers: 0 }

  const rest = own.filter((s) => s.id !== snapshotId)
  const fallback = resolveSnapshot(rest, removed.eventId, allEvents, allChapters)

  const eventById = new Map(allEvents.map((e) => [e.id, e]))
  const chapNumById = new Map(allChapters.map((c) => [c.id, c.number]))
  const removedOrder = computeSortKeySync(removed.eventId, eventById, chapNumById)

  let followers = 0
  if (removedOrder !== -1) {
    for (const ev of allEvents) {
      const order = computeSortKeySync(ev.id, eventById, chapNumById)
      if (order === -1 || order <= removedOrder) continue
      if (resolveSnapshot(own, ev.id, allEvents, allChapters)?.id === snapshotId) followers += 1
    }
  }

  return { fallback, followers }
}

/**
 * The sentence the confirmation shows. It names where the state goes back to,
 * because "delete this record" is not what the writer is deciding — they are
 * deciding what this character's whereabouts become.
 */
export function describeWithdrawal(
  name: string,
  fallbackLabel: string | null,
  followers: number,
): string {
  const head = fallbackLabel
    ? `${name}'s state at this scene will go back to being carried forward from ${fallbackLabel}.`
    : `${name} will have no recorded state at or before this scene.`
  if (followers === 0) return head
  const tail = `${followers} later scene${followers === 1 ? '' : 's'} currently read${followers === 1 ? 's' : ''} from this record and will follow.`
  return `${head} ${tail}`
}
