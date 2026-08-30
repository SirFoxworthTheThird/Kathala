/**
 * Which World settings sections are folded away.
 *
 * HB-9's last standing part: eleven sections in one scroll, none of them
 * collapsible. The jump index (**SET-2**) helps you *reach* one; it does
 * nothing once you are there, and the page is still every section's explanatory
 * paragraph at once.
 *
 * **The set stored is the collapsed one, not the open one.** A section this
 * store has never heard of is therefore open, which is the behaviour that
 * survives new sections being added: recording the open set instead would make
 * every future section arrive folded shut for everybody who had ever touched
 * this control.
 *
 * Sections stay **expanded by default**. Folding everything on arrival would
 * make the page a menu, which is tempting — but it also hides controls whose
 * absence several reading-mode tests check for, so an assertion that a section
 * is gone would start passing because it was merely shut. *Collapse all* is one
 * press away for anyone who wants the menu.
 */
export const SETTINGS_COLLAPSED_KEY = 'plotweave-settings-collapsed'

/** Reads whatever is in storage, tolerating anything that is not our shape. */
export function parseCollapsed(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    return []
  }
}

export function serialiseCollapsed(ids: readonly string[]): string {
  return JSON.stringify([...ids])
}

export function isSectionOpen(collapsed: readonly string[], id: string): boolean {
  return !collapsed.includes(id)
}

export function toggleSection(collapsed: readonly string[], id: string): string[] {
  return collapsed.includes(id) ? collapsed.filter((c) => c !== id) : [...collapsed, id]
}

/** Fold every section currently on the page, keeping any others already shut. */
export function collapseAll(collapsed: readonly string[], ids: readonly string[]): string[] {
  return [...new Set([...collapsed, ...ids])]
}

/** Open every section on the page, leaving ones not on it alone. */
export function expandAll(collapsed: readonly string[], ids: readonly string[]): string[] {
  return collapsed.filter((c) => !ids.includes(c))
}

/** Whether *every* section on the page is folded — what the button should offer. */
export function allCollapsed(collapsed: readonly string[], ids: readonly string[]): boolean {
  return ids.length > 0 && ids.every((id) => collapsed.includes(id))
}
