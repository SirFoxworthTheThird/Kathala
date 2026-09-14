import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('scripts/alice-in-wonderland/source/pg11.txt', 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK ALICE'S ADVENTURES IN WONDERLAND \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK ALICE'S ADVENTURES IN WONDERLAND \*\*\*/)?.[0]
assert(startMarker && endMarker, 'Alice source must contain Gutenberg boundaries')
const body = source.slice(source.indexOf('CHAPTER I.\n'), source.indexOf(endMarker))
const headings = [...body.matchAll(/^CHAPTER [IVX]+\.\n/gm)]
assert.equal(headings.length, 12, 'The source must contain Chapters I-XII')

const chapters = headings.map((heading, index) => body
  .slice(heading.index + heading[0].length, headings[index + 1]?.index ?? body.length)
  .replace(/^.*?\n\n/s, '')
  .trim().split(/\n\s*\n/)
  .map(paragraph => paragraph.split('\n').map(line => line.trim()).join(' ').replace(/\s+/g, ' ').trim())
  .filter(paragraph => paragraph && !/^\*(?:\s+\*)+$/u.test(paragraph) && paragraph !== 'THE END'))

// Boundaries follow the modeled beats after moving Alice's cake-driven growth
// to its actual position at the opening of Chapter II.
const boundaries = [
  [3, 11, 14], [7, 8, 17, 25], [15, 19, 27, 43], [4, 23, 31, 36],
  [24, 47, 55, 73], [18, 29, 46, 50], [38, 62, 102, 103], [10, 40, 44],
  [36, 47], [48, 72], [15, 63], [22, 57, 64],
]

export const sceneDrafts = chapters.flatMap((paragraphs, index) => {
  const points = [0, ...boundaries[index], paragraphs.length]
  return points.slice(0, -1).map((start, part) => paragraphs.slice(start, points[part + 1]).join('\n\n'))
})

assert.equal(sceneDrafts.length, 51, 'Every modeled event must receive source prose')
assert(sceneDrafts.every(Boolean), 'No modeled event may receive an empty manuscript scene')
assert.equal(sceneDrafts.join('\n\n'), chapters.flat().join('\n\n'), 'Scene prose must reproduce all narrative paragraphs in source order')
