import assert from "node:assert/strict";
import {
  narrativeWordCount,
  sourceChapters,
  sourceEdition,
  sourceUrl,
} from "./source-text.mjs";

assert.equal(sourceChapters.length, 34);
assert.equal(narrativeWordCount, 115_872, "Narrative word count changed");
assert.equal(
  sourceChapters.reduce(
    (total, chapter) => total + chapter.paragraphs.length,
    0,
  ),
  1_942,
  "Narrative paragraph count changed",
);
assert(sourceChapters.every((chapter) => chapter.paragraphs.length > 0));

console.log({
  sourceEdition,
  sourceUrl,
  chapters: sourceChapters.length,
  paragraphs: sourceChapters.reduce(
    (total, chapter) => total + chapter.paragraphs.length,
    0,
  ),
  words: narrativeWordCount,
});
for (const chapter of sourceChapters) {
  console.log(
    `${chapter.number}. ${chapter.title} — ${chapter.paragraphs.length} paragraphs`,
  );
}
