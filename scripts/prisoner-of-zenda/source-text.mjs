import assert from "node:assert/strict";
import fs from "node:fs";

export const sourceUrl = "https://www.gutenberg.org/ebooks/95";
export const sourceEdition =
  "Project Gutenberg eBook #95 (UTF-8 plain text, updated 21 December 2022; credits: Judith Boss)";

const source = fs
  .readFileSync("scripts/prisoner-of-zenda/source/pg95.txt", "utf8")
  .replaceAll("\r", "");
const start = source.indexOf("CHAPTER 1\n");
const end = source.indexOf(
  "*** END OF THE PROJECT GUTENBERG EBOOK THE PRISONER OF ZENDA ***",
);
assert(start >= 0 && end > start, "Could not isolate the complete narrative");
const narrative = source.slice(start, end).trim();
const headings = [...narrative.matchAll(/^CHAPTER (\d+)$/gm)];
assert.equal(headings.length, 22, "Expected the edition's 22 chapters");

const normalize = (text) =>
  text
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.trim())
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);

export const sourceChapters = headings.map((heading, index) => {
  const block = normalize(
    narrative.slice(
      heading.index + heading[0].length,
      headings[index + 1]?.index ?? narrative.length,
    ),
  );
  const title = block.shift();
  assert(title, `Missing source title for chapter ${index + 1}`);
  return {
    number: index + 1,
    sourceNumber: Number(heading[1]),
    title,
    paragraphs: block,
  };
});

assert(sourceChapters.every((chapter) => chapter.paragraphs.length > 0));
export const narrativeText = sourceChapters
  .flatMap((chapter) => chapter.paragraphs)
  .join("\n\n");
export const narrativeWordCount = (narrativeText.match(/\S+/g) ?? []).length;
