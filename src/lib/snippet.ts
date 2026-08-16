/** How much of a description a search result shows before it is cut. */
const SNIPPET_LIMIT = 60

/**
 * A one-line preview of a longer piece of prose.
 *
 * The search palette used to take `description.slice(0, 60)` at nine separate
 * call sites, which cuts wherever the sixtieth character happens to fall — on
 * the shipped *Dracula*, *"…desired by three suitors and preyed u"* and *"…later
 * searches for sleepwalking Luc"*. A word chopped in half reads as a rendering
 * fault rather than as a summary, and there was nothing to say the text
 * continued (**WRUN-11**).
 *
 * So: cut at the last space inside the limit and mark the cut with an ellipsis.
 * A single word longer than the limit has no space to fall back on and is cut
 * where it must be — better a hard cut than a blank line.
 *
 * The ellipsis is inside the budget rather than added to it, so the result
 * never exceeds `limit` and the layout it was sized for still holds.
 */
export function snippet(text: string | null | undefined, limit = SNIPPET_LIMIT): string | undefined {
  if (!text) return undefined
  const trimmed = text.trim()
  if (!trimmed) return undefined
  if (trimmed.length <= limit) return trimmed

  const cut = trimmed.slice(0, limit - 1)
  const lastSpace = cut.lastIndexOf(' ')
  // `> 0` rather than `>= 0`: a space at index 0 would leave an empty snippet.
  const body = lastSpace > 0 ? cut.slice(0, lastSpace) : cut
  return `${body.replace(/[,;:.\s]+$/, '')}…`
}
