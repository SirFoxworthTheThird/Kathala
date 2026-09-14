import assert from 'node:assert/strict'
import fs from 'node:fs'

// Contiguous, end-exclusive paragraph ranges from Samuel Butler's translation.
// Every narrative paragraph in each book is assigned exactly once and remains
// in source order when the manuscript is compiled by chapter and event order.
const assignments = {
  1: { 1: [0, 8], 2: [8, 22], 3: [22, 32] },
  2: { 4: [0, 16], 5: [16, 35] },
  3: { 6: [0, 11], 7: [11, 38] },
  4: { 8: [0, 28], 9: [28, 52], 10: [52, 81] },
  5: { 11: [0, 11], 12: [11, 21], 13: [21, 37] },
  6: { 14: [0, 10], 15: [10, 26] },
  7: { 16: [0, 12], 17: [12, 29] },
  8: { 18: [0, 43], 19: [43, 50] },
  9: { 20: [0, 4], 21: [4, 5], 22: [5, 21], 23: [21, 33], 24: [33, 44] },
  10: { 25: [0, 2], 26: [2, 4], 27: [4, 7], 28: [7, 11], 29: [11, 21], 30: [21, 38], 31: [38, 49] },
  11: { 32: [0, 2], 33: [2, 5], 34: [5, 11], 35: [11, 16], 36: [16, 54] },
  12: { 37: [0, 16], 38: [16, 20], 39: [20, 30], 40: [30, 33], 41: [33, 39] },
  13: { 42: [0, 19], 43: [19, 38] },
  14: { 44: [0, 10], 45: [10, 35] },
  15: { 46: [0, 26], 47: [26, 48] },
  16: { 48: [0, 23], 49: [23, 45] },
  17: { 50: [0, 30], 51: [30, 63] },
  18: { 52: [0, 15], 53: [15, 41] },
  19: { 54: [0, 7], 55: [7, 24], 56: [24, 39] },
  20: { 57: [0, 30], 58: [30, 36] },
  21: { 59: [0, 15], 60: [15, 42] },
  22: { 61: [0, 7], 62: [7, 33], 63: [33, 52] },
  23: { 64: [0, 20], 65: [20, 29] },
  24: { 66: [0, 12], 67: [12, 28], 68: [28, 45] },
}

const sourcePath = 'scripts/odyssey/source/pg1727.txt'
const source = fs.readFileSync(sourcePath, 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE ODYSSEY \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE ODYSSEY \*\*\*/)?.[0]
assert(startMarker && endMarker, 'The Butler source must contain Gutenberg start and end markers')

const body = source.slice(source.indexOf(startMarker) + startMarker.length, source.indexOf(endMarker))
const headings = [...body.matchAll(/^BOOK ([IVX]+)$/gm)]
assert.equal(headings.length, 24, 'The Butler source must contain Books I-XXIV')

const books = headings.map((heading, index) => {
  const nextBook = headings[index + 1]?.index
  const footnotes = index === 23 ? body.indexOf('\nFOOTNOTES:', heading.index) : -1
  const end = nextBook ?? (footnotes >= 0 ? footnotes : body.length)
  const raw = body.slice(heading.index + heading[0].length, end).trim()
  const paragraphs = raw
    .split(/\n\s*\n/)
    .map(paragraph => paragraph
      .split('\n')
      .map(line => line.trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(Boolean)
  return paragraphs.slice(1) // Butler's uppercase prose summary precedes each book.
})

const eventParagraphs = new Map()
for (const [bookNumberText, eventRanges] of Object.entries(assignments)) {
  const bookNumber = Number(bookNumberText)
  const paragraphs = books[bookNumber - 1]
  const used = new Set()
  for (const [eventNumberText, [start, end]] of Object.entries(eventRanges)) {
    const eventNumber = Number(eventNumberText)
    assert(start >= 0 && end <= paragraphs.length && start < end, `Invalid Book ${bookNumber} range ${start}:${end}`)
    const selected = []
    for (let index = start; index < end; index += 1) {
      assert(!used.has(index), `Book ${bookNumber} paragraph ${index} is assigned twice`)
      used.add(index)
      selected.push(paragraphs[index])
    }
    eventParagraphs.set(eventNumber, selected)
  }
  assert.equal(used.size, paragraphs.length, `Book ${bookNumber} has unassigned narrative paragraphs`)
}
assert.equal(eventParagraphs.size, 68, 'Every modeled event must receive source prose')

export const sceneDrafts = Array.from({ length: 68 }, (_, index) => {
  const paragraphs = eventParagraphs.get(index + 1)
  assert(paragraphs?.length, `Odyssey event ${index + 1} has no source prose`)
  return paragraphs.join('\n\n')
})

assert.equal(
  sceneDrafts.join('\n\n'),
  books.flat().join('\n\n'),
  'Compiled scene prose must reproduce the complete narrative in source order',
)
