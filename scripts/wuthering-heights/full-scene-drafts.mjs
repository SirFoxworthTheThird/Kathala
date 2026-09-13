import assert from "node:assert/strict";
import { narrativeText, sourceChapters } from "./source-text.mjs";

/**
 * Paragraph indexes at which each chapter is divided into event-sized scenes.
 * An empty cut list deliberately preserves the complete chapter as one draft
 * while its event ledger is still being audited against the prose.
 */
export const cutsByChapter = new Map([
  [1, [6, 11, 15, 18, 25]],
  [2, [8, 27, 37, 54, 74, 84, 87]],
  [3, [3, 18, 25, 38, 43, 55, 57, 62, 64]],
  [4, [7, 29, 33, 38, 41]],
  [5, [1, 3, 5]],
  ...sourceChapters.slice(5).map((chapter) => [chapter.number, []]),
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
      `Invalid scene cuts in chapter ${chapter.number}`,
    );
    const points = [0, ...cuts, chapter.paragraphs.length];
    const chapterDrafts = points
      .slice(0, -1)
      .map((start, index) =>
        chapter.paragraphs.slice(start, points[index + 1]).join("\n\n"),
      );
    assert(chapterDrafts.every(Boolean));
    assert.equal(
      chapterDrafts.join("\n\n"),
      chapter.paragraphs.join("\n\n"),
      `Scene drafts do not reconstruct chapter ${chapter.number}`,
    );
    chapterDrafts.forEach((text, sceneIndex) => {
      drafts.push({ chapterNumber: chapter.number, sceneIndex, text });
      coverage.push(text);
    });
  }
  assert.equal(
    coverage.join("\n\n"),
    narrativeText,
    "Scene drafts do not reconstruct the complete narrative",
  );
  return drafts;
}

export const chapterDrafts = buildSceneDrafts();
