/**
 * What an exported manuscript is called.
 *
 * N11, from a blind writer run: exporting from a world named *The Ninth Bell*
 * produced `the-drowning-year.md` — the name of the **timeline**. The file was
 * clean; only its name was wrong. A writer who exports three drafts gets three
 * files named after an internal object they may have named once and never seen
 * since, and none of them named after the book.
 *
 * The book is the world. The timeline joins the name only when there is more
 * than one of them, because then it is the thing that tells two exports apart —
 * and when there is only one, naming it adds a word the writer never chose to
 * be a title.
 */

/** A file-name-safe form of a title, never empty. */
export function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'manuscript'
}

export function manuscriptFileName({
  worldName, timelineName, timelineCount, ext,
}: {
  worldName: string | undefined
  timelineName: string | undefined
  /** How many timelines the world has — 1 means the timeline names nothing. */
  timelineCount: number
  ext: string
}): string {
  const book = slugify(worldName?.trim() || 'manuscript')
  const strand = timelineCount > 1 ? slugify(timelineName?.trim() ?? '') : ''
  // A blank strand would leave a trailing separator, and `slugify` returns
  // "manuscript" for an unnamed timeline rather than nothing — so test the
  // name, not the slug.
  const named = timelineCount > 1 && !!timelineName?.trim()
  return named ? `${book}-${strand}.${ext}` : `${book}.${ext}`
}
