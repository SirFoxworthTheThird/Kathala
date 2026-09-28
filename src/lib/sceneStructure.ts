/**
 * Splitting one scene in two, and joining two into one — the rules, apart from
 * the writes. The writes are `splitScene` and `joinWithNext` in
 * `src/db/hooks/useSceneStructure.ts`.
 */
import type { EventStatus, WorldEvent } from '@/types'
import { EVENT_STATUSES } from '@/lib/eventStatus'

/**
 * The prose either side of the caret. The first half loses its trailing
 * whitespace and the second its leading, so neither scene starts or ends on the
 * blank line that separated them.
 */
export function splitProse(text: string, at: number): { head: string; tail: string } {
  const cut = Math.max(0, Math.min(text.length, at))
  return { head: text.slice(0, cut).replace(/\s+$/, ''), tail: text.slice(cut).replace(/^\s+/, '') }
}

/** Two scenes' prose as one: a paragraph break between them, and nothing for an empty half. */
export function joinProse(first: string | null, second: string | null): string {
  return [first, second].map((t) => (t ?? '').trim()).filter(Boolean).join('\n\n')
}

/** What the second half of a split starts with: the room it is in, and who is in it. */
export function splitCarries(scene: WorldEvent): Partial<WorldEvent> {
  return {
    locationMarkerId: scene.locationMarkerId,
    involvedCharacterIds: [...scene.involvedCharacterIds],
    involvedItemIds: [...scene.involvedItemIds],
    povCharacterId: scene.povCharacterId ?? null,
    status: scene.status,
    isFlashback: scene.isFlashback ?? false,
    threadIds: [...(scene.threadIds ?? [])],
    motifIds: [...(scene.motifIds ?? [])],
    tags: [...scene.tags],
  }
}

const union = (a: readonly string[] | undefined, b: readonly string[] | undefined) =>
  [...new Set([...(a ?? []), ...(b ?? [])])]

/**
 * The fields of the scene that remains when `second` is joined onto `first`.
 *
 * - **Who and what is in it** is everyone in either; somebody present in one
 *   half is present, not merely mentioned.
 * - **Where, whose eyes, which beat, what day** are the first's, falling back to
 *   the second's where the first has none — the scene starts where it starts.
 * - **Status** is the less advanced of the two: a scene is only as finished as
 *   the least finished part of it.
 * - **Tension** is the higher: a scene is as tense as its tenser half.
 * - **Days covered** add up, since both halves took their time.
 */
export function mergeSceneFields(first: WorldEvent, second: WorldEvent): Partial<WorldEvent> {
  const involved = union(first.involvedCharacterIds, second.involvedCharacterIds)
  const rank = (s: EventStatus | undefined) => EVENT_STATUSES.indexOf(s ?? 'draft')
  const status = rank(second.status) < rank(first.status) ? second.status : first.status
  const tensions = [first.tension, second.tension].filter((t): t is number => t !== null && t !== undefined)
  const days = [first.travelDays, second.travelDays].filter((d): d is number => d !== null && d !== undefined)
  return {
    involvedCharacterIds: involved,
    mentionedCharacterIds: union(first.mentionedCharacterIds, second.mentionedCharacterIds)
      .filter((id) => !involved.includes(id)),
    involvedItemIds: union(first.involvedItemIds, second.involvedItemIds),
    threadIds: union(first.threadIds, second.threadIds),
    motifIds: union(first.motifIds, second.motifIds),
    tags: union(first.tags, second.tags),
    locationMarkerId: first.locationMarkerId ?? second.locationMarkerId,
    povCharacterId: first.povCharacterId ?? second.povCharacterId ?? null,
    structureBeat: first.structureBeat ?? second.structureBeat ?? null,
    inWorldTime: first.inWorldTime ?? second.inWorldTime ?? null,
    status,
    tension: tensions.length > 0 ? Math.max(...tensions) : null,
    travelDays: days.length > 0 ? days.reduce((a, b) => a + b, 0) : null,
    description: [first.description, second.description].map((d) => d.trim()).filter(Boolean).join(' '),
  }
}
