import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const files = [
  path.join(root, 'example', 'Pride and Prejudice.pwk'),
  path.join(root, 'public', 'library', 'pride-and-prejudice.pwk'),
]

const assignments = {
  'pp-loc-hertfordshire-portal': 'pp-image-art-netherfield',
  'pp-loc-london-portal': 'pp-image-art-gardiner',
  'pp-loc-kent-portal': 'pp-image-art-lady-catherine',
  'pp-loc-derbyshire-portal': 'pp-image-art-pemberley',
  'pp-loc-brighton-portal': 'pp-image-art-forster',
  'pp-loc-newcastle': 'pp-image-art-wickham',
  'pp-loc-longbourn': 'pp-image-art-bennet',
  'pp-loc-meryton': 'pp-image-art-denny',
  'pp-loc-assembly': 'pp-image-art-dance',
  'pp-loc-netherfield': 'pp-image-art-caroline',
  'pp-loc-lucas-lodge': 'pp-image-art-charlotte',
  'pp-loc-philips-house': 'pp-image-art-mrs-philips',
  'pp-loc-oakham-mount': 'pp-image-art-reconciliation',
  'pp-loc-gardiner-house': 'pp-image-art-mrs-gardiner',
  'pp-loc-darcy-london': 'pp-image-art-georgiana',
  'pp-loc-wickham-lodgings': 'pp-image-art-mrs-younge',
  'pp-loc-hunsford': 'pp-image-art-sermons',
  'pp-loc-rosings': 'pp-image-art-jenkinson',
  'pp-loc-rosings-grove': 'pp-image-art-letter',
  'pp-loc-pemberley': 'pp-image-art-mrs-reynolds',
  'pp-loc-lambton': 'pp-image-art-visiting',
  'pp-loc-lambton-inn': 'pp-image-art-carriage',
  'pp-loc-brighton-camp': 'pp-image-art-mrs-forster',
  'pp-loc-brighton-town': 'pp-image-art-lydia',
}

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  const locationIds = new Set(data.locationMarkers.map(({ id }) => id))
  const missing = data.locationMarkers.filter(({ id }) => !assignments[id])
  const unknown = Object.keys(assignments).filter((id) => !locationIds.has(id))
  if (missing.length || unknown.length) {
    throw new Error(`Location assignment mismatch in ${file}: missing=${missing.map(({ name }) => name)} unknown=${unknown}`)
  }

  for (const location of data.locationMarkers) location.imageId = assignments[location.id]

  const blobIds = new Set(data.blobs.map(({ id }) => id))
  const unresolved = data.locationMarkers.filter(({ imageId }) => !imageId || !blobIds.has(imageId))
  if (unresolved.length) throw new Error(`Unresolved location images in ${file}: ${unresolved.map(({ name }) => name)}`)

  fs.writeFileSync(file, JSON.stringify(data))
  console.log(`${path.relative(root, file)}: ${data.locationMarkers.length} locations illustrated with ${new Set(Object.values(assignments)).size} Austen-edition drawings`)
}
