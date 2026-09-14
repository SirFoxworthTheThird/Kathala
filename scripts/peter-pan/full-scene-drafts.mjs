import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('scripts/peter-pan/source/pg16.txt', 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK PETER PAN \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK PETER PAN \*\*\*/)?.[0]
assert(startMarker && endMarker, 'Peter Pan source must contain Gutenberg boundaries')
const content = source.slice(source.indexOf(startMarker) + startMarker.length, source.indexOf(endMarker))
const headings = [...content.matchAll(/^Chapter [IVXLCDM]+\.\n[^\n]+$/gm)]
assert.equal(headings.length, 17, 'The source must contain Chapters I-XVII')

const cleanParagraphs = text => text.trim().split(/\n\s*\n/)
  .map(paragraph => paragraph.split('\n').map(line => line.trim()).join(' ').replace(/\s+/g, ' ').trim())
  .filter(paragraph => paragraph && paragraph !== 'THE END')
const chapters = headings.map((heading, index) => cleanParagraphs(content
  .slice(heading.index + heading[0].length, headings[index + 1]?.index ?? content.length)))

// Boundaries were checked against the action described by each modeled event.
// They deliberately follow Barrie's chapter-ending reveals rather than moving
// their consequences into the preceding scene.
const boundaries = [
  [45], [6], [33, 80, 153, 183], [35], [79], [50], [5], [23, 115, 140],
  [], [90], [53, 65], [], [10, 41, 62], [69], [68, 71], [35, 48, 49],
  [55, 65, 112, 147, 167],
]

export const sceneDrafts = chapters.flatMap((paragraphs, index) => {
  const points = [0, ...boundaries[index], paragraphs.length]
  return points.slice(0, -1).map((start, part) => paragraphs.slice(start, points[part + 1]).join('\n\n'))
})

assert.equal(sceneDrafts.length, 47, 'Every source-supported modeled event must receive prose')
assert(sceneDrafts.every(Boolean), 'No modeled event may receive an empty manuscript scene')
assert.equal(sceneDrafts.join('\n\n'), chapters.flat().join('\n\n'), 'Every narrative paragraph must appear once in source order')
