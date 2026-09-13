import assert from "node:assert/strict";
import fs from "node:fs";

export const sourceUrl = "https://www.gutenberg.org/ebooks/521";
export const sourceEdition =
  "Project Gutenberg eBook #521 (plain text, updated 7 September 2025)";

const source = fs
  .readFileSync("scripts/robinson-crusoe/source/pg521.txt", "utf8")
  .replaceAll("\r", "");
const start = source.indexOf("CHAPTER I. START IN LIFE");
const end = source.indexOf(
  "*** END OF THE PROJECT GUTENBERG EBOOK THE LIFE AND ADVENTURES OF ROBINSON CRUSOE ***",
);
assert(start >= 0 && end > start, "Could not isolate the complete narrative");
const narrative = source.slice(start, end).trim();
const headings = [...narrative.matchAll(/^CHAPTER ([IVXLCDM]+)\. (.+)$/gm)];
assert.equal(headings.length, 20, "Expected the edition's 20 chapters");

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

const titleCase = (title) =>
  title
    .toLowerCase()
    .replace(
      /(^|[\s—-])([a-z])/g,
      (_, lead, letter) => `${lead}${letter.toUpperCase()}`,
    );

export const sourceChapters = headings.map((heading, index) => ({
  number: index + 1,
  sourceNumber: heading[1],
  title: titleCase(heading[2]),
  paragraphs: normalize(
    narrative.slice(
      heading.index + heading[0].length,
      headings[index + 1]?.index ?? narrative.length,
    ),
  ),
}));

assert(sourceChapters.every((chapter) => chapter.paragraphs.length > 0));
export const narrativeText = sourceChapters
  .flatMap((chapter) => chapter.paragraphs)
  .join("\n\n");
export const narrativeWordCount = (narrativeText.match(/\S+/g) ?? []).length;
