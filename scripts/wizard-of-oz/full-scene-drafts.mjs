import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('scripts/wizard-of-oz/source/pg55.txt', 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE WONDERFUL WIZARD OF OZ \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE WONDERFUL WIZARD OF OZ \*\*\*/)?.[0]
assert(startMarker && endMarker, 'Wizard of Oz source must contain Gutenberg boundaries')
const content = source.slice(source.indexOf(startMarker) + startMarker.length, source.indexOf(endMarker))
const body = content.slice(content.indexOf('\nChapter I\n'))
const headings = [...body.matchAll(/^Chapter [IVXLCDM]+\n[^\n]+$/gm)]
assert.equal(headings.length, 24, 'The source must contain Chapters I-XXIV')

const cleanParagraphs = text => text.trim().split(/\n\s*\n/)
  .map(paragraph => paragraph.split('\n').map(line => line.trim()).join(' ').replace(/\s+/g, ' ').trim())
  .filter(paragraph => paragraph && paragraph !== '[Illustration]')

const introductionStart = content.indexOf('\nIntroduction\n')
const introductionEnd = content.indexOf('\nThe Wonderful Wizard of Oz\n', introductionStart)
assert(introductionStart >= 0 && introductionEnd > introductionStart, 'Baum’s Introduction must be present')
const introduction = cleanParagraphs(content.slice(introductionStart + '\nIntroduction\n'.length, introductionEnd))

const chapters = headings.map((heading, index) => cleanParagraphs(body
  .slice(heading.index + heading[0].length, headings[index + 1]?.index ?? body.length)))
chapters[0] = [...introduction, ...chapters[0]]

// Boundaries follow all source-supported modeled beats. The Introduction is
// retained with the opening scene; the invented Uncle Henry barnyard beat was
// removed because Chapter XXIII never depicts it.
const boundaries = [
  [11, 13, 15], [3, 32, 36], [13, 26], [27], [32], [43], [5, 22], [8, 20, 38],
  [18], [5, 43], [8, 17, 51, 65, 78], [10, 11, 21, 29, 35, 38, 45, 57, 61, 68],
  [5, 12, 19], [10, 18], [11, 16, 50], [17, 29], [16, 23], [13, 23, 36],
  [24], [15, 22, 30, 41], [7, 21], [14, 21, 25], [1, 23, 35], [],
]

export const sceneDrafts = chapters.flatMap((paragraphs, index) => {
  const points = [0, ...boundaries[index], paragraphs.length]
  return points.slice(0, -1).map((start, part) => paragraphs.slice(start, points[part + 1]).join('\n\n'))
})

assert.equal(sceneDrafts.length, 86, 'Every source-supported modeled event must receive prose')
assert(sceneDrafts.every(Boolean), 'No modeled event may receive an empty manuscript scene')
assert.equal(sceneDrafts.join('\n\n'), chapters.flat().join('\n\n'), 'Scene prose must reproduce the Introduction and all narrative paragraphs in source order')
