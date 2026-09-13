import assert from "node:assert/strict";
import { narrativeText, sourceChapters } from "./source-text.mjs";

/**
 * Manuscript-first foundation.
 *
 * Cuts are paragraph indexes within their source chapter. Each final event will
 * own exactly one consecutive slice. Keeping all cuts here makes omissions,
 * overlaps, and accidental reordering mechanically detectable.
 *
 * The arrays intentionally begin empty. They are filled only after the event
 * ledger for that chapter has been checked against the prose; an empty array
 * means the complete chapter is presently one lossless draft, not that the
 * final model needs only one event.
 */
export const cutsByChapter = new Map([
  [1, [3, 10, 14, 22]],
  [2, [6, 15, 20, 30]],
  [3, [6, 12, 24, 34, 38]],
  [4, [3, 12, 28, 40, 49, 72]],
  [5, [17, 41, 51]],
  [6, [17, 32, 37]],
  [7, [5, 12, 20]],
  [8, [9, 18, 26]],
  [9, [8, 15, 27, 39]],
  [10, [9, 19, 27]],
  [11, [8, 16, 25, 30]],
  [12, [5, 9, 15, 18]],
  [13, [9, 13]],
  [14, [5, 11, 13, 16, 20]],
  [15, [5, 24, 32, 38]],
  [16, [7, 12, 19, 27]],
  [17, [8, 10, 16, 22]],
  [18, [5, 9, 14, 21, 23]],
  [19, [3, 13, 20, 28, 35]],
  [20, [5, 10, 15, 20]],
]);

export function buildSceneDrafts() {
  const drafts = [];
  const coverage = [];
  for (const chapter of sourceChapters) {
    const cuts = cutsByChapter.get(chapter.number) ?? [];
    assert(
      cuts.every(
        (cut, index) =>
          Number.isInteger(cut) &&
          cut > (cuts[index - 1] ?? 0) &&
          cut < chapter.paragraphs.length,
      ),
    );
    const points = [0, ...cuts, chapter.paragraphs.length];
    const chapterDrafts = points
      .slice(0, -1)
      .map((start, index) =>
        chapter.paragraphs.slice(start, points[index + 1]).join("\n\n"),
      );
    assert(chapterDrafts.every(Boolean));
    assert.equal(chapterDrafts.join("\n\n"), chapter.paragraphs.join("\n\n"));
    chapterDrafts.forEach((text, sceneIndex) => {
      drafts.push({ chapterNumber: chapter.number, sceneIndex, text });
      coverage.push(text);
    });
  }
  assert.equal(coverage.join("\n\n"), narrativeText);
  return drafts;
}

export const chapterDrafts = buildSceneDrafts();
assert.equal(chapterDrafts.length, 99);
