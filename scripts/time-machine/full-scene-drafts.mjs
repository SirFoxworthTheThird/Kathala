import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('scripts/time-machine/source/pg35.txt', 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE TIME MACHINE \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE TIME MACHINE \*\*\*/)?.[0]
assert(startMarker && endMarker, 'The Time Machine source must contain Gutenberg boundaries')
const body = source.slice(source.indexOf('\n I.\n Introduction'), source.indexOf(endMarker))
const headings = [...body.matchAll(/^ (?:[IVX]+\.|Epilogue)\n(?: [^\n]+\n)?/gm)]
assert.equal(headings.length, 17, 'The source must contain Chapters I-XVI and the Epilogue')

const chapters = headings.map((heading, index) => body
  .slice(heading.index + heading[0].length, headings[index + 1]?.index ?? body.length)
  .trim().split(/\n\s*\n/)
  .map(paragraph => paragraph.split('\n').map(line => line.trim()).join(' ').replace(/\s+/g, ' ').trim())
  .filter(Boolean))

// Boundaries follow the modeled beats after correcting their source chapters.
// Each number is the first paragraph of the next event scene.
const boundaries = [
  [33], [21], [6, 19], [3, 6], [8], [], [9, 12],
  [6, 7, 9, 14, 20], [6, 11], [4, 6], [7, 11], [10, 14],
  [10, 13], [9], [], [1, 19, 22],
]

const regularScenes = chapters.slice(0, 16).flatMap((paragraphs, index) => {
  const points = [0, ...boundaries[index], paragraphs.length]
  return points.slice(0, -1).map((start, part) => paragraphs.slice(start, points[part + 1]).join('\n\n'))
})
const epilogue = chapters[16].join('\n\n')
const flowerTransition = epilogue.indexOf('And I have by me, for my comfort,')
assert(flowerTransition > 0, 'The epilogue flower transition must be present')
export const sceneDrafts = [...regularScenes, epilogue.slice(0, flowerTransition).trim(), epilogue.slice(flowerTransition).trim()]

assert.equal(sceneDrafts.length, 46, 'Every modeled event must receive source prose')
assert(sceneDrafts.every(Boolean), 'No modeled event may receive an empty manuscript scene')
const normalize = text => text.replace(/\s+/g, ' ').trim()
assert.equal(normalize(sceneDrafts.join('\n\n')), normalize(chapters.flat().join('\n\n')), 'Scene prose must reproduce all narrative text in source order')
