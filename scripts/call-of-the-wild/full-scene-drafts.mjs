import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('scripts/call-of-the-wild/source/pg215.txt', 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE CALL OF THE WILD \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE CALL OF THE WILD \*\*\*/)?.[0]
assert(startMarker && endMarker, 'The Call of the Wild source must contain Gutenberg boundaries')
const body = source.slice(source.indexOf(startMarker) + startMarker.length, source.indexOf(endMarker))
const headings = [...body.matchAll(/^Chapter [IVXLCDM]+\.[^\n]*$/gm)]
assert.equal(headings.length, 7, 'The source must contain Chapters I-VII')

const chapters = headings.map((heading, index) => body
  .slice(heading.index + heading[0].length, headings[index + 1]?.index ?? body.length)
  .trim().split(/\n\s*\n/)
  .map(paragraph => paragraph.split('\n').map(line => line.trim()).join(' ').replace(/\s+/g, ' ').trim())
  .filter(Boolean))

const boundaries = [
  [7, 13, 26, 42],
  [1, 4, 8, 14],
  [21, 31, 35],
  [13, 21, 22, 28, 34],
  [6, 35, 50, 57, 62],
  [17, 19, 28, 49],
  [11, 16, 26, 35, 38, 40, 46],
]

export const sceneDrafts = chapters.flatMap((paragraphs, index) => {
  const points = [0, ...boundaries[index], paragraphs.length]
  return points.slice(0, -1).map((start, part) => paragraphs.slice(start, points[part + 1]).join('\n\n'))
})

assert.equal(sceneDrafts.length, 39, 'Every modeled event must receive source prose')
assert.equal(sceneDrafts.join('\n\n'), chapters.flat().join('\n\n'), 'Scene prose must reproduce all narrative paragraphs in source order')

