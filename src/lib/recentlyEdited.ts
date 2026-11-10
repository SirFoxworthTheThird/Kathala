/**
 * The scenes most recently edited, newest first, each with when: the later of
 * its record's last change and its prose's (round-trip-plan.md, T6).
 *
 * The dashboard's *Recently edited* sorted by the scene's record alone, and
 * writing on the Page saves only the prose: a writer run typed 380 words into
 * a scene and it never appeared in the five (writer run 2026-11-09, W-C). The
 * list was renamed for DASH-3 to say what it orders by, and then did not order
 * by the thing most edited.
 */
export function recentlyEdited<E extends { id: string; updatedAt: number }>(
  events: readonly E[],
  texts: ReadonlyArray<{ eventId: string; updatedAt: number }>,
  count = 5,
): Array<E & { editedAt: number }> {
  const proseAt = new Map<string, number>()
  for (const t of texts) proseAt.set(t.eventId, Math.max(proseAt.get(t.eventId) ?? 0, t.updatedAt))
  return events
    .map((e) => ({ ...e, editedAt: Math.max(e.updatedAt, proseAt.get(e.id) ?? 0) }))
    .sort((a, b) => b.editedAt - a.editedAt)
    .slice(0, count)
}
