import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('scripts/woman-in-white/source/pg583.txt', 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE WOMAN IN WHITE \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK THE WOMAN IN WHITE \*\*\*/)?.[0]
assert(startMarker && endMarker, 'The Woman in White source must contain Gutenberg boundaries')

const content = source.slice(source.indexOf(startMarker) + startMarker.length, source.indexOf(endMarker))
const bodyStart = content.indexOf('\nTHE STORY BEGUN BY WALTER HARTRIGHT')
assert(bodyStart >= 0, 'The first narrative must be present')
const body = content.slice(bodyStart)

// The novel changes witness repeatedly. A modeled scene corresponds to every
// numbered narrative section and to each unnumbered testimony. Top-level
// narrator/epoch headings immediately before a Roman I contain no prose, so
// they are folded forward into that witness's first section.
const headingPattern = /^(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|[1-5]\. THE NARRATIVE[^\n]*|THE THIRD EPOCH|THE STORY (?:BEGUN|CONTINUED|CONCLUDED)[^\n]*)$/gm
const headings = [...body.matchAll(headingPattern)]
let sections = headings.map((heading, index) => body
  .slice(heading.index, headings[index + 1]?.index ?? body.length)
  .trim())

const structuralParagraph = /^(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|THE THIRD EPOCH|THE STORY (?:BEGUN|CONTINUED|CONCLUDED)[^\n]*|\([^)]*\))$/
const paragraphs = text => text.trim().split(/\n\s*\n/)
  .map(paragraph => paragraph.split('\n').map(line => line.trim()).join(' ').replace(/\s+/g, ' ').trim())
  .filter(Boolean)

for (let index = sections.length - 2; index >= 0; index -= 1) {
  if (paragraphs(sections[index]).every(paragraph => structuralParagraph.test(paragraph))) {
    sections[index + 1] = `${sections[index]}\n\n${sections[index + 1]}`
    sections.splice(index, 1)
  }
}

assert.equal(sections.length, 62, 'The source must map to all 62 modeled narrative sections')

export const sceneDrafts = sections.map(section => paragraphs(section)
  .filter(paragraph => !structuralParagraph.test(paragraph))
  .filter(paragraph => !/^[1-5]\. THE NARRATIVE/.test(paragraph))
  .join('\n\n'))

assert(sceneDrafts.every(Boolean), 'No modeled event may receive an empty manuscript scene')

const narrativeParagraphs = paragraphs(body)
  .filter(paragraph => !structuralParagraph.test(paragraph))
  .filter(paragraph => !/^[1-5]\. THE NARRATIVE/.test(paragraph))
assert.equal(sceneDrafts.join('\n\n'), narrativeParagraphs.join('\n\n'), 'Every narrative paragraph must appear once in source order')
