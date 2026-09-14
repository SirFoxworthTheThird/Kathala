import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('scripts/three-musketeers/source/pg1257.txt', 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE THREE MUSKETEERS \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE THREE MUSKETEERS \*\*\*/)?.[0]
assert(startMarker && endMarker, 'The Three Musketeers source must contain Gutenberg boundaries')
const body = source.slice(source.indexOf(startMarker) + startMarker.length, source.indexOf(endMarker))
const headings = [...body.matchAll(/^Chapter [IVXLCDM]+\.$/gm)]
assert.equal(headings.length, 67, 'The source must contain Chapters I-LXVII')

const sections = headings.map((heading, index) => {
  const raw = body.slice(heading.index + heading[0].length, headings[index + 1]?.index ?? body.length).trim()
  const paragraphs = raw.split(/\n\s*\n/).map(paragraph => paragraph
    .split('\n').map(line => line.trim()).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean)
  assert(paragraphs.length > 1, `Chapter ${index + 1} has no narrative prose`)
  return paragraphs.slice(1) // The uppercase chapter title follows the numbered heading.
})

const finalChapter = sections.at(-1)
const finalSceneBoundary = 91
assert(finalChapter[finalSceneBoundary].startsWith('D’Artagnan took the paper hesitatingly'), 'Conclusion scene boundary no longer matches the source')

export const sceneDrafts = [
  ...sections.slice(0, -1).map(paragraphs => paragraphs.join('\n\n')),
  finalChapter.slice(0, finalSceneBoundary).join('\n\n'),
  finalChapter.slice(finalSceneBoundary).join('\n\n'),
]

assert.equal(sceneDrafts.length, 68, 'Every modeled event must receive source prose')
assert.equal(sceneDrafts.join('\n\n'), sections.flat().join('\n\n'), 'Scene prose must reproduce all narrative paragraphs in source order')

