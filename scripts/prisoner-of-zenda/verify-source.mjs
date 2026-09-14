import assert from "node:assert/strict";
import {
  narrativeWordCount,
  sourceChapters,
  sourceEdition,
  sourceUrl,
} from "./source-text.mjs";

assert.equal(sourceChapters.length, 22);
assert.equal(narrativeWordCount, 53_408, "Narrative word count changed");
assert.equal(
  sourceChapters.reduce(
    (total, chapter) => total + chapter.paragraphs.length,
    0,
  ),
  1_695,
  "Narrative paragraph count changed",
);
assert(sourceChapters.every((chapter) => chapter.paragraphs.length > 0));
assert.deepEqual(
  sourceChapters.map((chapter) => chapter.sourceNumber),
  Array.from({ length: 22 }, (_, index) => index + 1),
);

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
