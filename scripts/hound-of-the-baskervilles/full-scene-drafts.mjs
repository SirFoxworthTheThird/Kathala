import assert from 'node:assert/strict'
import fs from 'node:fs'

const source=fs.readFileSync('scripts/hound-of-the-baskervilles/source/pg2852.txt','utf8').replaceAll('\r','')
const startMarker=source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE HOUND OF THE BASKERVILLES \*\*\*/)?.[0]
const endMarker=source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE HOUND OF THE BASKERVILLES \*\*\*/)?.[0]
assert(startMarker&&endMarker,'Hound source must contain Gutenberg boundaries')
const start=source.indexOf('Chapter 1.\n',source.indexOf(startMarker)+startMarker.length),end=source.lastIndexOf('THE END',source.indexOf(endMarker))
const body=source.slice(start,end),headings=[...body.matchAll(/^Chapter (?:[1-9]|1[0-5])\.\s*$/gm)]
assert.equal(headings.length,15,'The source must contain Chapters 1-15')
const chapters=headings.map((heading,index)=>body.slice(heading.index+heading[0].length,headings[index+1]?.index??body.length).trim().split(/\n\s*\n/).map(p=>p.split('\n').map(line=>line.trim()).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean).slice(1))
const stopWords=new Set('a an and are as at be been but by for from had has have he her his i in into is it its of on or our she that the their them they this to was we were with you'.split(' '))
const words=value=>new Set((value.toLowerCase().match(/[a-z]{3,}/g)??[]).filter(word=>!stopWords.has(word)))
export function buildSceneDrafts(chapterEvents){
 assert.equal(chapterEvents.length,chapters.length,'Modeled and source chapter counts must match');const anchors=[]
 const manualBoundaries=new Map([[1,[12,39]],[2,[27,31,41]],[3,[44,67,90]],[4,[8,58,91]],[5,[14,31,94,101,137]],[6,[28,39,68]],[7,[34,57,88,117]],[8,[8,12,23]],[9,[22,44,68,86,128]],[10,[24,48,71]],[11,[70,88,99]],[12,[60,90,106]],[13,[44,84]],[14,[8,24,38,54,76]],[15,[4,7,12,22]]])
 const sceneDrafts=chapters.flatMap((paragraphs,chapterIndex)=>{const events=chapterEvents[chapterIndex];assert(events.length>0,`Chapter ${chapterIndex+1} must have an event`);const manual=manualBoundaries.get(chapterIndex+1);if(manual){assert.equal(manual.length,events.length-1,`Boundary count mismatch in Chapter ${chapterIndex+1}`);const points=[0,...manual,paragraphs.length];manual.forEach((paragraph,eventIndex)=>anchors.push({chapter:chapterIndex+1,event:events[eventIndex+1].title,paragraph,excerpt:paragraphs[paragraph].slice(0,100)}));return points.slice(0,-1).map((start,part)=>paragraphs.slice(start,points[part+1]).join('\n\n'))}const points=[0]
  for(let eventIndex=1;eventIndex<events.length;eventIndex+=1){const remaining=events.length-eventIndex,expected=Math.round(paragraphs.length*eventIndex/events.length),segment=paragraphs.length/events.length,earliest=Math.max(points.at(-1)+1,Math.floor(expected-segment*.45)),latest=Math.min(paragraphs.length-remaining,Math.ceil(expected+segment*.45)),titleTerms=words(events[eventIndex].title),descriptionTerms=words(events[eventIndex].description??'');let best=earliest,bestScore=-Infinity
   for(let paragraphIndex=earliest;paragraphIndex<=latest;paragraphIndex+=1){const paragraphWords=words(paragraphs[paragraphIndex]);let score=-Math.abs(paragraphIndex-expected)*.08;for(const term of titleTerms)if(paragraphWords.has(term))score+=term.length>=7?36:24;for(const term of descriptionTerms)if(paragraphWords.has(term))score+=term.length>=7?8:5;if(score>bestScore){best=paragraphIndex;bestScore=score}}
   points.push(best);anchors.push({chapter:chapterIndex+1,event:events[eventIndex].title,paragraph:best,excerpt:paragraphs[best].slice(0,100)})}
  points.push(paragraphs.length);return points.slice(0,-1).map((start,part)=>paragraphs.slice(start,points[part+1]).join('\n\n'))})
 assert(sceneDrafts.every(Boolean),'No event may receive an empty scene');assert.equal(sceneDrafts.join('\n\n'),chapters.flat().join('\n\n'),'Scenes must reproduce all narrative paragraphs once in source order');return{sceneDrafts,anchors}}
export const sourceChapters=chapters
