import fs from 'node:fs'

const editablePath = 'example/The Iliad.pwk'
const libraryPath = 'public/library/the-iliad.pwk'
const cataloguePath = 'public/library/index.json'

// The editable PWK is the canonical authoring document. This generator deliberately
// preserves its stable IDs, timestamps, editorial calendar and hand-reviewed prose;
// it validates that source before reproducing the downloadable copy and catalogue.
const text = fs.readFileSync(editablePath, 'utf8')
const data = JSON.parse(text)

const expected = { chapters: 24, events: 75, characters: 52, locations: 17, items: 10, maps: 3 }
const actual = {
  chapters: data.chapters.length,
  events: data.events.length,
  characters: data.characters.length,
  locations: data.locationMarkers.length,
  items: data.items.length,
  maps: data.mapLayers.length,
}
for (const [key, count] of Object.entries(expected)) {
  if (actual[key] !== count) throw new Error(`Expected ${count} ${key}, found ${actual[key]}`)
}
if (data.world.id !== 'iliad-world' || data.world.name !== 'The Iliad') throw new Error('Unexpected Iliad world identity')
if (!text.endsWith('\n') || text !== `${JSON.stringify(data, null, 2)}\n`) throw new Error('Canonical PWK must use stable two-space JSON formatting and one trailing newline')

const ids = new Set()
for (const records of Object.values(data)) {
  if (!Array.isArray(records)) continue
  for (const record of records) {
    if (!record?.id) continue
    if (ids.has(record.id)) throw new Error(`Duplicate record id: ${record.id}`)
    ids.add(record.id)
  }
}

fs.writeFileSync(editablePath, text)
fs.writeFileSync(libraryPath, text)

const catalogue = JSON.parse(fs.readFileSync(cataloguePath, 'utf8'))
const entry = {
  id: 'the-iliad',
  title: 'The Iliad',
  author: 'Homer',
  blurb: 'A quarrel over honour removes Achilles from the Achaean line as Troy’s defenders and the divided gods press the war toward the beached ships.',
  data: 'the-iliad.pwk',
  dataBytes: Buffer.byteLength(text, 'utf8'),
  counts: { characters: actual.characters, chapters: actual.chapters, events: actual.events, locations: actual.locations },
  notice: 'Unofficial reference for a public-domain ancient epic. This example contains original structural summaries and editorial chronology, not the prose of any translation. The cover is an original AI-generated interpretation created for PlotWeave; map sourcing and editorial method are recorded in Lore.',
  worldId: data.world.id,
  cover: 'library/the-iliad/art/cover.jpg',
}
const entryIndex = catalogue.entries.findIndex(candidate => candidate.id === entry.id)
if (entryIndex < 0) catalogue.entries.push(entry)
else catalogue.entries[entryIndex] = entry
fs.writeFileSync(cataloguePath, `${JSON.stringify(catalogue, null, 2)}\n`)

console.log(JSON.stringify({ ...actual, bytes: entry.dataBytes }, null, 2))
