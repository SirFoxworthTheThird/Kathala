import assert from "node:assert/strict";
import { sceneDrafts } from "./full-scene-drafts.mjs";
import { narrativeText, sourceChapters } from "./source-text.mjs";

assert.equal(sceneDrafts.length, 55);
assert.equal(
  sceneDrafts.map((scene) => scene.text).join("\n\n"),
  narrativeText,
);
assert.deepEqual(
  [...new Set(sceneDrafts.map((scene) => scene.chapterNumber))],
  sourceChapters.map((chapter) => chapter.number),
);
console.log({
  chapters: sourceChapters.length,
  scenes: sceneDrafts.length,
  words: (narrativeText.match(/\S+/g) ?? []).length,
  lossless: true,
});
