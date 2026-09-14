import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('scripts/dracula/source/pg345.txt', 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK DRACULA \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK DRACULA \*\*\*/)?.[0]
assert(startMarker && endMarker, 'Dracula source must contain Gutenberg boundaries')
const chapterStart = source.indexOf('CHAPTER I\n')
const narrativeEnd = source.indexOf('THE END', chapterStart)
assert(chapterStart >= 0 && narrativeEnd > chapterStart, 'Dracula narrative boundaries were not found')
const body = source.slice(chapterStart, narrativeEnd)
const headings = [...body.matchAll(/^CHAPTER [IVXLCDM]+\s*$/gm)]
assert.equal(headings.length, 27, 'The source must contain Chapters I-XXVII')

const chapters = headings.map((heading, index) => body
  .slice(heading.index + heading[0].length, headings[index + 1]?.index ?? body.length)
  .trim().split(/\n\s*\n/)
  .map(paragraph => paragraph.split('\n').map(line => line.trim()).join(' ').replace(/\s+/g, ' ').trim())
  .filter(paragraph => paragraph && !/^\*(?:\s+\*)+$/u.test(paragraph)))

const stopWords = new Set('a an and are as at be been but by for from had has have he her his i in into is it its of on or our she that the their them they this to was we were with you'.split(' '))
const words = value => new Set((value.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter(word => !stopWords.has(word)))

export function buildSceneDrafts(chapterEvents) {
  assert.equal(chapterEvents.length, chapters.length, 'Modeled and source chapter counts must match')
  const anchors = []
  const manualBoundaries = new Map([
    [7, [16, 32, 43]],
    [9, [5, 31]],
    [10, [33, 88]],
    [14, [65, 83]],
    [18, [20, 57]],
    [19, [23, 40]],
    [20, [46, 87]],
    [22, [14, 49]],
    [23, [22, 54]],
    [24, [15, 33]],
    [26, [55, 75]],
    [27, [33, 56, 58, 72]],
  ])
  const sceneDrafts = chapters.flatMap((paragraphs, chapterIndex) => {
    const events = chapterEvents[chapterIndex]
    assert(events.length > 0, `Chapter ${chapterIndex + 1} must have an event`)
    const manual = manualBoundaries.get(chapterIndex + 1)
    if (manual) {
      assert.equal(manual.length, events.length - 1, `Manual boundary count mismatch in Chapter ${chapterIndex + 1}`)
      const points = [0, ...manual, paragraphs.length]
      manual.forEach((paragraph, eventIndex) => anchors.push({chapter: chapterIndex + 1, event: events[eventIndex + 1].title, paragraph, excerpt: paragraphs[paragraph].slice(0, 100)}))
      return points.slice(0, -1).map((start, part) => paragraphs.slice(start, points[part + 1]).join('\n\n'))
    }
    const points = [0]
    for (let eventIndex = 1; eventIndex < events.length; eventIndex += 1) {
      const remaining = events.length - eventIndex
      const expected = Math.round(paragraphs.length * eventIndex / events.length)
      const segment = paragraphs.length / events.length
      const earliest = Math.max(points.at(-1) + 1, Math.floor(expected - segment * 0.45))
      const latest = Math.min(paragraphs.length - remaining, Math.ceil(expected + segment * 0.45))
      const titleTerms = words(events[eventIndex].title)
      const descriptionTerms = words(events[eventIndex].description ?? '')
      let best = earliest
      let bestScore = -Infinity
      for (let paragraphIndex = earliest; paragraphIndex <= latest; paragraphIndex += 1) {
        const paragraphWords = words(paragraphs[paragraphIndex])
        let score = -Math.abs(paragraphIndex - expected) * 0.08
        for (const term of titleTerms) if (paragraphWords.has(term)) score += term.length >= 7 ? 36 : 24
        for (const term of descriptionTerms) if (paragraphWords.has(term)) score += term.length >= 7 ? 8 : 5
        if (score > bestScore) {
          best = paragraphIndex
          bestScore = score
        }
      }
      points.push(best)
      anchors.push({chapter: chapterIndex + 1, event: events[eventIndex].title, paragraph: best, excerpt: paragraphs[best].slice(0, 100)})
    }
    points.push(paragraphs.length)
    return points.slice(0, -1).map((start, part) => paragraphs.slice(start, points[part + 1]).join('\n\n'))
  })
  assert(sceneDrafts.every(Boolean), 'No modeled event may receive an empty manuscript scene')
  assert.equal(sceneDrafts.join('\n\n'), chapters.flat().join('\n\n'), 'Scene prose must reproduce all narrative paragraphs in source order')
  return { sceneDrafts, anchors }
}

export const sourceChapterParagraphs = chapters
