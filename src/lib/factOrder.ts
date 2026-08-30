/**
 * How the Knowledge roster is ordered (**KN-4**).
 *
 * Twenty-one facts sat in a fixed order — the order they were added — with no
 * way to ask the two questions the screen is for: when does this get out, and
 * how far has it spread. Both are already computed for the cards; they just had
 * no say in the sequence.
 *
 * Every order is **stable**: ties keep the order the facts were added in, so a
 * roster where nothing is known yet does not shuffle itself when you sort by
 * how widely known it is.
 */

export type FactOrder = 'added' | 'story' | 'known' | 'name'

export const FACT_ORDERS: FactOrder[] = ['added', 'story', 'known', 'name']

export const FACT_ORDER_LABELS: Record<FactOrder, string> = {
  added: 'Order added',
  story: 'When it gets out',
  known: 'How widely known',
  name: 'Name',
}

export interface FactOrderInput {
  /**
   * Narrative position of the fact's earliest reveal, or null when nobody
   * learns it yet. A fact nobody knows has no place in the story's order, so it
   * sorts to the end rather than to the beginning — "not yet" is not "first".
   */
  firstRevealPos: (factId: string) => number | null
  /** How many characters know it at the cursor. */
  knownCount: (factId: string) => number
}

export function orderFacts<T extends { id: string; title: string }>(
  facts: T[],
  order: FactOrder,
  { firstRevealPos, knownCount }: FactOrderInput,
): T[] {
  if (order === 'added') return facts
  const added = new Map(facts.map((f, i) => [f.id, i]))
  const tie = (a: T, b: T) => (added.get(a.id) ?? 0) - (added.get(b.id) ?? 0)

  return [...facts].sort((a, b) => {
    if (order === 'name') {
      const byName = a.title.localeCompare(b.title)
      return byName !== 0 ? byName : tie(a, b)
    }
    if (order === 'known') {
      // Most widely known first: the question is "what is out", not "what is safe".
      const byCount = knownCount(b.id) - knownCount(a.id)
      return byCount !== 0 ? byCount : tie(a, b)
    }
    const pa = firstRevealPos(a.id)
    const pb = firstRevealPos(b.id)
    if (pa === null && pb === null) return tie(a, b)
    if (pa === null) return 1
    if (pb === null) return -1
    return pa !== pb ? pa - pb : tie(a, b)
  })
}
