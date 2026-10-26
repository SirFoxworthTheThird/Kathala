import type { CharacterSnapshot } from '@/types'
import type { Dated, Story } from './stateEngine'
import type { PersonRecord } from './personState'
import { personAtScene, personRecordAt } from './stateAt'

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
export interface WithdrawalOutcome<T extends Dated> {
  fallback: T | undefined
  followers: number
}

/** The parts of a person's state a scene reads (Part B2): what a withdrawal can change. */
const read = (s: CharacterSnapshot | undefined) => s
  ? [s.isAlive, s.currentLocationMarkerId, s.currentMapLayerId, s.travelModeId, s.statusNotes, s.inventoryNotes].join('|')
  : ''

/**
 * `own` is the person's records as stored. A record says only what its scene
 * said (Part B2), so a later record that says something else of them still
 * reads the rest from this one: it follows, too, though it is a record of its
 * own. A follower is a later scene whose reading changes, or whose last record
 * this is.
 */
export function withdrawalOutcome<T extends PersonRecord>(
  own: T[],
  snapshotId: string,
  scenes: ReadonlyArray<{ id: string }>,
  story: Story,
): WithdrawalOutcome<T> {
  const removed = own.find((s) => s.id === snapshotId)
  if (!removed) return { fallback: undefined, followers: 0 }

  const rest = own.filter((s) => s.id !== snapshotId)
  const fallback = personRecordAt(rest, removed.eventId, story)

  const removedOrder = story.position(removed.eventId)

  let followers = 0
  if (removedOrder !== -1) {
    for (const ev of scenes) {
      const order = story.position(ev.id)
      if (order === -1 || order <= removedOrder) continue
      const anchored = personRecordAt(own, ev.id, story)?.id === snapshotId
      if (anchored || read(personAtScene(own, ev.id, story)) !== read(personAtScene(rest, ev.id, story))) followers += 1
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
