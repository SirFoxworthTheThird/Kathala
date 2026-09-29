/**
 * The rules behind a scene's small fields, shared by everything that edits
 * them — the scene's card, and the panel beside the Page.
 *
 * They lived inline in the card's handlers. With a second place editing the
 * same fields, two copies of "what does clicking the rated level do" would be
 * two answers waiting to drift apart.
 */

/** Clicking a tension level: the level, or unrated when it is the one already set. */
export function nextTension(current: number | null, clicked: number | null): number | null {
  return clicked !== null && clicked === current ? null : clicked
}

/** A tag as typed, as stored: lower case, spaces as hyphens, or '' for nothing. */
export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-')
}

/** Days since the previous scene, from the field: blank or unreadable is none, and never negative. */
export function parseTravelDays(raw: string): number | null {
  const parsed = raw.trim() === '' ? null : Math.max(0, parseFloat(raw))
  return parsed === null || Number.isNaN(parsed) ? null : parsed
}

/** An exact in-world day, from the field: blank or unreadable is none. Any sign — a day before the story's zero is a day. */
export function parseInWorldDay(raw: string): number | null {
  const parsed = raw.trim() === '' ? null : parseFloat(raw)
  return parsed === null || Number.isNaN(parsed) ? null : parsed
}
