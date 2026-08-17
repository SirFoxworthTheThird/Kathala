/**
 * Ordering and searching for the Library catalogue.
 *
 * Kept out of the dialog so the rules can be tested without a browser, and
 * because both of them are decisions rather than plumbing.
 */

/** The fields the catalogue is browsed by. */
interface BrowsableEntry {
  title: string
  author: string
}

/** Leading words that a catalogue sorts past rather than under. */
const ARTICLES = ['the ', 'a ', 'an ']

/**
 * The title as it should file, with any leading article moved out of the way.
 *
 * Plain A–Z would be close to useless here: of the 25 worlds shipped today,
 * **16 begin with an article** — fifteen "The" and one "A" — so an unadjusted
 * sort files most of the catalogue under T and leaves a reader scanning for
 * *The Woman in White* between *The War of the Worlds* and *Treasure Island*.
 * Filing under the first word that distinguishes the book is what a shelf does,
 * and it is the reason a reader can find anything on one.
 *
 * Deliberately English-only, matching the catalogue. A title in another
 * language keeps its article and files under it, which is right — *Les
 * Misérables* belongs under L to anyone who would look for it.
 */
export function sortableTitle(title: string): string {
  const trimmed = title.trim()
  const lower = trimmed.toLowerCase()
  const article = ARTICLES.find((a) => lower.startsWith(a))
  return article ? trimmed.slice(article.length).trim() : trimmed
}

/** Alphabetical by filing title, then by author for two books of one name. */
function byTitle(a: BrowsableEntry, b: BrowsableEntry): number {
  const byName = sortableTitle(a.title).localeCompare(sortableTitle(b.title), 'en', { sensitivity: 'base' })
  return byName !== 0 ? byName : a.author.localeCompare(b.author, 'en', { sensitivity: 'base' })
}

/**
 * Whether an entry answers a search.
 *
 * **Title and author, not the blurb.** A reader searching the catalogue is
 * looking for a book they have in mind — by its name or by who wrote it — and
 * matching the blurb would return *Dracula* for "London" alongside four others,
 * which reads as a broken search rather than a thorough one.
 *
 * Case- and accent-insensitive, so "bronte" finds Brontë.
 */
function matches(entry: BrowsableEntry, needle: string): boolean {
  const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const q = fold(needle)
  return fold(entry.title).includes(q) || fold(entry.author).includes(q)
}

/**
 * The catalogue as it should be shown: matching entries, alphabetically.
 *
 * An empty or whitespace query is not a filter — it is the whole catalogue.
 * Does not mutate its input.
 */
export function browseLibrary<T extends BrowsableEntry>(entries: readonly T[], query: string): T[] {
  // No special case for a blank query: an empty needle is a substring of every
  // string, so the filter keeps everything. The branch that used to say so
  // explicitly could not be killed by any test, because both halves returned
  // the same list.
  const needle = query.trim()
  return entries.filter((e) => matches(e, needle)).sort(byTitle)
}
