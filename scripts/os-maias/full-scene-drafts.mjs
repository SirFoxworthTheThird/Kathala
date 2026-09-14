import { sourceChapters } from "./source-text.mjs";
import { chapterPlans } from "./story-ledger.mjs";

function divide(text, count) {
  const cuts=[]; let floor=0;
  for(let part=1;part<count;part++){
    const target=Math.floor(text.length*part/count);let cut=text.indexOf("\n\n",Math.max(floor,target));
    if(cut<0)cut=text.lastIndexOf("\n\n",target);if(cut<=floor)throw new Error("Sem fronteira de parágrafo suficiente");cuts.push(cut);floor=cut+2;
  }
  const chunks=[];let from=0;for(const cut of cuts){chunks.push(text.slice(from,cut));from=cut+2;}chunks.push(text.slice(from));return chunks;
}

export const sceneDrafts = sourceChapters.flatMap((chapter, i) => {
  const plan = chapterPlans[i];
  const chunks = divide(chapter.text, plan.events.length);
  return chunks.map((text, j) => ({ chapterNumber: chapter.number, eventIndex: j, text }));
});
