import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildSceneDrafts, sourceChapterParagraphs } from './full-scene-drafts.mjs'

const examplePath = 'example/Dracula.pwk'
const libraryPath = 'public/library/dracula.pwk'
const data = JSON.parse(fs.readFileSync(examplePath, 'utf8'))
assert.equal(data.chapters.length, 27, 'Expected 27 modeled chapters')
assert.equal(data.events.length, 84, 'Expected 84 modeled events')

const event = number => data.events.find(candidate => candidate.id === `dracula-event-${number}`)
// Chapter VII presents the Demeter's arrival before reproducing its log.
event(21).sortOrder = 0
event(19).sortOrder = 1
event(20).sortOrder = 2
event(22).sortOrder = 3

// Chapter XVIII opens with Mina meeting Renfield; the prior event described
// an escape from an earlier chapter and duplicated the later Carfax crisis.
Object.assign(event(54), {
  title: 'Mina Meets Renfield',
  description: 'Mina visits Renfield with Seward and is struck by his courtly lucidity and unusual respect for her.',
  locationMarkerId: 'dracula-loc-renfield-cell',
  involvedCharacterIds: ['dracula-char-mina', 'dracula-char-renfield', 'dracula-char-seward'],
  povCharacterId: 'dracula-char-seward',
  sortOrder: 0,
})
event(53).sortOrder = 1
event(55).sortOrder = 2
const event54Snapshots = data.characterSnapshots.filter(snapshot => snapshot.eventId === event(54).id)
for (const snapshot of event54Snapshots) {
  snapshot.currentLocationMarkerId = 'dracula-loc-renfield-cell'
  snapshot.currentMapLayerId = 'dracula-map-asylum'
  if (snapshot.characterId === 'dracula-char-renfield') snapshot.statusNotes = 'Receives Mina with composed courtesy and speaks more rationally than Seward expects.'
  if (snapshot.characterId === 'dracula-char-seward') snapshot.statusNotes = 'Observes Renfield’s transformed manner and Mina’s ease with him.'
}
const nurseSnapshot = event54Snapshots.find(snapshot => snapshot.characterId === 'dracula-char-nurse')
if (nurseSnapshot) {
  nurseSnapshot.characterId = 'dracula-char-mina'
  nurseSnapshot.statusNotes = 'Meets Renfield without fear and treats him as a person rather than a spectacle.'
}

const chapterEvents = data.chapters.map(chapter => data.events
  .filter(event => event.chapterId === chapter.id)
  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)))
const { sceneDrafts, anchors } = buildSceneDrafts(chapterEvents)
const orderedEvents = chapterEvents.flat()
assert.equal(sceneDrafts.length, orderedEvents.length, 'Every event must receive a manuscript scene')

data.sceneTexts = orderedEvents.map((event, index) => ({
  id: `dracula-scene-${String(index + 1).padStart(3, '0')}`,
  worldId: data.world.id,
  eventId: event.id,
  text: sceneDrafts[index],
  wordCount: (sceneDrafts[index].match(/\S+/g) ?? []).length,
  createdAt: data.world.updatedAt,
  updatedAt: data.world.updatedAt,
}))

const sourceLore = data.lorePages?.find(page => /source|artwork|edition/i.test(`${page.title} ${page.body}`))
if (sourceLore) sourceLore.body = 'The manuscript contains the complete narrative text of Project Gutenberg eBook #345, divided across Bram Stoker’s 27 original chapters and the modeled documentary events. Gutenberg packaging, advertisements, and the closing title are excluded. Maps and illustrations are documented separately in this page.'

const text = `${JSON.stringify(data, null, 2)}\n`
fs.writeFileSync(examplePath, text)
fs.writeFileSync(libraryPath, text)

const index = JSON.parse(fs.readFileSync('public/library/index.json', 'utf8'))
const entry = index.entries.find(candidate => candidate.id === 'dracula')
assert(entry, 'Dracula library entry must exist')
entry.dataBytes = Buffer.byteLength(text)
entry.notice = 'Unofficial reading-mode reference for a public-domain novel. The manuscript contains the complete narrative text of Project Gutenberg eBook #345, divided among the original 27 chapters and modeled events; Gutenberg packaging and advertisements are excluded. Linked maps and public-domain illustrations are recorded in Lore.'
fs.writeFileSync('public/library/index.json', `${JSON.stringify(index, null, 2)}\n`)

const words = data.sceneTexts.reduce((sum, scene) => sum + scene.wordCount, 0)
assert.equal(sourceChapterParagraphs.length, data.chapters.length)
console.log({ chapters: data.chapters.length, events: data.events.length, scenes: data.sceneTexts.length, words })
for (const anchor of anchors) console.log(`${anchor.chapter}: ${anchor.event} <- ${anchor.paragraph}: ${anchor.excerpt}`)
