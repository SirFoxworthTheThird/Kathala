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

/**
 * A preview centred on where the query actually matched.
 *
 * `snippet` previews from the start, which is right for a description — the
 * first sixty characters are the summary. It is wrong for a scene's prose: a
 * writer searching for a half-remembered line wants to see *that line*, and the
 * opening of the scene tells them nothing about whether this is the hit they
 * meant. On a 300-word scene the match is almost never in the first sixty
 * characters.
 *
 * So the window is placed around the match, cut at word boundaries, with a
 * leading ellipsis when it does not start at the beginning. Falls back to
 * `snippet` when the query is absent, so a caller never has to check first.
 */
export function snippetAround(
  text: string | null | undefined,
  query: string,
  limit = SNIPPET_LIMIT,
): string | undefined {
  if (!text) return undefined
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!flat) return undefined
  const at = query ? flat.toLowerCase().indexOf(query.toLowerCase()) : -1
  if (at === -1) return snippet(flat, limit)
  if (flat.length <= limit) return flat

  // Centre the window on the match, then pull it back inside the text.
  const half = Math.max(0, Math.floor((limit - query.length) / 2))
  let start = Math.max(0, at - half)
  if (start + limit > flat.length) start = Math.max(0, flat.length - limit)

  // Start at a word boundary, but never so late that the match is cut off.
  if (start > 0) {
    const space = flat.indexOf(' ', start)
    if (space !== -1 && space < at) start = space + 1
  }

  const head = start > 0 ? '…' : ''
  const body = flat.slice(start, start + limit - head.length)
  const tail = start + body.length < flat.length
  return `${head}${tail ? snippet(body, body.length) : body}`
}
