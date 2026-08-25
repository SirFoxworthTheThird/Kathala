/**
 * Matching for a long <Select>'s filter box.
 *
 * The Structure board's "Assign a scene…" picker offered every scene in the
 * book — 149 of them on the shipped Monte Cristo, a list about ten thousand
 * pixels tall shown through a window four options high, with nothing to type
 * into. Marking the Climax of a 117-chapter novel meant scrolling roughly forty
 * screenfuls. The Search palette finds a scene by name in under a fifth of a
 * second; this control could not find one at all.
 *
 * Deliberately term-wise rather than a single substring: options here read
 * `Ch. 9 — The count returns`, so a writer typing "9 returns" or "returns 9" is
 * naming one scene and means it. Requiring every term keeps that precise while
 * letting the terms arrive in any order.
 */

/** Lowercased with runs of whitespace collapsed — how both sides are compared. */
function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Whether an option's label answers the typed query.
 *
 * An empty or blank query matches everything, so an untouched filter box leaves
 * the list exactly as it was.
 */
export function matchesQuery(label: string, query: string): boolean {
  const terms = normalise(query).split(' ').filter(Boolean)
  if (terms.length === 0) return true
  const haystack = normalise(label)
  return terms.every((term) => haystack.includes(term))
}
