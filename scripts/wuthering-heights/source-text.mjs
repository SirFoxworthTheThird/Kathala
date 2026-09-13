import assert from "node:assert/strict";
import fs from "node:fs";

export const sourceUrl = "https://www.gutenberg.org/ebooks/768";
export const sourceEdition =
  "Project Gutenberg eBook #768 (plain text, updated 6 May 2026; credits: David Price)";

const source = fs
  .readFileSync("scripts/wuthering-heights/source/pg768.txt", "utf8")
  .replaceAll("\r", "");
const start = source.indexOf("CHAPTER I");
const end = source.indexOf(
  "*** END OF THE PROJECT GUTENBERG EBOOK WUTHERING HEIGHTS ***",
);
assert(start >= 0 && end > start, "Could not isolate the complete narrative");
const narrative = source.slice(start, end).trim();
const headings = [...narrative.matchAll(/^CHAPTER ([IVXLCDM]+)$/gm)];
assert.equal(headings.length, 34, "Expected the edition's 34 chapters");

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

export const sourceChapters = headings.map((heading, index) => ({
  number: index + 1,
  sourceNumber: heading[1],
  // The source chapters are numbered but untitled; these labels are editorial.
  title: `Chapter ${heading[1]}`,
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
