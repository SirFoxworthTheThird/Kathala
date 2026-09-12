import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('scripts/count-of-monte-cristo/source/pg1184.txt', 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK 1184 \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK 1184 \*\*\*/)?.[0]
assert(startMarker && endMarker, 'The Count of Monte Cristo source must contain Gutenberg boundaries')
const start = source.indexOf(' Chapter 1. Marseilles—The Arrival', source.indexOf(startMarker))
const body = source.slice(start, source.indexOf(endMarker)).trim()
const headings = [...body.matchAll(/^ ?Chapter (\d+)\. (.+)$/gm)]
assert.equal(headings.length, 117, 'The source must contain 117 narrative chapter headings')
headings.forEach((heading, index) => assert.equal(Number(heading[1]), index + 1, 'Chapter numbering must remain sequential'))
const normalize = text => text.trim().split(/\n\s*\n/).map(paragraph => paragraph.split('\n').map(line => line.trim()).join(' ').replace(/\s+/g, ' ').trim()).filter(paragraph => paragraph && !/^\d+m$/.test(paragraph))
export const sourceChapters = headings.map((heading, index) => normalize(body.slice(heading.index + heading[0].length, headings[index + 1]?.index ?? body.length)))

const boundaries = new Map([
  [1, [7]], [5, [51]], [7, [56]], [8, [39]], [13, [66]], [20, [16]], [23, [8]], [24, [54]],
  [30, [138]], [33, [91]], [37, [207]], [41, [38]], [44, [63]], [47, [67]], [52, [80]], [58, [73]],
  [63, [99]], [74, [52]], [77, [76, 158, 211]], [79, [123]], [82, [187]], [86, [66]], [92, [99]],
  [96, [130]], [102, [32]], [109, [89]], [111, [64]], [113, [87]], [116, [73]], [117, [90]],
])

export function buildSceneDrafts(chapterEvents) {
  assert.equal(chapterEvents.length, 117, 'Modeled and source chapter counts must match')
  const anchors = []
  const drafts = sourceChapters.flatMap((paragraphs, chapterIndex) => {
    const chapterNumber = chapterIndex + 1
    const events = chapterEvents[chapterIndex]
    assert(events.length > 0, `Chapter ${chapterNumber} must have an event`)
    const cuts = boundaries.get(chapterNumber) ?? []
    assert.equal(cuts.length, events.length - 1, `Boundary count mismatch in Chapter ${chapterNumber}`)
    assert(cuts.every((cut, index) => cut > (cuts[index - 1] ?? 0) && cut < paragraphs.length), `Invalid boundary in Chapter ${chapterNumber}`)
    const points = [0, ...cuts, paragraphs.length]
    cuts.forEach((paragraph, eventIndex) => anchors.push({ chapter: chapterNumber, event: events[eventIndex + 1].title, paragraph, excerpt: paragraphs[paragraph].slice(0, 140) }))
    return points.slice(0, -1).map((point, index) => paragraphs.slice(point, points[index + 1]).join('\n\n'))
  })
  assert(drafts.every(Boolean), 'No modeled event may receive an empty scene')
  assert.equal(drafts.join('\n\n'), sourceChapters.flat().join('\n\n'), 'Scenes must reproduce every narrative paragraph exactly once and in order')
  return { sceneDrafts: drafts, anchors }
}
