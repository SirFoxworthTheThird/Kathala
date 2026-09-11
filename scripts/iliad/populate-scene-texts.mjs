import assert from 'node:assert/strict'
import fs from 'node:fs'

const sourcePath = 'scripts/iliad/source/pg2199.txt'
const editablePath = 'example/The Iliad.pwk'
const libraryPath = 'public/library/the-iliad.pwk'

const assignments = {
  1: { 1: [[0, 6]], 2: [[6, 26]], 3: [[26, 28], [36, 40]], 4: [[28, 36], [40, 54]] },
  2: { 5: [[0, 8]], 6: [[8, 16]], 7: [[16, 28]], 8: [[28, 83]] },
  3: { 9: [[0, 10]], 10: [[10, 28]], 11: [[28, 41]] },
  4: { 12: [[0, 10]], 13: [[10, 32]], 14: [[32, 39]] },
  5: { 15: [[0, 16]], 16: [[16, 28]], 17: [[28, 67]] },
  6: { 18: [[0, 17]], 19: [[17, 26]], 20: [[26, 35]] },
  7: { 21: [[0, 2]], 22: [[2, 16]], 23: [[16, 35]] },
  8: { 24: [[0, 6]], 25: [[6, 38]], 26: [[38, 41]] },
  9: { 27: [[0, 12]], 28: [[12, 28]], 29: [[28, 34]] },
  10: { 30: [[0, 25]], 31: [[25, 39]], 32: [[39, 48]] },
  11: { 33: [[0, 18]], 34: [[18, 44]], 35: [[44, 55]] },
  12: { 36: [[0, 10]], 37: [[10, 20]], 38: [[20, 21]] },
  13: { 39: [[0, 14]], 40: [[14, 45]], 41: [[45, 54]] },
  14: { 41: [[0, 11]], 42: [[11, 23]], 43: [[23, 30]], 44: [[30, 40]] },
  15: { 45: [[0, 17]], 46: [[17, 30]], 47: [[30, 54]] },
  16: { 48: [[0, 25]], 49: [[25, 43]], 50: [[43, 54]] },
  17: { 51: [[0, 26]], 52: [[26, 34]], 53: [[34, 43], [47, 50]], 54: [[43, 47]] },
  18: { 54: [[0, 3]], 55: [[3, 11]], 56: [[11, 28]], 57: [[28, 48]] },
  19: { 58: [[0, 26]], 59: [[26, 31]] },
  20: { 60: [[0, 14]], 61: [[14, 25]], 62: [[25, 36]] },
  21: { 63: [[0, 12]], 64: [[12, 22]], 65: [[22, 34]], 66: [[34, 39]] },
  22: { 67: [[0, 3]], 68: [[3, 20]], 69: [[20, 33]] },
  23: { 70: [[0, 10]], 71: [[10, 19]], 72: [[19, 65]] },
  24: { 73: [[0, 35]], 74: [[35, 49]], 75: [[49, 56]] },
}

const source = fs.readFileSync(sourcePath, 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE ILIAD \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE ILIAD \*\*\*/)?.[0]
assert(startMarker && endMarker, 'The Butler source must contain Gutenberg start and end markers')
const body = source.slice(source.indexOf(startMarker) + startMarker.length, source.indexOf(endMarker))
const headings = [...body.matchAll(/^BOOK ([IVX]+)\.?$/gm)]
assert.equal(headings.length, 24, 'The Butler source must contain Books I–XXIV')

const books = headings.map((heading, index) => {
  const raw = body.slice(heading.index + heading[0].length, headings[index + 1]?.index ?? body.length).trim()
  const paragraphs = raw.split(/\n\s*\n/).map(paragraph => paragraph
    .split('\n')
    .map(line => line.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim())
    .filter(Boolean)
    .filter(paragraph => !/^End of the Project Gutenberg EBook/i.test(paragraph))
  return paragraphs.slice(1) // Butler's prose summary precedes each book's narrative.
})

const eventParagraphs = new Map()
for (const [bookNumberText, eventRanges] of Object.entries(assignments)) {
  const bookNumber = Number(bookNumberText)
  const paragraphs = books[bookNumber - 1]
  const used = new Set()
  for (const [eventNumberText, ranges] of Object.entries(eventRanges)) {
    const eventNumber = Number(eventNumberText)
    const selected = []
    for (const [start, end] of ranges) {
      assert(start >= 0 && end <= paragraphs.length && start < end, `Invalid Book ${bookNumber} range ${start}:${end}`)
      for (let index = start; index < end; index += 1) {
        assert(!used.has(index), `Book ${bookNumber} paragraph ${index} is assigned twice`)
        used.add(index)
        selected.push(paragraphs[index])
      }
    }
    const existing = eventParagraphs.get(eventNumber) ?? []
    eventParagraphs.set(eventNumber, [...existing, ...selected])
  }
  assert.equal(used.size, paragraphs.length, `Book ${bookNumber} has unassigned narrative paragraphs`)
}
assert.equal(eventParagraphs.size, 75, 'Every modeled event must receive source prose')

const data = JSON.parse(fs.readFileSync(editablePath, 'utf8'))
const timestamp = data.exportedAt
data.sceneTexts = data.events.map((event, index) => {
  const eventNumber = index + 1
  const paragraphs = eventParagraphs.get(eventNumber)
  assert(paragraphs?.length, `${event.id} has no source prose`)
  const text = paragraphs.join('\n\n')
  return {
    id: `iliad-scene-${String(eventNumber).padStart(3, '0')}`,
    worldId: data.world.id,
    eventId: event.id,
    text,
    wordCount: text.trim().split(/\s+/u).length,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
})

const textualBasis = data.lorePages.find(page => page.title === 'Textual Basis')
assert(textualBasis, 'Missing Textual Basis lore page')
textualBasis.body = 'Primary source: Homer, The Iliad, translated by Samuel Butler, Project Gutenberg eBook 2199 (https://www.gutenberg.org/ebooks/2199), a complete public-domain English edition divided into Books I–XXIV. The scene drafts reproduce Butler’s narrative prose, divided among the modeled events without rewriting, omission, or duplication; Gutenberg’s front matter, per-book prose summaries, and end matter are excluded. The Internet Classics Archive table of contents (https://classics.mit.edu/Homer/iliad.html) was used as a second structural check. Every PlotWeave synopsis, title, description, and status note remains original editorial writing.'
textualBasis.updatedAt = timestamp

const output = `${JSON.stringify(data, null, 2)}\n`
fs.writeFileSync(editablePath, output)
fs.writeFileSync(libraryPath, output)

console.log(JSON.stringify({ sceneTexts: data.sceneTexts.length, words: data.sceneTexts.reduce((sum, scene) => sum + scene.wordCount, 0), bytes: Buffer.byteLength(output) }, null, 2))
