import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildSceneDrafts, sourceChapters } from './full-scene-drafts.mjs'

const examplePath = 'example/The Picture of Dorian Gray.pwk'
const libraryPath = 'public/library/the-picture-of-dorian-gray.pwk'
const data = JSON.parse(fs.readFileSync(examplePath, 'utf8'))
assert.equal(data.chapters.length, 20, 'Expected 20 modeled chapters')
assert.equal(data.events.length, 83, 'Expected 83 modeled events')
const event=number=>data.events.find(candidate=>candidate.id===`dorian-gray-event-${number}`)
// Chapter I opens in Basil's studio; his first sight of Dorian is recalled
// inside the conversation, before Dorian himself arrives.
event(2).sortOrder=0
event(3).sortOrder=1
event(1).sortOrder=2
event(4).sortOrder=3
for(const [number,sortKey] of [[2,1],[3,2],[1,3],[4,4]]){
  for(const snapshot of data.characterSnapshots.filter(candidate=>candidate.eventId===event(number).id))snapshot.sortKey=sortKey
  for(const placement of data.itemPlacements.filter(candidate=>candidate.eventId===event(number).id))placement.sortKey=sortKey
}
// Dorian burns Basil's belongings only after returning from Lady Narborough's
// dinner in Chapter XV.
event(57).chapterId=data.chapters.find(chapter=>chapter.number===15).id
event(57).sortOrder=2
event(57).tags=['chapter-15']
event(60).sortOrder=3
event(61).sortOrder=4
for(const snapshot of data.characterSnapshots.filter(candidate=>candidate.eventId===event(57).id))snapshot.sortKey=59.5
for(const placement of data.itemPlacements.filter(candidate=>candidate.eventId===event(57).id))placement.sortKey=59.5
const chapterEvents = data.chapters.map(chapter => data.events.filter(event => event.chapterId === chapter.id).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)))
const { sceneDrafts, anchors } = buildSceneDrafts(chapterEvents)
const orderedEvents = chapterEvents.flat()
assert.equal(sceneDrafts.length, orderedEvents.length, 'Every event must receive a manuscript scene')
data.sceneTexts = orderedEvents.map((event, index) => ({id:`dorian-gray-scene-${String(index+1).padStart(3,'0')}`,worldId:data.world.id,eventId:event.id,text:sceneDrafts[index],wordCount:(sceneDrafts[index].match(/\S+/g)??[]).length,createdAt:data.world.updatedAt,updatedAt:data.world.updatedAt}))
const sourceLore=data.lorePages?.find(page=>/source|artwork|edition/i.test(`${page.title} ${page.body}`))
if(sourceLore)sourceLore.body='The manuscript contains the complete preface and narrative text of Project Gutenberg eBook #174, divided across the novel’s 20 chapters and modeled events. Gutenberg packaging and the closing title are excluded. Maps and illustrations are documented separately in this page.'
const text=`${JSON.stringify(data,null,2)}\n`;fs.writeFileSync(examplePath,text);fs.writeFileSync(libraryPath,text)
const index=JSON.parse(fs.readFileSync('public/library/index.json','utf8')),entry=index.entries.find(candidate=>candidate.id==='the-picture-of-dorian-gray');assert(entry,'Dorian Gray library entry must exist');entry.dataBytes=Buffer.byteLength(text);entry.notice='Unofficial reading-mode reference for a public-domain novel. The manuscript contains the complete preface and narrative text of Project Gutenberg eBook #174 across all 20 chapters; Gutenberg packaging is excluded. Linked maps and public-domain illustrations are recorded in Lore.';fs.writeFileSync('public/library/index.json',`${JSON.stringify(index,null,2)}\n`)
console.log({chapters:sourceChapters.length,events:data.events.length,scenes:data.sceneTexts.length,words:data.sceneTexts.reduce((sum,scene)=>sum+scene.wordCount,0)})
for(const anchor of anchors)console.log(`${anchor.chapter}: ${anchor.event} <- ${anchor.paragraph}: ${anchor.excerpt}`)
