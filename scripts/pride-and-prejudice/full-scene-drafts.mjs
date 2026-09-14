import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('scripts/pride-and-prejudice/source/pg1342.txt', 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK 1342 \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK 1342 \*\*\*/)?.[0]
assert(startMarker && endMarker, 'Pride and Prejudice source must contain Gutenberg boundaries')

const narrativeStart = source.indexOf('It is a truth universally acknowledged', source.indexOf(startMarker) + startMarker.length)
const narrativeEnd = source.lastIndexOf('[Illustration:', source.indexOf(endMarker))
assert(narrativeStart > 0 && narrativeEnd > narrativeStart, 'Could not identify narrative boundaries')
const body = source.slice(narrativeStart, narrativeEnd).trim()
const headings = [...body.matchAll(/^(?:CHAPTER|Chapter) [IVXLCDM]+\.?\s*$/gm)]
assert.equal(headings.length, 60, 'The source must contain headings for Chapters II-LXI')

const normalize = text => text.trim().split(/\n\s*\n/).map(paragraph => paragraph.split('\n').map(line => line.trim()).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean)
const chapters = [
  normalize(body.slice(0, headings[0].index)),
  ...headings.map((heading, index) => normalize(body.slice(heading.index + heading[0].length, headings[index + 1]?.index ?? body.length))),
]
assert.equal(chapters.length, 61)

const stopWords = new Set('a an and are as at be been but by for from had has have he her his i in into is it its of on or our she that the their them they this to was we were with you'.split(' '))
const words = value => new Set((value.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter(word => !stopWords.has(word)))

export function buildSceneDrafts(chapterEvents) {
  assert.equal(chapterEvents.length, chapters.length, 'Modeled and source chapter counts must match')
  const anchors = []
  const manualBoundaries = new Map([
    [3, [11]], [4, [12]], [6, [38]], [7, [14, 38]], [8, [21]], [9, [36]], [10, [24]],
    [13, [25]], [15, [6]], [17, [9]], [18, [8, 66]], [22, [17]], [26, [20, 29]],
    [33, [2]], [34, [7]], [36, [13]], [41, [14, 28]], [43, [46, 50]], [45, [9]],
    [46, [9]], [47, [59]], [48, [24]], [50, [7]], [51, [25]], [55, [23]], [56, [60]],
    [58, [7, 9]], [59, [20]], [60, [17]], [61, [3, 11]],
  ])
  const sceneDrafts = chapters.flatMap((paragraphs, chapterIndex) => {
    const events = chapterEvents[chapterIndex]
    assert(events.length > 0, `Chapter ${chapterIndex + 1} must have an event`)
    const manual = manualBoundaries.get(chapterIndex + 1)
    if (manual) {
      assert.equal(manual.length, events.length - 1, `Boundary count mismatch in Chapter ${chapterIndex + 1}`)
      const points = [0, ...manual, paragraphs.length]
      manual.forEach((paragraph, eventIndex) => anchors.push({ chapter: chapterIndex + 1, event: events[eventIndex + 1].title, paragraph, excerpt: paragraphs[paragraph].slice(0, 120) }))
      return points.slice(0, -1).map((start, part) => paragraphs.slice(start, points[part + 1]).join('\n\n'))
    }
    const points = [0]
    for (let eventIndex = 1; eventIndex < events.length; eventIndex += 1) {
      const remaining = events.length - eventIndex
      const expected = Math.round(paragraphs.length * eventIndex / events.length)
      const segment = paragraphs.length / events.length
      const earliest = Math.max(points.at(-1) + 1, Math.floor(expected - segment * .55))
      const latest = Math.min(paragraphs.length - remaining, Math.ceil(expected + segment * .55))
      const titleTerms = words(events[eventIndex].title)
      const descriptionTerms = words(events[eventIndex].description ?? '')
      let best = earliest
      let bestScore = -Infinity
      for (let paragraphIndex = earliest; paragraphIndex <= latest; paragraphIndex += 1) {
        const paragraphWords = words(paragraphs[paragraphIndex])
        let score = -Math.abs(paragraphIndex - expected) * .08
        for (const term of titleTerms) if (paragraphWords.has(term)) score += term.length >= 7 ? 36 : 24
        for (const term of descriptionTerms) if (paragraphWords.has(term)) score += term.length >= 7 ? 8 : 5
        if (score > bestScore) { best = paragraphIndex; bestScore = score }
      }
      points.push(best)
      anchors.push({ chapter: chapterIndex + 1, event: events[eventIndex].title, paragraph: best, excerpt: paragraphs[best].slice(0, 120) })
    }
    points.push(paragraphs.length)
    return points.slice(0, -1).map((start, part) => paragraphs.slice(start, points[part + 1]).join('\n\n'))
  })
  assert(sceneDrafts.every(Boolean), 'No event may receive an empty scene')
  assert.equal(sceneDrafts.join('\n\n'), chapters.flat().join('\n\n'), 'Scenes must reproduce all narrative paragraphs once in source order')
  return { sceneDrafts, anchors }
}

export const sourceChapters = chapters
