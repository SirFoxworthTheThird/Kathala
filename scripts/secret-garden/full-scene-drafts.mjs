import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('scripts/secret-garden/source/pg17396.txt', 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE SECRET GARDEN \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE SECRET GARDEN \*\*\*/)?.[0]
assert(startMarker && endMarker, 'The Secret Garden source must contain Gutenberg boundaries')
const body = source.slice(source.indexOf('CHAPTER I\n'), source.indexOf('\nTHE END\n'))
const headings = [...body.matchAll(/^CHAPTER [IVXLCDM]+\s*$/gm)]
assert.equal(headings.length, 27, 'The source must contain Chapters I-XXVII')

const chapters = headings.map((heading, index) => {
  const section = body.slice(heading.index + heading[0].length, headings[index + 1]?.index ?? body.length).trim()
  const paragraphs = section.split(/\n\s*\n/)
    .map(paragraph => paragraph.split('\n').map(line => line.trim()).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  // Each Gutenberg chapter begins with a separate all-caps title paragraph.
  return paragraphs.slice(1)
})

// One boundary normally separates the two modeled events in a chapter. The
// exceptional late chapters reflect the source audit: Chapter XVIII has one
// event, Chapters XX and XXVII have three, and Chapter XXIV has one.
const boundaries = [
  [15], [27], [16], [76], [22], [22], [28], [27], [41],
  [54], [47], [94], [15], [62], [45], [34], [32], [],
  [39], [47, 63], [48], [31], [46], [], [21], [39], [34, 98],
]

export const sceneDrafts = chapters.flatMap((paragraphs, index) => {
  const points = [0, ...boundaries[index], paragraphs.length]
  assert(points.every((point, pointIndex) => pointIndex === 0 || point > points[pointIndex - 1]), `Invalid boundaries in Chapter ${index + 1}`)
  assert(points.at(-1) > points.at(-2), `Empty final scene in Chapter ${index + 1}`)
  return points.slice(0, -1).map((start, part) => paragraphs.slice(start, points[part + 1]).join('\n\n'))
})

assert.equal(sceneDrafts.length, 54, 'Every modeled event must receive source prose')
assert(sceneDrafts.every(Boolean), 'No modeled event may receive an empty manuscript scene')
assert.equal(sceneDrafts.join('\n\n'), chapters.flat().join('\n\n'), 'Scene prose must reproduce all narrative paragraphs in source order')
