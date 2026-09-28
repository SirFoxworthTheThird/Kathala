/*
  The book as one document of plain text, in the syntax the roadmap recommends:
  `# Chapter`, `## Scene`, then the scene's prose, with a blank line between
  every part. `parse` is the inverse, so a round trip can be checked exactly.
*/
export function compose(book) {
  const parts = []
  for (const ch of book.chapters) {
    parts.push(`# ${ch.title}`)
    for (const sc of ch.scenes) {
      parts.push(`## ${sc.title}`)
      if (sc.text) parts.push(sc.text)
    }
  }
  return parts.join('\n\n')
}

export const HEADING = /^(#{1,2}) (.*)$/

/**
 * The exact inverse of `compose` for scene prose: the text between each `## `
 * line and the next heading, in order. `compose` puts one blank line after a
 * heading and one before the next, so those two separators are all that is cut.
 */
export function sceneBodies(doc) {
  const heads = [...doc.matchAll(/^(#{1,2}) .*$/gm)]
  const bodies = []
  heads.forEach((m, i) => {
    if (m[1] !== '##') return
    const from = m.index + m[0].length
    const next = heads[i + 1]
    const seg = doc.slice(from, next ? next.index : doc.length)
    bodies.push(next ? (seg === '\n\n' ? '' : seg.slice(2, -2)) : seg.slice(2))
  })
  return bodies
}
