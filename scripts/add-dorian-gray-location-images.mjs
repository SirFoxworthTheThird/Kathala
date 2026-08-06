import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const files = [
  path.join(root, 'example', 'The Picture of Dorian Gray.pwk'),
  path.join(root, 'public', 'library', 'the-picture-of-dorian-gray.pwk'),
]

const assignments = {
  'dorian-gray-loc-london-portal': 'dorian-gray-image-char-dorian',
  'dorian-gray-loc-selby-portal': 'dorian-gray-image-char-duchess',
  'dorian-gray-loc-country-village': 'dorian-gray-image-char-hetty',
  'dorian-gray-loc-basil-studio': 'dorian-gray-image-char-basil',
  'dorian-gray-loc-brandon-party': 'dorian-gray-image-char-hubbard',
  'dorian-gray-loc-agatha-house': 'dorian-gray-image-char-agatha',
  'dorian-gray-loc-henry-house': 'dorian-gray-image-char-victoria',
  'dorian-gray-loc-dorian-portal': 'dorian-gray-image-char-dorian',
  'dorian-gray-loc-theatre': 'dorian-gray-image-char-sibyl',
  'dorian-gray-loc-club': 'dorian-gray-image-char-fermor',
  'dorian-gray-loc-alan-house': 'dorian-gray-image-char-alan',
  'dorian-gray-loc-victoria-station': 'dorian-gray-image-item-basil-bag',
  'dorian-gray-loc-soho-portal': 'dorian-gray-image-item-opium-pipe',
  'dorian-gray-loc-vane-lodgings': 'dorian-gray-image-char-mrs-vane',
  'dorian-gray-loc-opium-den': 'dorian-gray-image-item-opium-pipe',
  'dorian-gray-loc-dock-street': 'dorian-gray-image-char-james',
  'dorian-gray-loc-house-hall': 'dorian-gray-image-char-hubbard',
  'dorian-gray-loc-house-library': 'dorian-gray-image-item-yellow-book',
  'dorian-gray-loc-house-drawing': 'dorian-gray-image-char-henry',
  'dorian-gray-loc-house-dining': 'dorian-gray-image-char-agatha',
  'dorian-gray-loc-house-garden': 'dorian-gray-image-item-orchids',
  'dorian-gray-loc-attic-portal': 'dorian-gray-image-item-attic-key',
  'dorian-gray-loc-attic-room': 'dorian-gray-image-item-purple-cover',
  'dorian-gray-loc-portrait-wall': 'dorian-gray-image-item-portrait',
  'dorian-gray-loc-attic-screen': 'dorian-gray-image-item-screen',
  'dorian-gray-loc-attic-cabinet': 'dorian-gray-image-item-cabinet',
  'dorian-gray-loc-attic-door': 'dorian-gray-image-item-attic-key',
  'dorian-gray-loc-selby-hall': 'dorian-gray-image-char-duchess',
  'dorian-gray-loc-selby-drawing': 'dorian-gray-image-char-geoffrey',
  'dorian-gray-loc-selby-conservatory': 'dorian-gray-image-item-orchids',
  'dorian-gray-loc-selby-terrace': 'dorian-gray-image-char-james',
  'dorian-gray-loc-selby-shooting': 'dorian-gray-image-item-revolver',
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
  console.log(`${path.relative(root, file)}: ${data.locationMarkers.length} locations illustrated with ${new Set(Object.values(assignments)).size} book illustrations`)
}
