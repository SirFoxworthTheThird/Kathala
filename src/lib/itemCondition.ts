/**
 * The states an item can be in, and the colour each one wears.
 *
 * Lived in `MapSidebar` alone, which is why the Items roster had no condition
 * dot to show (**IT-2**) — the screen devoted to items knew less about them
 * than the map's sidebar did.
 */
export const ITEM_CONDITIONS = ['intact', 'damaged', 'destroyed', 'repaired', 'lost', 'found', 'unknown'] as const

export type ItemCondition = (typeof ITEM_CONDITIONS)[number]

export const CONDITION_COLORS: Record<string, string> = {
  intact: '#34d399', damaged: '#fbbf24', destroyed: '#f87171',
  repaired: '#4ade80',
  lost: '#94a3b8', found: '#60a5fa', unknown: '#a78bfa',
  // Kept so the dot still has a colour on records written by the map's
  // location panel, which shipped its own rival vocabulary — see
  // TERMINAL_CONDITIONS below.
  broken: '#f87171', used: '#fb923c', depleted: '#94a3b8',
}

/**
 * Conditions that mean the item is gone.
 *
 * `broken` is here because `LocationDetailPanel` shipped a **second, private
 * list** — `['intact','damaged','broken','lost','used','depleted']` — writing
 * the same `ItemSnapshot.condition` field from a different vocabulary. An item
 * marked *broken* from the map was invisible to every check, which all asked
 * for `destroyed`. The panel uses the canonical list now; this keeps the
 * records it already wrote inside the checks rather than silently exempt.
 */
export const TERMINAL_CONDITIONS: readonly string[] = ['destroyed', 'broken']

/**
 * The condition that says an item came back, rather than merely being in one
 * piece again.
 *
 * The list has always worked this way: `found` is not a condition either, it is
 * what happened to something `lost`. `repaired` is that pair for `destroyed` —
 * so a writer can *state* the mend instead of dismissing a warning about it,
 * and the story bible carries the fact rather than a suppressed row.
 *
 * It does not decay: in the delta model an item stays `repaired` until another
 * snapshot says otherwise, exactly as `found` already does. A repaired sword is
 * not a never-broken one.
 */
export const RESTORED_CONDITION = 'repaired'
