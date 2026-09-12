import assert from 'node:assert/strict'
import fs from 'node:fs'
import{buildSceneDrafts,sourceChapters}from'./full-scene-drafts.mjs'
const examplePath='example/The Hound of the Baskervilles.pwk',libraryPath='public/library/the-hound-of-the-baskervilles.pwk',data=JSON.parse(fs.readFileSync(examplePath,'utf8'))
assert.equal(data.chapters.length,15);assert.equal(data.events.length,66)
const byTitle=title=>{const found=data.events.find(event=>event.title===title);assert(found,`Missing event: ${title}`);return found}
const reorder=(chapterNumber,titles)=>{const chapter=data.chapters.find(candidate=>candidate.number===chapterNumber);titles.forEach((title,index)=>{const event=byTitle(title);event.chapterId=chapter.id;event.sortOrder=index;event.tags=[`chapter-${chapterNumber}`];for(const snapshot of data.characterSnapshots.filter(candidate=>candidate.eventId===event.id))snapshot.sortKey=chapterNumber*100+index;for(const placement of data.itemPlacements.filter(candidate=>candidate.eventId===event.id))placement.sortKey=chapterNumber*100+index})}
reorder(2,['The Legend of Hugo Baskerville','The Official Account','Sir Charles Waits at the Gate','Sir Charles Dies'])
reorder(4,['Sir Henry Arrives','The Cut-Paper Warning','The Missing Brown Boot','The Bearded Watcher'])
reorder(5,['The Hotel Register','The Boots Are Exchanged','The Barrymore Test','Cartwright Searches the Hotels','John Clayton’s Fare','Watson Receives His Charge'])
reorder(13,['Holmes Studies Hugo’s Portrait','The Net Is Set','Lestrade Arrives'])
reorder(14,['Sir Henry Goes to Merripit','Watching Merripit House','Fog Covers the Path','The Hound Attacks','Beryl Is Rescued','The Mire Is Searched'])
reorder(15,['Roger Baskerville’s Identity','The Hound Was Made Supernatural','The Complete Design','The Women Were Manipulated','The Case Closes'])
const chapterEvents=data.chapters.map(chapter=>data.events.filter(event=>event.chapterId===chapter.id).sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0))),{sceneDrafts,anchors}=buildSceneDrafts(chapterEvents),orderedEvents=chapterEvents.flat();assert.equal(sceneDrafts.length,orderedEvents.length)
data.sceneTexts=orderedEvents.map((event,index)=>({id:`hound-scene-${String(index+1).padStart(3,'0')}`,worldId:data.world.id,eventId:event.id,text:sceneDrafts[index],wordCount:(sceneDrafts[index].match(/\S+/g)??[]).length,createdAt:data.world.updatedAt,updatedAt:data.world.updatedAt}))
const sourceLore=data.lorePages?.find(page=>/source|artwork|edition/i.test(`${page.title} ${page.body}`));if(sourceLore)sourceLore.body='The manuscript contains the complete narrative text of Project Gutenberg eBook #2852, divided across all 15 chapters and modeled events. Gutenberg packaging, repeated chapter headings, and the closing title are excluded. Maps and illustrations are documented separately in this page.'
const text=`${JSON.stringify(data,null,2)}\n`;fs.writeFileSync(examplePath,text);fs.writeFileSync(libraryPath,text)
const index=JSON.parse(fs.readFileSync('public/library/index.json','utf8')),entry=index.entries.find(candidate=>candidate.id==='the-hound-of-the-baskervilles');assert(entry);entry.dataBytes=Buffer.byteLength(text);entry.notice='Unofficial reading-mode reference for a public-domain novel. The manuscript contains the complete narrative text of Project Gutenberg eBook #2852 across all 15 chapters; Gutenberg packaging is excluded. Linked maps and public-domain illustrations are recorded in Lore.';fs.writeFileSync('public/library/index.json',`${JSON.stringify(index,null,2)}\n`)
console.log({chapters:sourceChapters.length,events:data.events.length,scenes:data.sceneTexts.length,words:data.sceneTexts.reduce((n,s)=>n+s.wordCount,0)});for(const a of anchors)console.log(`${a.chapter}: ${a.event} <- ${a.paragraph}: ${a.excerpt}`)
