import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('scripts/scarlet-pimpernel/source/pg60.txt', 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE SCARLET PIMPERNEL \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE SCARLET PIMPERNEL \*\*\*/)?.[0]
assert(startMarker && endMarker, 'The Scarlet Pimpernel source must contain Gutenberg boundaries')
const body = source.slice(source.indexOf(startMarker) + startMarker.length, source.indexOf(endMarker))
const headings = [...body.matchAll(/^CHAPTER [IVXLCDM]+\.$/gm)]
assert.equal(headings.length, 31, 'The source must contain Chapters I-XXXI')

const chapters = headings.map((heading, index) => {
  const raw = body.slice(heading.index + heading[0].length, headings[index + 1]?.index ?? body.length).trim()
  const paragraphs = raw.split(/\n\s*\n/).map(paragraph => paragraph
    .split('\n').map(line => line.trim()).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean)
  assert(paragraphs.length > 1, `Chapter ${index + 1} has no narrative prose`)
  return paragraphs.slice(1) // Uppercase authorial chapter title.
})

const boundaries = new Map([
  [9, [57]],
  [14, [53]],
  [21, [32]],
  [22, [22]],
  [25, [11]],
  [31, [58]],
])

export const sceneDrafts = chapters.flatMap((paragraphs, index) => {
  const cuts = boundaries.get(index + 1) ?? []
  const points = [0, ...cuts, paragraphs.length]
  return points.slice(0, -1).map((start, part) => paragraphs.slice(start, points[part + 1]).join('\n\n'))
})

assert.equal(sceneDrafts.length, 37, 'Every modeled event must receive source prose')
assert.equal(sceneDrafts.join('\n\n'), chapters.flat().join('\n\n'), 'Scene prose must reproduce all narrative paragraphs in source order')

