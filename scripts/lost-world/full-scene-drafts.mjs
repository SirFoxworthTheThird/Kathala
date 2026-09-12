import assert from "node:assert/strict";
import fs from "node:fs";
const source = fs
    .readFileSync("scripts/lost-world/source/pg139.txt", "utf8")
    .replaceAll("\r", ""),
  start = source.indexOf(
    "The Lost World\n\n                            CHAPTER I",
  ),
  end = source.indexOf("*** END OF THE PROJECT GUTENBERG EBOOK 139 ***");
assert(start > 0 && end > start);
const body = source.slice(start, end),
  headings = [...body.matchAll(/^\s+CHAPTER [IVXLCDM]+$/gm)];
assert.equal(headings.length, 16);
const normalize = (text) =>
  text
    .trim()
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split("\n")
        .map((x) => x.trim())
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
export const sourceChapters = headings.map((heading, index) =>
  normalize(
    body.slice(
      heading.index + heading[0].length,
      headings[index + 1]?.index ?? body.length,
    ),
  ).slice(1),
);
const stop = new Set(
    "the and that with from into this then they their there where when while before after".split(
      " ",
    ),
  ),
  terms = (text) => [
    ...new Set(
      (text.toLowerCase().match(/[a-z’]+/g) ?? []).filter(
        (word) => word.length > 3 && !stop.has(word),
      ),
    ),
  ];
const manual = new Map([
  [7, [9, 29]],
  [8, [22]],
  [9, [97, 121]],
  [10, [24, 46]],
  [11, [40]],
  [12, [26]],
  [13, [45]],
  [14, [40]],
  [15, [29]],
  [16, [30, 45, 69]],
]);
export function buildSceneDrafts(groups) {
  assert.equal(groups.length, 16);
  const anchors = [];
  const drafts = sourceChapters.flatMap((paragraphs, chapterIndex) => {
    const events = groups[chapterIndex],
      cuts = [];
    for (let eventIndex = 1; eventIndex < events.length; eventIndex++) {
      const wanted = terms(
          `${events[eventIndex].title} ${events[eventIndex].description}`,
        ),
        minimum = (cuts.at(-1) ?? 0) + 2,
        maximum = paragraphs.length - (events.length - eventIndex) * 2;
      let best = { index: minimum, score: -Infinity };
      for (let index = minimum; index <= maximum; index++) {
        const window = paragraphs
            .slice(index, index + 3)
            .join(" ")
            .toLowerCase(),
          score =
            wanted.reduce(
              (sum, word) => sum + (window.includes(word) ? 10 : 0),
              0,
            ) -
            Math.abs(index - (paragraphs.length * eventIndex) / events.length) /
              Math.max(5, paragraphs.length / 8);
        if (score > best.score) best = { index, score };
      }
      const cut = manual.get(chapterIndex + 1)?.[eventIndex - 1] ?? best.index;
      cuts.push(cut);
      anchors.push({
        chapter: chapterIndex + 1,
        event: events[eventIndex].title,
        paragraph: cut,
        excerpt: paragraphs[cut].slice(0, 140),
      });
    }
    const points = [0, ...cuts, paragraphs.length];
    return points
      .slice(0, -1)
      .map((point, index) =>
        paragraphs.slice(point, points[index + 1]).join("\n\n"),
      );
  });
  assert(drafts.every(Boolean));
  assert.equal(drafts.join("\n\n"), sourceChapters.flat().join("\n\n"));
  return { sceneDrafts: drafts, anchors };
}
