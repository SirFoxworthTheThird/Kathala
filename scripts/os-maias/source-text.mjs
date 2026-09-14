import fs from "node:fs";

export const sourceUrl = "https://www.gutenberg.org/ebooks/40409";
export const sourceEdition = "Os Maias: episodios da vida romantica, edição Ernesto Chardron de 1888, transcrição Project Gutenberg n.º 40409";

const raw = fs.readFileSync(new URL("./source/pg40409.txt", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const start = raw.indexOf("A casa que os Maias vieram habitar");
const end = raw.indexOf("*** END OF THE PROJECT GUTENBERG EBOOK");
if (start < 0 || end < 0) throw new Error("Não foi possível delimitar o romance na fonte.");
const body = `I\n\n${raw.slice(start, end).trim()}`;
const heading = /^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII)\s*$/gm;
const hits = [...body.matchAll(heading)];
if (hits.length !== 18) throw new Error(`Esperavam-se 18 capítulos; encontrados ${hits.length}.`);

export const sourceChapters = hits.map((hit, index) => {
  const textStart = hit.index + hit[0].length;
  const textEnd = hits[index + 1]?.index ?? body.length;
  let text = body.slice(textStart, textEnd).trim();
  if (index === 9) text = text.split("FIM DO PRIMEIRO VOLUME")[0].trim();
  if (index === 17) text = text.split("FIM DO SEGUNDO VOLUME")[0].trim();
  return { number: index + 1, heading: hit[1], text };
});
export const narrativeText = sourceChapters.map(({ text }) => text).join("\n\n");
