/**
 * The states a place can be in.
 *
 * Lived as an inline array inside `LocationDetailPanel`'s JSX, which is how a
 * vocabulary quietly goes stale — the same file also carried a second, private
 * list of *item* conditions that disagreed with the canonical one. A list that
 * checks read and a screen writes belongs somewhere both can see.
 */
export const LOCATION_STATUSES = [
  'active', 'occupied', 'sieged', 'abandoned', 'ruined', 'destroyed', 'rebuilt', 'unknown',
] as const

export type LocationStatus = (typeof LOCATION_STATUSES)[number]

/** Statuses that mean the place is gone. */
export const GONE_STATUSES: readonly string[] = ['destroyed', 'ruined']

/**
 * The status that says a place came back, rather than merely being in use
 * again.
 *
 * The same idea as `repaired` for items and `revived` for people: the writer
 * states what happened, and the continuity check has nothing to report — rather
 * than reporting it and being told to be quiet. A suppression is keyed on a
 * derived issue id, so moving the scene orphans it and the warning returns; a
 * status is on the record and survives any edit, travels in the `.pwk`, and can
 * be read by every other screen.
 */
export const REBUILT_STATUS = 'rebuilt'
