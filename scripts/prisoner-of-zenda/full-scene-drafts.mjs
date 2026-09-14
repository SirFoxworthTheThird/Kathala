import assert from "node:assert/strict";
import { narrativeText, sourceChapters } from "./source-text.mjs";

// Source-audited transitions: each cut marks a change in place, participating
// cast, actionable knowledge, or immediate dramatic objective.
export const cutsByChapter = new Map([
  [1, [35]],
  [2, [29]],
  [3, [58]],
  [4, [35, 70]],
  [5, [28]],
  [6, [35, 70]],
  [7, [34]],
  [8, [60]],
  [9, [44, 87]],
  [10, [45]],
  [11, [50]],
  [12, [31, 61]],
  [13, [38]],
  [14, [17, 29]],
  [15, [50]],
  [16, [33, 63]],
  [17, [34]],
  [18, [14, 26]],
  [19, [12, 28]],
  [20, [13, 25]],
  [21, [35]],
  [22, [30, 49, 51]],
]);

export function buildSceneDrafts() {
  const drafts = [];
  for (const chapter of sourceChapters) {
    const cuts = cutsByChapter.get(chapter.number) ?? [];
    assert(
      cuts.every(
        (cut, index) =>
          Number.isInteger(cut) &&
          cut > (cuts[index - 1] ?? 0) &&
          cut < chapter.paragraphs.length,
      ),
      `Invalid scene cuts in chapter ${chapter.number}`,
    );
    const points = [0, ...cuts, chapter.paragraphs.length];
    points.slice(0, -1).forEach((start, sceneIndex) => {
      drafts.push({
        chapterNumber: chapter.number,
        sceneIndex,
        text: chapter.paragraphs
          .slice(start, points[sceneIndex + 1])
          .join("\n\n"),
      });
    });
  }
  assert.equal(
    drafts.map((draft) => draft.text).join("\n\n"),
    narrativeText,
    "Scene drafts do not reconstruct the complete narrative",
  );
  return drafts;
}

export const sceneDrafts = buildSceneDrafts();
