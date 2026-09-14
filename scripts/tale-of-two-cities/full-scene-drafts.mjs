import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('scripts/tale-of-two-cities/source/pg98.txt', 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK 98 \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK 98 \*\*\*/)?.[0]
assert(startMarker && endMarker, 'A Tale of Two Cities source must contain Gutenberg boundaries')
const start = source.indexOf('CHAPTER I.', source.indexOf(startMarker))
const body = source.slice(start, source.indexOf(endMarker)).trim()
const headings = [...body.matchAll(/^CHAPTER [IVXLCDM]+\.$/gm)]
assert.equal(headings.length, 45, 'The source must contain all 45 narrative chapters')
const normalize = text => text.trim().split(/\n\s*\n/).map(paragraph => paragraph.split('\n').map(line => line.trim()).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean)
export const sourceChapters = headings.map((heading, index) => normalize(body.slice(heading.index + heading[0].length, headings[index + 1]?.index ?? body.length)).slice(1).filter(paragraph => paragraph !== '*****' && !/^The end of the (first|second) book\.?$/i.test(paragraph) && !/^Book the (Second|Third)/i.test(paragraph)))
const boundaries = new Map([[2,[31]],[5,[36]],[6,[62]],[15,[102]],[20,[58]],[27,[36]],[30,[85]],[31,[91]],[36,[36]],[40,[17]],[43,[100]],[44,[67]],[45,[43]]])

export function buildSceneDrafts(chapterEvents) {
  assert.equal(chapterEvents.length, 45)
  const anchors = []
  const drafts = sourceChapters.flatMap((paragraphs, chapterIndex) => {
    const number = chapterIndex + 1, events = chapterEvents[chapterIndex], cuts = boundaries.get(number) ?? []
    assert.equal(cuts.length, events.length - 1, `Boundary count mismatch in Chapter ${number}`)
    assert(cuts.every((cut, index) => cut > (cuts[index - 1] ?? 0) && cut < paragraphs.length), `Invalid boundary in Chapter ${number}`)
    const points = [0, ...cuts, paragraphs.length]
    cuts.forEach((paragraph, eventIndex) => anchors.push({ chapter: number, event: events[eventIndex + 1].title, paragraph, excerpt: paragraphs[paragraph].slice(0, 140) }))
    return points.slice(0, -1).map((point, index) => paragraphs.slice(point, points[index + 1]).join('\n\n'))
  })
  assert(drafts.every(Boolean)); assert.equal(drafts.join('\n\n'), sourceChapters.flat().join('\n\n'))
  return { sceneDrafts: drafts, anchors }
}
