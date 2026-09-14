import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('scripts/around-the-world/source/pg103.txt', 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK AROUND THE WORLD IN EIGHTY DAYS \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK AROUND THE WORLD IN EIGHTY DAYS \*\*\*/)?.[0]
assert(startMarker && endMarker, 'Around the World in Eighty Days source must contain Gutenberg boundaries')
const body = source.slice(source.indexOf('CHAPTER I.\n'), source.indexOf(endMarker))
const headings = [...body.matchAll(/^CHAPTER [IVXLCDM]+\.\n/gm)]
assert.equal(headings.length, 37, 'The source must contain Chapters I-XXXVII')

const chapters = headings.map((heading, index) => body
  .slice(heading.index + heading[0].length, headings[index + 1]?.index ?? body.length)
  .replace(/^.*?\n\n/s, '')
  .trim().split(/\n\s*\n/)
  .map(paragraph => paragraph.split('\n').map(line => line.trim()).join(' ').replace(/\s+/g, ' ').trim())
  .filter(Boolean))

// Boundaries were checked against each modeled event, including corrected
// source order in Chapters II, XVI, XVIII, XXXIII-XXXIV, and XXXVI-XXXVII.
const boundaries = [
  [23], [7], [32], [27], [8], [25], [22], [18], [29], [19],
  [41], [14], [41], [20], [64], [13], [12], [22], [68], [55],
  [49], [18], [44], [15], [31], [13], [21], [34], [61], [34],
  [30], [5], [24, 62], [], [23], [], [17, 26],
]

export const sceneDrafts = chapters.flatMap((paragraphs, index) => {
  const points = [0, ...boundaries[index], paragraphs.length]
  return points.slice(0, -1).map((start, part) => paragraphs.slice(start, points[part + 1]).join('\n\n'))
})

assert.equal(sceneDrafts.length, 74, 'Every modeled event must receive source prose')
assert(sceneDrafts.every(Boolean), 'No modeled event may receive an empty manuscript scene')
assert.equal(sceneDrafts.join('\n\n'), chapters.flat().join('\n\n'), 'Scene prose must reproduce all narrative paragraphs in source order')
