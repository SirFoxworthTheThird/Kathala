/*
  What choosing a name from the `@` picker puts in the text, on the Page and on
  a scene card alike.
*/

/**
 * A scene's first line opened as a header line and not closed yet:
 * `[#The Kitchen @@Wren Hallo`. `before` is the line up to the caret.
 *
 * Without this the picker only knew the header line once its `]` existed, so
 * typing it left to right — the way a line is typed — gave `@@` the prose's
 * rules, which may not make anybody: "Nobody called ‘Wren Hallo’ yet — type a
 * single @". A writer run found the workaround (type `[#Place ]`, then arrow
 * back inside), which nobody should have to.
 */
export function inOpenHeader(before: string): boolean {
  return /^\s*\[[^\]]*$/.test(before)
}

/**
 * What goes in place of the token, and where the caret goes within it.
 *
 * - In the header line, `@@Name`, the sigil being the line's syntax. A line
 *   still open is closed after it, with the caret before the `]`, so another
 *   name can follow and a line left there reads as a header, not as prose.
 * - In the prose, `Name ` with a space to go on typing — which is the wrong
 *   thing before a comma, so `autoSpace` says where it is, for `punctuate`.
 */
export function mentionInsert(
  name: string,
  where: { inHeader: boolean; after: string },
): { insert: string; caret: number; autoSpace: number | null } {
  if (where.inHeader) {
    const insert = where.after.includes(']') ? `@@${name} ` : `@@${name}]`
    return { insert, caret: where.after.includes(']') ? insert.length : insert.length - 1, autoSpace: null }
  }
  const insert = `${name} `
  return { insert, caret: insert.length, autoSpace: insert.length - 1 }
}

/** Marks that sit against the word before them. */
const CLOSING = /^[,.;:!?)\]}'’"”…—]$/

/**
 * Punctuation typed straight after a picked name takes the place of the space
 * the picker put after it: "Oren Halloway," rather than "Oren Halloway ,".
 * `space` is where that space is; `null` when this keystroke is not that case.
 */
export function punctuate(text: string, space: number | null, caret: number, typed: string): { text: string; caret: number } | null {
  if (space === null || caret !== space + 1 || text[space] !== ' ' || !CLOSING.test(typed)) return null
  return { text: text.slice(0, space) + typed + text.slice(space + 1), caret: space + 1 }
}
