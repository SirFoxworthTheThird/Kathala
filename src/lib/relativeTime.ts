/**
 * How long ago, in the app's own voice.
 *
 * There were three of these — in `RecentChangesPanel`, `SceneHistoryDialog` and
 * `LoreView` — and they disagreed. Two floored and one rounded, so the same
 * 45-minute-old edit read as "45m ago" in one place and the same 31-minute-old
 * one read as "1h ago" in another. Worse, the lore card dropped straight from
 * hours to a locale date, so a page edited yesterday showed "12/08/2026" beside
 * a scene edited yesterday showing "1d ago".
 *
 * Floored rather than rounded: "how long since" is a count of whole units
 * elapsed, and rounding up claims more time has passed than has.
 *
 * `now` is a parameter so callers can tick it, and so this is testable without
 * touching the clock.
 */
export function relativeTime(at: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - at)
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  // Past a week "6d ago" stops being easier to place than the date itself.
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(at).toLocaleDateString()
}
