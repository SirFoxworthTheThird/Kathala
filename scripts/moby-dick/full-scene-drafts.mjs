import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('scripts/moby-dick/source/pg2701.txt', 'utf8').replaceAll('\r', '')
const startMarker = source.match(/\*\*\* START OF (?:THIS|THE) PROJECT GUTENBERG EBOOK MOBY DICK; OR, THE WHALE \*\*\*/)?.[0]
const endMarker = source.match(/\*\*\* END OF (?:THIS|THE) PROJECT GUTENBERG EBOOK MOBY DICK; OR, THE WHALE \*\*\*/)?.[0]
assert(startMarker && endMarker, 'Moby-Dick source must contain Gutenberg boundaries')
const body = source.slice(source.indexOf(startMarker) + startMarker.length, source.indexOf(endMarker))

const normalize = raw => raw
  .split(/\n\s*\n/)
  .map(paragraph => paragraph.split('\n').map(line => line.trim()).join(' ').replace(/\s+/g, ' ').trim())
  .filter(Boolean)
  .join('\n\n')

const headings = [...body.matchAll(/^CHAPTER (\d+)\.[^\n]*(?:\n(?!\n)[^\n]*)*/gm)]
const actual = []
for (let number = 1; number <= 135; number += 1) {
  const matches = headings.filter(match => Number(match[1]) === number)
  assert(matches.length >= 2, `Missing narrative heading for Chapter ${number}`)
  actual.push(matches.at(-1))
}

const epilogues = [...body.matchAll(/^Epilogue$/gm)]
assert(epilogues.length >= 2, 'Missing narrative Epilogue heading')
const epilogue = epilogues.at(-1)
const ordered = [...actual, epilogue]

export const sceneDrafts = ordered.map((heading, index) => {
  const start = heading.index + heading[0].length
  const end = ordered[index + 1]?.index ?? body.length
  const prose = normalize(body.slice(start, end))
  assert(prose, `Empty Moby-Dick section ${index + 1}`)
  return prose
})

assert.equal(sceneDrafts.length, 136, 'Moby-Dick must contain 135 chapters and the Epilogue')
