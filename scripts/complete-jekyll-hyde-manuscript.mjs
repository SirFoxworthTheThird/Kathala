import assert from 'node:assert/strict'
import fs from 'node:fs'

const examplePath = 'example/Strange Case of Dr Jekyll and Mr Hyde.pwk'
const libraryPath = 'public/library/strange-case-of-dr-jekyll-and-mr-hyde.pwk'
const source = fs.readFileSync('scripts/jekyll-hyde/source/pg43.txt', 'utf8').replaceAll('\r', '')
const startMarker = '*** START OF THE PROJECT GUTENBERG EBOOK THE STRANGE CASE OF DR. JEKYLL AND MR. HYDE ***'
const endMarker = '*** END OF THE PROJECT GUTENBERG EBOOK THE STRANGE CASE OF DR. JEKYLL AND MR. HYDE ***'
assert(source.includes(startMarker) && source.includes(endMarker), 'Gutenberg boundaries are required')
const content = source.slice(source.indexOf(startMarker) + startMarker.length, source.indexOf(endMarker))
const chapterTitles = [
  'STORY OF THE DOOR', 'SEARCH FOR MR. HYDE', 'DR. JEKYLL WAS QUITE AT EASE',
  'THE CAREW MURDER CASE', 'INCIDENT OF THE LETTER', 'INCIDENT OF DR. LANYON',
  'INCIDENT AT THE WINDOW', 'THE LAST NIGHT', 'DR. LANYON’S NARRATIVE',
  'HENRY JEKYLL’S FULL STATEMENT OF THE CASE',
]
const bodyStart = content.indexOf('\n\nSTORY OF THE DOOR\n\n', content.indexOf('HENRY JEKYLL’S FULL STATEMENT OF THE CASE'))
assert(bodyStart >= 0, 'Narrative body is required after the contents list')
const body = content.slice(bodyStart + 2)
const headingPositions = chapterTitles.map(title => ({ title, index: body.indexOf(title) }))
assert(headingPositions.every(({ index }) => index >= 0), 'All ten chapter headings are required')
const clean = text => text.trim().split(/\n\s*\n/)
  .map(paragraph => paragraph.split('\n').map(line => line.trim()).join(' ').replace(/\s+/g, ' ').trim())
  .filter(Boolean)
  .join('\n\n')
const chapters = headingPositions.map(({ title, index }, chapterIndex) => clean(body.slice(
  index + title.length,
  headingPositions[chapterIndex + 1]?.index ?? body.length,
)))

// Each string is the exact first wording of the next modeled event. Some
// divisions occur inside a long narrated paragraph; splitting at the literal
// wording retains every character of the source without duplication.
const starts = [
  ['All at once, I saw two figures:', 'The people who had turned out were the girl’s own family;', 'The next thing was to get the money;', 'Mr. Utterson again walked some way in silence'],
  ['With that he blew out his candle', 'That was the amount of information that the lawyer carried back', 'From that time forward, Mr. Utterson began to haunt the door', 'And at last his patience was rewarded.', 'Round the corner from the by-street'],
  ['“I have been wanting to speak to you, Jekyll,”'],
  ['And then all of a sudden he broke out in a great flame of anger', 'It was two o’clock when she came to herself', 'It was by this time about nine in the morning'],
  ['The lawyer listened gloomily;', 'Presently after, he sat on one side of his own hearth', 'But no sooner was Mr. Utterson alone that night'],
  ['On the 12th, and again on the 14th, the door was shut', 'There at least he was not denied admittance;', 'A week afterwards Dr. Lanyon took to his bed'],
  ['“That is just what I was about to venture to propose,”'],
  ['It was a wild, cold, seasonable night of March', '“Now, sir,” said he, “you come as gently as you can.', 'But now the ten minutes drew to an end.', 'The besiegers, appalled by their own riot', 'They mounted the stair in silence'],
  ['Upon the reading of this letter', 'Twelve o’clock had scarce rung out over London', 'He put the glass to his lips and drank at one gulp.', 'What he told me in the next hour'],
  ['I was so far in my reflections', 'I hesitated long before I put this theory to the test of practice.', 'That night I had come to the fatal cross-roads.', 'The pleasures which I made haste to seek in my disguise', 'Instantly the spirit of hell awoke in me and raged.', 'There comes an end to all things;', 'It is useless, and the time awfully fails me, to prolong this description;', 'About a week has passed, and I am now finishing this statement'],
]

const sceneDrafts = chapters.flatMap((chapter, chapterIndex) => {
  const offsets = starts[chapterIndex].map(marker => {
    const offset = chapter.indexOf(marker)
    assert(offset > 0, `Missing chapter ${chapterIndex + 1} boundary: ${marker}`)
    return offset
  })
  assert(offsets.every((offset, index) => index === 0 || offset > offsets[index - 1]), `Chapter ${chapterIndex + 1} boundaries must be ordered`)
  const points = [0, ...offsets, chapter.length]
  return points.slice(0, -1).map((start, index) => chapter.slice(start, points[index + 1]).trim())
})

const data = JSON.parse(fs.readFileSync(examplePath, 'utf8'))
const orderedEvents = data.chapters.flatMap(chapter => data.events
  .filter(event => event.chapterId === chapter.id)
  .sort((a, b) => a.sortOrder - b.sortOrder))
assert.equal(sceneDrafts.length, orderedEvents.length, 'Every modeled event must receive exactly one source section')
assert(sceneDrafts.every(Boolean), 'No manuscript scene may be empty')
assert.equal(sceneDrafts.join('').replace(/\s/g, ''), chapters.join('').replace(/\s/g, ''), 'Every non-whitespace source character must appear exactly once')

const timestamp = data.world.updatedAt ?? data.exportedAt
data.sceneTexts = orderedEvents.map((event, index) => ({
  id: `jekyll-hyde-scene-${String(index + 1).padStart(3, '0')}`,
  worldId: data.world.id,
  eventId: event.id,
  text: sceneDrafts[index],
  wordCount: sceneDrafts[index].trim().split(/\s+/u).length,
  createdAt: timestamp,
  updatedAt: timestamp,
}))
const sourceLore = data.lorePages.find(page => page.title === 'Map and Image Sources')
if (sourceLore && !sourceLore.body.includes('Project Gutenberg eBook #43')) sourceLore.body = `The manuscript contains the complete public-domain narrative text from Project Gutenberg eBook #43, divided across all ten chapters and forty-seven modeled events; Gutenberg packaging and the contents list are excluded. ${sourceLore.body}`

const text = `${JSON.stringify(data, null, 2)}\n`
fs.writeFileSync(examplePath, text)
fs.writeFileSync(libraryPath, text)
const index = JSON.parse(fs.readFileSync('public/library/index.json', 'utf8'))
const entry = index.entries.find(book => book.id === 'strange-case-of-dr-jekyll-and-mr-hyde')
assert(entry, 'Library index entry is required')
entry.dataBytes = Buffer.byteLength(text)
entry.counts = { characters: data.characters.length, chapters: data.chapters.length, events: data.events.length, locations: data.locationMarkers.length }
entry.notice = 'Unofficial reading-mode edition of a public-domain novel. The manuscript contains the complete narrative text from Project Gutenberg eBook #43; Gutenberg packaging and the contents list are excluded. Structural summaries, event divisions, chronology, maps, and state notes are editorial.'
fs.writeFileSync('public/library/index.json', `${JSON.stringify(index, null, 2)}\n`)
console.log(JSON.stringify({ chapters: data.chapters.length, events: data.events.length, scenes: data.sceneTexts.length, words: data.sceneTexts.reduce((sum, scene) => sum + scene.wordCount, 0), bytes: Buffer.byteLength(text) }, null, 2))
