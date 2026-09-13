import assert from "node:assert/strict";
import { chapterDrafts } from "./full-scene-drafts.mjs";
import { titledDrafts } from "./scene-titles.mjs";
import {
  narrativeText,
  narrativeWordCount,
  sourceChapters,
} from "./source-text.mjs";

assert.equal(sourceChapters.length, 34);
assert.equal(chapterDrafts.length, 63);
assert.equal(titledDrafts.length, chapterDrafts.length);
assert.equal(
  chapterDrafts.map((draft) => draft.text).join("\n\n"),
  narrativeText,
);
assert.equal(
  (chapterDrafts.flatMap((draft) => draft.text.match(/\S+/g) ?? []).length),
  narrativeWordCount,
);
assert.deepEqual(
  [...new Set(chapterDrafts.map((draft) => draft.chapterNumber))],
  sourceChapters.map((chapter) => chapter.number),
);

console.log({
  chapters: sourceChapters.length,
  provisionalScenes: chapterDrafts.length,
  words: narrativeWordCount,
  lossless: true,
});
