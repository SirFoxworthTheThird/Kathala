import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildSceneDrafts, sourceChapters } from './full-scene-drafts.mjs'

const examplePath = 'example/Treasure Island.pwk'
const libraryPath = 'public/library/treasure-island.pwk'
const data = JSON.parse(fs.readFileSync(examplePath, 'utf8'))
assert.equal(data.chapters.length, 34)
assert.equal(data.events.length, 71)

const byTitle = title => {
  const event = data.events.find(candidate => candidate.title === title)
  assert(event, `Missing event: ${title}`)
  return event
}
const reorder = (chapterNumber, titles) => {
  const chapter = data.chapters.find(candidate => candidate.number === chapterNumber)
  titles.forEach((title, index) => {
    const event = byTitle(title)
    event.chapterId = chapter.id
    event.sortOrder = index
    event.tags = [`chapter-${chapterNumber}`]
    for (const snapshot of data.characterSnapshots.filter(candidate => candidate.eventId === event.id)) snapshot.sortKey = chapterNumber * 100 + index
    for (const placement of data.itemPlacements.filter(candidate => candidate.eventId === event.id)) placement.sortKey = chapterNumber * 100 + index
  })
}

reorder(7, ['The Hispaniola Is Ready', 'Jim Leaves the Admiral Benbow'])
reorder(33, ['The Treasure Pit Is Empty', 'The Ambush Breaks the Mutiny', 'Ben Gunn’s Secret Is Revealed'])
reorder(34, ['The Treasure Is Loaded', 'The Survivors Sail Home'])
const chapterEvents = data.chapters.map(chapter => data.events.filter(event => event.chapterId === chapter.id).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)))
const { sceneDrafts, anchors } = buildSceneDrafts(chapterEvents)
const orderedEvents = chapterEvents.flat()
assert.equal(sceneDrafts.length, orderedEvents.length)
data.sceneTexts = orderedEvents.map((event, index) => ({ id: `ti-scene-${String(index + 1).padStart(3, '0')}`, worldId: data.world.id, eventId: event.id, text: sceneDrafts[index], wordCount: (sceneDrafts[index].match(/\S+/g) ?? []).length, createdAt: data.world.updatedAt, updatedAt: data.world.updatedAt }))
const sourceLore = data.lorePages?.find(page => /source|artwork|edition/i.test(`${page.title} ${page.body}`))
if (sourceLore) sourceLore.body = 'The manuscript contains the complete narrative text of Project Gutenberg eBook #120, divided across all 34 chapters and modeled events. Gutenberg packaging, the dedication, prefatory poem, contents, part headings, and repeated chapter headings are excluded. Maps and illustrations are documented separately in this page.'
const text = `${JSON.stringify(data, null, 2)}\n`
fs.writeFileSync(examplePath, text); fs.writeFileSync(libraryPath, text)
const index = JSON.parse(fs.readFileSync('public/library/index.json', 'utf8'))
const entry = index.entries.find(candidate => candidate.id === 'treasure-island'); assert(entry, 'Missing Treasure Island library entry')
entry.dataBytes = Buffer.byteLength(text)
entry.notice = 'Unofficial reading-mode reference for a public-domain novel. The manuscript contains the complete narrative text of Project Gutenberg eBook #120 across all 34 chapters; Gutenberg packaging and front matter are excluded. Linked maps and public-domain illustrations are recorded in Lore.'
fs.writeFileSync('public/library/index.json', `${JSON.stringify(index, null, 2)}\n`)
console.log({ chapters: sourceChapters.length, events: data.events.length, scenes: data.sceneTexts.length, words: data.sceneTexts.reduce((sum, scene) => sum + scene.wordCount, 0) })
for (const anchor of anchors) console.log(`${anchor.chapter}: ${anchor.event} <- ${anchor.paragraph}: ${anchor.excerpt}`)
