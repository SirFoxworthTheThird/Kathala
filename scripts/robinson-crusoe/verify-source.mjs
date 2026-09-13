import assert from "node:assert/strict";
import {
  narrativeWordCount,
  sourceChapters,
  sourceEdition,
  sourceUrl,
} from "./source-text.mjs";

assert.equal(sourceChapters.length, 20);
assert.equal(new Set(sourceChapters.map((chapter) => chapter.title)).size, 20);
const paragraphs = sourceChapters.reduce(
  (total, chapter) => total + chapter.paragraphs.length,
  0,
);
assert.equal(paragraphs, 727);
assert.equal(narrativeWordCount, 120_687);
console.log({
  sourceEdition,
  sourceUrl,
  chapters: sourceChapters.length,
  paragraphs,
  words: narrativeWordCount,
});
for (const chapter of sourceChapters)
  console.log(
    `${chapter.number}. ${chapter.title} — ${chapter.paragraphs.length} paragraphs`,
  );
