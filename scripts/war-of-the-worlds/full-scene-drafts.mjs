import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('scripts/war-of-the-worlds/source/pg36.txt', 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE WAR OF THE WORLDS \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE WAR OF THE WORLDS \*\*\*/)?.[0]
assert(startMarker && endMarker, 'The War of the Worlds source must contain Gutenberg boundaries')
const body = source.slice(source.indexOf('\nBOOK ONE\n'), source.indexOf(endMarker))
const headings = [...body.matchAll(/^([IVX]+)\.\n([^\n]+)$/gm)]
assert.equal(headings.length, 27, 'The source must contain seventeen Book One and ten Book Two chapters')

const chapters = headings.map((heading, index) => body
  .slice(heading.index + heading[0].length, headings[index + 1]?.index ?? body.length)
  .replace(/\nBOOK TWO\nTHE EARTH UNDER THE MARTIANS\.\s*$/u, '')
  .trim().split(/\n\s*\n/)
  .map(paragraph => paragraph.split('\n').map(line => line.trim()).join(' ').replace(/\s+/g, ' ').trim())
  .filter(Boolean))

// The model has two beats per chapter. These boundaries keep every paragraph
// intact while placing the named second beat in the latter scene.
const boundaries = [10, 11, 7, 10, 12, 5, 17, 5, 21, 14, 18, 34, 25, 26, 17, 40, 18, 20, 13, 7, 14, 9, 5, 48, 15, 9, 6]
export const sceneDrafts = chapters.flatMap((paragraphs, index) => [
  paragraphs.slice(0, boundaries[index]).join('\n\n'),
  paragraphs.slice(boundaries[index]).join('\n\n'),
])

assert.equal(sceneDrafts.length, 54, 'Every modeled event must receive source prose')
assert(sceneDrafts.every(Boolean), 'No modeled event may receive an empty manuscript scene')
assert.equal(sceneDrafts.join('\n\n'), chapters.flat().join('\n\n'), 'Scene prose must reproduce all narrative paragraphs in source order')
