import assert from 'node:assert/strict'
import fs from 'node:fs'

const source=fs.readFileSync('scripts/jane-eyre/source/pg1260.txt','utf8').replaceAll('\r','')
const startMarker=source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK 1260 \*\*\*/)?.[0],endMarker=source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK 1260 \*\*\*/)?.[0]
assert(startMarker&&endMarker)
const body=source.slice(source.indexOf('CHAPTER I',source.indexOf(startMarker)),source.indexOf(endMarker)).trim()
const headings=[...body.matchAll(/^CHAPTER [IVXLCDM]+(?:—CONCLUSION)?$/gm)];assert.equal(headings.length,38)
const normalize=text=>text.trim().split(/\n\s*\n/).map(p=>p.split('\n').map(x=>x.trim()).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean)
export const sourceChapters=headings.map((h,i)=>normalize(body.slice(h.index+h[0].length,headings[i+1]?.index??body.length)))
const stop=new Set('the and that with from into this then they their there where when while before after jane rochester chapter becomes become begins finds found toward walks leaves returns accepts makes gives tells reaches enters looks sees hears said says'.split(' '))
const terms=text=>[...new Set((text.toLowerCase().match(/[a-zà-ÿ’]+/g)??[]).filter(word=>word.length>3&&!stop.has(word)))]
const manualBoundaries=new Map([
  [1,[37]],[2,[43]],[3,[76]],[4,[80]],[5,[44]],[6,[62]],[7,[55]],[8,[58]],[9,[26]],[10,[19]],
  [11,[111]],[12,[12,17]],[13,[91]],[14,[56]],[15,[33]],[16,[70]],[17,[83]],[18,[89]],[19,[108]],
  [20,[56]],[21,[183]],[22,[33]],[23,[87]],[24,[20]],[25,[56]],[26,[42]],[27,[150]],[28,[1,12]],
  [29,[85]],[30,[12]],[31,[5]],[32,[13]],[33,[62]],[34,[23]],[35,[90]],[36,[50]],[37,[30]],[38,[20]],
])

export function buildSceneDrafts(chapterEvents){
  assert.equal(chapterEvents.length,38);const anchors=[]
  const drafts=sourceChapters.flatMap((paragraphs,ci)=>{
    const events=chapterEvents[ci];assert(events.length>=2&&events.length<=3)
    const manual=manualBoundaries.get(ci+1);assert.equal(manual?.length,events.length-1,`Manual boundary count mismatch in Chapter ${ci+1}`)
    const cuts=[]
    for(let eventIndex=1;eventIndex<events.length;eventIndex++){
      const wanted=terms(`${events[eventIndex].title} ${events[eventIndex].description}`)
      const minimum=(cuts.at(-1)??0)+3, maximum=paragraphs.length-(events.length-eventIndex)*3
      let best={index:minimum,score:-Infinity}
      for(let index=minimum;index<=maximum;index++){
        const window=paragraphs.slice(index,index+3).join(' ').toLowerCase()
        const hits=wanted.reduce((sum,word)=>sum+(window.includes(word)?1:0),0)
        const expected=paragraphs.length*eventIndex/events.length
        const score=hits*10-Math.abs(index-expected)/Math.max(5,paragraphs.length/8)
        if(score>best.score)best={index,score}
      }
      const index=manual[eventIndex-1]
      assert(index>0&&index<paragraphs.length,`Invalid boundary ${index} in Chapter ${ci+1} with ${paragraphs.length} paragraphs`)
      cuts.push(index);anchors.push({chapter:ci+1,event:events[eventIndex].title,paragraph:index,excerpt:paragraphs[index].slice(0,140),score:best.score})
    }
    const points=[0,...cuts,paragraphs.length]
    return points.slice(0,-1).map((start,index)=>paragraphs.slice(start,points[index+1]).join('\n\n'))
  })
  assert(drafts.every(Boolean));assert.equal(drafts.join('\n\n'),sourceChapters.flat().join('\n\n'))
  return{sceneDrafts:drafts,anchors}
}
