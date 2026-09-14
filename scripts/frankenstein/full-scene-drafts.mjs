import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('scripts/frankenstein/source/pg84.txt', 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK FRANKENSTEIN; OR, THE MODERN PROMETHEUS \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK FRANKENSTEIN; OR, THE MODERN PROMETHEUS \*\*\*/)?.[0]
assert(startMarker && endMarker, 'Frankenstein source must contain Gutenberg boundaries')
const contentsLetter = source.indexOf('Letter 1\n', source.indexOf(startMarker) + startMarker.length)
const narrativeStart = source.indexOf('Letter 1\n', contentsLetter + 1)
const body = source.slice(narrativeStart, source.indexOf(endMarker))
const headings = [...body.matchAll(/^(?:Letter [1-4]|Chapter (?:[1-9]|1[0-9]|2[0-4]))\s*$/gm)]
assert.equal(headings.length, 28, 'The source must contain four letters and Chapters 1-24')

const sections = headings.map((heading, index) => body
  .slice(heading.index + heading[0].length, headings[index + 1]?.index ?? body.length)
  .trim().split(/\n\s*\n/)
  .map(paragraph => paragraph.split('\n').map(line => line.trim()).join(' ').replace(/\s+/g, ' ').trim())
  .filter(Boolean))

const stopWords = new Set('a an and are as at be been but by for from had has have he her his i in into is it its of on or our she that the their them they this to was we were with you'.split(' '))
const words = value => new Set((value.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter(word => !stopWords.has(word)))

export function buildSceneDrafts(sectionEvents) {
  assert.equal(sectionEvents.length, sections.length, 'Modeled and source section counts must match')
  const anchors = []
  const manualBoundaries = new Map([
    [4, [4, 7]],
    [7, [3, 14]],
    [9, [2, 9]],
    [12, [2, 16]],
    [14, [5, 11]],
    [18, [7, 12]],
    [19, [7, 15]],
    [20, [15, 24]],
    [24, [3, 12, 21]],
    [25, [8, 12]],
    [26, [21, 30]],
    [27, [14, 18]],
    [28, [7, 23, 42, 60, 66]],
  ])
  const sceneDrafts = sections.flatMap((paragraphs, sectionIndex) => {
    const events = sectionEvents[sectionIndex]
    assert(events.length > 0, `Section ${sectionIndex + 1} must have an event`)
    const manual = manualBoundaries.get(sectionIndex + 1)
    if (manual) {
      assert.equal(manual.length, events.length - 1, `Manual boundary count mismatch in Section ${sectionIndex + 1}`)
      const points = [0, ...manual, paragraphs.length]
      manual.forEach((paragraph, eventIndex) => anchors.push({section: sectionIndex + 1, event: events[eventIndex + 1].title, paragraph, excerpt: paragraphs[paragraph].slice(0, 100)}))
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
        if (score > bestScore) { best = paragraphIndex; bestScore = score }
      }
      points.push(best)
      anchors.push({section: sectionIndex + 1, event: events[eventIndex].title, paragraph: best, excerpt: paragraphs[best].slice(0, 100)})
    }
    points.push(paragraphs.length)
    return points.slice(0, -1).map((start, part) => paragraphs.slice(start, points[part + 1]).join('\n\n'))
  })
  assert(sceneDrafts.every(Boolean), 'No modeled event may receive an empty manuscript scene')
  assert.equal(sceneDrafts.join('\n\n'), sections.flat().join('\n\n'), 'Scene prose must reproduce all narrative paragraphs in source order')
  return { sceneDrafts, anchors }
}

export const sourceSections = sections
