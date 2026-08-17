/**
 * Whether a chapter is behind the reader's position.
 *
 * Compared by **number** rather than by events, so a chapter the reader has not
 * opened yet keeps its contents back even when it has no events recorded — the
 * same rule `ChapterRow` has applied to its synopsis all along, extracted here
 * because a second screen now needs it and two copies of a spoiler rule is one
 * too many.
 *
 * A gate with no cursor is a reader who asked for the whole book; nothing is
 * held back from them. An inactive gate is somebody writing.
 */
export function chapterWithheld(
  gate: { active: boolean; chapterNumber: number | null },
  chapterNumber: number,
): boolean {
  if (!gate.active || gate.chapterNumber === null) return false
  return chapterNumber > gate.chapterNumber
}
