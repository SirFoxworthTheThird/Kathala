import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('scripts/invisible-man/source/pg5230.txt', 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE INVISIBLE MAN(?:: A GROTESQUE ROMANCE)? \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE INVISIBLE MAN(?:: A GROTESQUE ROMANCE)? \*\*\*/)?.[0]
assert(startMarker && endMarker, 'The Invisible Man source must contain Gutenberg boundaries')
const content = source.slice(source.indexOf(startMarker) + startMarker.length, source.indexOf(endMarker))
const headings = [...content.matchAll(/^(?:CHAPTER [IVXLCDM]+\.\n[^\n]+|THE EPILOGUE)$/gm)]
assert.equal(headings.length, 29, 'The source must contain Chapters I-XXVIII and the Epilogue')

const cleanParagraphs = text => text.trim().split(/\n\s*\n/)
  .map(paragraph => paragraph.split('\n').map(line => line.trim()).join(' ').replace(/\s+/g, ' ').trim())
  .filter(paragraph => paragraph && paragraph !== 'THE END')
const chapters = headings.map((heading, index) => cleanParagraphs(content
  .slice(heading.index + heading[0].length, headings[index + 1]?.index ?? content.length)))

// Boundaries align with the source action represented by each event. The
// Great Portland Street scenes follow Wells's order: father, cat, self-test.
const boundaries = [
  [9], [], [18], [], [], [10], [33], [], [], [6], [26], [], [], [62], [],
  [26], [8], [11], [], [10, 30], [16], [9], [], [35], [], [], [61, 80],
  [22], [],
]
export const sceneDrafts = chapters.flatMap((paragraphs, index) => {
  const points = [0, ...boundaries[index], paragraphs.length]
  return points.slice(0, -1).map((start, part) => paragraphs.slice(start, points[part + 1]).join('\n\n'))
})

assert.equal(sceneDrafts.length, 47, 'Every modeled event must receive one source section')
assert(sceneDrafts.every(Boolean), 'No manuscript scene may be empty')
assert.equal(sceneDrafts.join('\n\n'), chapters.flat().join('\n\n'), 'Every narrative paragraph must appear once in source order')
