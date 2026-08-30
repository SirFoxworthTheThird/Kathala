/**
 * How a scene's prose becomes paragraphs.
 *
 * A **blank line** starts a new paragraph; a single newline does not. That rule
 * is deliberate — prose pasted from a text file or a PDF arrives hard-wrapped
 * at some column, and treating every newline as a break would turn a pasted
 * chapter into one paragraph per line.
 *
 * W23-8: the rule lived as `text.split(/\n\s*\n/)` written out three times —
 * `ManuscriptView`, `manuscriptCompile`, `manuscriptExport` — so the screen, the
 * compiler and the exporter each re-stated it and could each have drifted. It
 * is one function now, and the scene editor counts with it too, so the number a
 * writer is shown while typing is produced by the same split that will make
 * their pages.
 */
export function splitParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
}
