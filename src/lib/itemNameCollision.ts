/**
 * Does this typed item name already name an item?
 *
 * The Current State panel's inventory has two controls one above the other:
 * *Add existing item…*, which picks from the catalogue, and *New item name…*,
 * which creates. Typing a name you already have into the second one called
 * `createItem` unconditionally and produced a second record with the identical
 * name, with no warning while typing and none on save. A blind writer run did
 * it three times without noticing and finished the morning with four items
 * called *Cathe's letter*, one of which had the description.
 *
 * That is worse than an untidy list. The hand-off logic that takes an item off
 * its previous holder, and the continuity rule that flags one object in two
 * places, both key on item **id** — so two records with one name are two
 * objects, and a writer who types names instead of picking them gets silence
 * from exactly the machinery they installed the app for.
 *
 * Names are compared case-insensitively with whitespace collapsed, because
 * "the tally-slate" and "The  tally-slate" are the writer meaning one thing.
 */

export type ItemNameCollision =
  | { kind: 'none' }
  /** The world has an item by this name, and this character is not holding it. */
  | { kind: 'existing'; id: string; name: string }
  /** The world has an item by this name and it is already in this inventory. */
  | { kind: 'held'; id: string; name: string }

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function itemNameCollision(
  typed: string,
  items: Array<{ id: string; name: string }>,
  inventoryIds: string[],
): ItemNameCollision {
  const wanted = normalise(typed)
  if (!wanted) return { kind: 'none' }
  const match = items.find((i) => normalise(i.name) === wanted)
  if (!match) return { kind: 'none' }
  return {
    kind: inventoryIds.includes(match.id) ? 'held' : 'existing',
    id: match.id,
    name: match.name,
  }
}
