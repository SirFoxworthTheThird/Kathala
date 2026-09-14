import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('scripts/twenty-thousand-leagues/source/pg164.txt', 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK 164 \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK 164 \*\*\*/)?.[0]
assert(startMarker && endMarker, 'Twenty Thousand Leagues source must contain Gutenberg boundaries')
const firstChapter = source.indexOf('\nCHAPTER I\nA SHIFTING REEF', source.indexOf(startMarker)) + 1
const body = source.slice(firstChapter, source.indexOf(endMarker)).trim()
const headings = [...body.matchAll(/^CHAPTER [IVXLCDM]+\n[^\n]+\s*$/gm)]
assert.equal(headings.length, 46, 'The source must contain 46 chapters')
const normalize = text => text.trim().split(/\n\s*\n/).map(paragraph => paragraph.split('\n').map(line => line.trim()).join(' ').replace(/\s+/g, ' ').trim()).filter(paragraph => paragraph && !/^PART II$/i.test(paragraph))
const chapters = headings.map((heading, index) => normalize(body.slice(heading.index + heading[0].length, headings[index + 1]?.index ?? body.length)))
const stopWords = new Set('a an and are as at be been but by for from had has have he her his i in into is it its of on or our she that the their them they this to was we were with you'.split(' '))
const words = value => new Set((value.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter(word => !stopWords.has(word)))

export function buildSceneDrafts(chapterEvents) {
  assert.equal(chapterEvents.length, chapters.length, 'Modeled and source chapter counts must match')
  const anchors = []
  const manualBoundaries = new Map([
    [1, [14]], [2, [17]], [3, [27]], [4, [14]], [5, [15]], [6, [17]], [7, [48]], [8, [8]],
    [9, [20]], [10, [21]], [11, [16]], [12, [35]], [13, [17]], [14, [33]], [15, [21]],
    [16, [20]], [17, [25]], [18, [21]], [19, [16]], [20, [50]], [21, [90]], [22, [43]],
    [23, [50]], [24, [21]], [26, [29, 37]], [27, [60]], [28, [44]], [29, [65]], [30, [24]],
    [31, [23]], [32, [38]], [33, [20]], [34, [4]], [35, [56]], [36, [18]], [37, [42]],
    [38, [31]], [39, [42]], [40, [13]], [41, [45]], [42, [15]], [43, [8]], [44, [23]],
    [45, [19]], [46, [1]],
  ])
  const sceneDrafts = chapters.flatMap((paragraphs, chapterIndex) => {
    const events = chapterEvents[chapterIndex]
    assert(events.length > 0, `Chapter ${chapterIndex + 1} must have an event`)
    const manual = manualBoundaries.get(chapterIndex + 1)
    if (manual) {
      assert.equal(manual.length, events.length - 1, `Boundary count mismatch in Chapter ${chapterIndex + 1}`)
      const points = [0, ...manual, paragraphs.length]
      manual.forEach((paragraph, eventIndex) => anchors.push({ chapter: chapterIndex + 1, event: events[eventIndex + 1].title, paragraph, excerpt: paragraphs[paragraph].slice(0, 140) }))
      return points.slice(0, -1).map((start, part) => paragraphs.slice(start, points[part + 1]).join('\n\n'))
    }
    assert.equal(events.length, 1, `Chapter ${chapterIndex + 1} needs manual boundaries`)
    return [paragraphs.join('\n\n')]
  })
  assert(sceneDrafts.every(Boolean), 'No event may receive an empty scene')
  assert.equal(sceneDrafts.join('\n\n'), chapters.flat().join('\n\n'), 'Scenes must reproduce all narrative paragraphs once in source order')
  return { sceneDrafts, anchors }
}

export const sourceChapters = chapters
