import fs from "node:fs";
import { cutsByChapter } from "./full-scene-drafts.mjs";
import { manuscriptScenes } from "./scene-ledger.mjs";
import { sourceChapters, sourceEdition, sourceUrl } from "./source-text.mjs";

const short = (text) => text.replace(/\s+/g, " ").slice(0, 170);
const lines = [
  "# Robinson Crusoe scene-boundary audit",
  "",
  `Source: ${sourceEdition} — ${sourceUrl}`,
  "",
  "The excerpts below are audit aids only. The generator reads the full source slices directly.",
  "",
];
for (const chapter of sourceChapters) {
  const scenes = manuscriptScenes.filter(
    (scene) => scene.chapterNumber === chapter.number,
  );
  const points = [
    0,
    ...(cutsByChapter.get(chapter.number) ?? []),
    chapter.paragraphs.length,
  ];
  lines.push(`## ${chapter.number}. ${chapter.title}`, "");
  scenes.forEach((scene, index) => {
    const first = chapter.paragraphs[points[index]];
    const last = chapter.paragraphs[points[index + 1] - 1];
    lines.push(
      `### ${scene.title}`,
      "",
      `Paragraphs ${points[index]}–${points[index + 1] - 1}; ${scene.wordCount.toLocaleString("en-US")} words.`,
      "",
      `- Opens: ${short(first)}`,
      `- Closes: ${short(last)}`,
      "",
    );
  });
}
fs.writeFileSync(
  "scripts/robinson-crusoe/SCENE-BOUNDARY-AUDIT.md",
  `${lines.join("\n")}\n`,
);
console.log({
  chapters: sourceChapters.length,
  scenes: manuscriptScenes.length,
  words: manuscriptScenes.reduce((sum, scene) => sum + scene.wordCount, 0),
});
