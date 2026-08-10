/**
 * The states an item can be in, and the colour each one wears.
 *
 * Lived in `MapSidebar` alone, which is why the Items roster had no condition
 * dot to show (**IT-2**) — the screen devoted to items knew less about them
 * than the map's sidebar did.
 */
export const ITEM_CONDITIONS = ['intact', 'damaged', 'destroyed', 'lost', 'found', 'unknown'] as const

export type ItemCondition = (typeof ITEM_CONDITIONS)[number]

export const CONDITION_COLORS: Record<string, string> = {
  intact: '#34d399', damaged: '#fbbf24', destroyed: '#f87171',
  lost: '#94a3b8', found: '#60a5fa', unknown: '#a78bfa',
}
