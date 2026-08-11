/**
 * A count and its noun, agreeing.
 *
 * MS-5 found *"1 scenes"* in the export dialog. It was not one slip: the same
 * shape — a raw number, a space, a hard-coded plural — was written out at two
 * dozen call sites, and each one is wrong exactly when the count is one, which
 * is the most common count on a new world.
 *
 * The number is grouped, because a count that stands alone is read rather than
 * scanned: `6223` reads as an identifier and `6,223` reads as a quantity.
 *
 * Irregular plurals pass their own: `plural(n, 'entry', 'entries')`.
 */
const nf = new Intl.NumberFormat()

export function plural(n: number, one: string, many?: string): string {
  return `${nf.format(n)} ${pluralWord(n, one, many)}`
}

/** The noun alone, for phrases that format the number themselves ("3/8 scenes"). */
export function pluralWord(n: number, one: string, many?: string): string {
  return n === 1 ? one : many ?? `${one}s`
}
