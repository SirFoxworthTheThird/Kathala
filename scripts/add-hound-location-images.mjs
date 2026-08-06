import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const files = [
  path.join(root, 'example', 'The Hound of the Baskervilles.pwk'),
  path.join(root, 'public', 'library', 'the-hound-of-the-baskervilles.pwk'),
]

const paget = (number) => `hound-image-paget-${number}`
const assignments = {
  'hound-loc-london-portal': paget(1),
  'hound-loc-dartmoor-portal': 'hound-image-cover',
  'hound-loc-baker-street': paget(5),
  'hound-loc-northumberland': paget(8),
  'hound-loc-charing-cross': paget(12),
  'hound-loc-waterloo': paget(15),
  'hound-loc-cartwright-route': paget(17),
  'hound-loc-moor-gate': paget(18),
  'hound-loc-hall-portal': paget(20),
  'hound-loc-merripit': paget(25),
  'hound-loc-grimpen': paget(30),
  'hound-loc-tor': paget(31),
  'hound-loc-stone-hut': paget(34),
  'hound-loc-coombe-tracey': paget(35),
  'hound-loc-frankland': paget(33),
  'hound-loc-princetown': paget(32),
  'hound-loc-selden-refuge': 'hound-image-paget-selden',
  'hound-loc-hound-kennel': paget(53),
  'hound-loc-yew-alley-entry': paget(22),
  'hound-loc-summer-house': paget(23),
  'hound-loc-great-hall': paget(19),
  'hound-loc-dining-room': paget(21),
  'hound-loc-sir-henry-room': paget(26),
  'hound-loc-watson-room': paget(28),
  'hound-loc-barrymore-room': paget(29),
  'hound-loc-portrait-gallery': paget(27),
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
  console.log(`${path.relative(root, file)}: ${data.locationMarkers.length} locations illustrated with ${new Set(Object.values(assignments)).size} Sidney Paget drawings`)
}
