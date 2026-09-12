import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildSceneDrafts, sourceSections } from './full-scene-drafts.mjs'

const examplePath = 'example/Frankenstein.pwk'
const libraryPath = 'public/library/frankenstein.pwk'
const data = JSON.parse(fs.readFileSync(examplePath, 'utf8'))
assert.equal(data.chapters.length, 28, 'Expected four letters and 24 modeled chapters')
assert.equal(data.events.length, 88, 'Expected 88 modeled events')

const sectionEvents = data.chapters.map(chapter => data.events
  .filter(event => event.chapterId === chapter.id)
  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)))
const { sceneDrafts, anchors } = buildSceneDrafts(sectionEvents)
const orderedEvents = sectionEvents.flat()
assert.equal(sceneDrafts.length, orderedEvents.length, 'Every event must receive a manuscript scene')

data.sceneTexts = orderedEvents.map((event, index) => ({
  id: `frankenstein-scene-${String(index + 1).padStart(3, '0')}`,
  worldId: data.world.id,
  eventId: event.id,
  text: sceneDrafts[index],
  wordCount: (sceneDrafts[index].match(/\S+/g) ?? []).length,
  createdAt: data.world.updatedAt,
  updatedAt: data.world.updatedAt,
}))

const sourceLore = data.lorePages?.find(page => /source|artwork|edition/i.test(`${page.title} ${page.body}`))
if (sourceLore) sourceLore.body = 'The manuscript contains the complete narrative text of Project Gutenberg eBook #84, using the common four-letter and 24-chapter text represented by this world. Gutenberg packaging and the closing title are excluded. Maps and illustrations are documented separately in this page.'

const text = `${JSON.stringify(data, null, 2)}\n`
fs.writeFileSync(examplePath, text)
fs.writeFileSync(libraryPath, text)
const index = JSON.parse(fs.readFileSync('public/library/index.json', 'utf8'))
const entry = index.entries.find(candidate => candidate.id === 'frankenstein')
assert(entry, 'Frankenstein library entry must exist')
entry.dataBytes = Buffer.byteLength(text)
entry.notice = 'Unofficial reading-mode reference for a public-domain novel. The manuscript contains the complete narrative text of Project Gutenberg eBook #84 across four letters and 24 chapters; Gutenberg packaging is excluded. Linked maps and public-domain illustrations are recorded in Lore.'
fs.writeFileSync('public/library/index.json', `${JSON.stringify(index, null, 2)}\n`)

console.log({sections: sourceSections.length, events: data.events.length, scenes: data.sceneTexts.length, words: data.sceneTexts.reduce((sum, scene) => sum + scene.wordCount, 0)})
for (const anchor of anchors) console.log(`${anchor.section}: ${anchor.event} <- ${anchor.paragraph}: ${anchor.excerpt}`)
