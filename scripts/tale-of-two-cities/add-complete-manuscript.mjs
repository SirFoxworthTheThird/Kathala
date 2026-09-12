import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildSceneDrafts, sourceChapters } from './full-scene-drafts.mjs'
const examplePath='example/A Tale of Two Cities.pwk', libraryPath='public/library/a-tale-of-two-cities.pwk'
const data=JSON.parse(fs.readFileSync(examplePath,'utf8')); assert.equal(data.chapters.length,45); assert.equal(data.events.length,58)
const chapterEvents=data.chapters.map(chapter=>data.events.filter(event=>event.chapterId===chapter.id).sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0)))
const {sceneDrafts,anchors}=buildSceneDrafts(chapterEvents), orderedEvents=chapterEvents.flat()
data.sceneTexts=orderedEvents.map((event,index)=>({id:`tale-two-cities-scene-${String(index+1).padStart(3,'0')}`,worldId:data.world.id,eventId:event.id,text:sceneDrafts[index],wordCount:(sceneDrafts[index].match(/\S+/g)??[]).length,createdAt:data.world.updatedAt,updatedAt:data.world.updatedAt}))
const sourceLore=data.lorePages?.find(page=>/source|artwork|edition/i.test(`${page.title} ${page.body}`)); if(sourceLore)sourceLore.body='The manuscript contains the complete narrative text of Project Gutenberg eBook #98, divided across all 45 chapters and modeled events. Gutenberg packaging, contents, book headings, and front matter are excluded. Maps and illustrations are documented separately in this page.'
const text=`${JSON.stringify(data,null,2)}\n`; fs.writeFileSync(examplePath,text); fs.writeFileSync(libraryPath,text)
const index=JSON.parse(fs.readFileSync('public/library/index.json','utf8')),entry=index.entries.find(candidate=>candidate.id==='a-tale-of-two-cities');assert(entry);entry.dataBytes=Buffer.byteLength(text);entry.notice='Unofficial reading-mode reference for a public-domain novel. The manuscript contains the complete narrative text of Project Gutenberg eBook #98 across all 45 chapters; Gutenberg packaging and front matter are excluded. Linked maps and public-domain illustrations are recorded in Lore.';fs.writeFileSync('public/library/index.json',`${JSON.stringify(index,null,2)}\n`)
console.log({chapters:sourceChapters.length,events:data.events.length,scenes:data.sceneTexts.length,words:data.sceneTexts.reduce((sum,scene)=>sum+scene.wordCount,0)});for(const anchor of anchors)console.log(`${anchor.chapter}: ${anchor.event} <- ${anchor.paragraph}: ${anchor.excerpt}`)
