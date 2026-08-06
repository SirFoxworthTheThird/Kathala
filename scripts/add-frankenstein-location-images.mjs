import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const files = [
  path.join(root, 'example', 'Frankenstein.pwk'),
  path.join(root, 'public', 'library', 'frankenstein.pwk'),
]

const commons = (name) => `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(name)}?width=1280`
const images = {
  stPetersburg: commons('Fyodor Alexeyev - View of the Peter and Paul Fortress and Palace Embankment - Google Art Project.jpg'),
  sailing: commons('On a Sailing Ship by Caspar David Friedrich.jpg'),
  seaIce: commons('Caspar David Friedrich - The Sea of Ice - WGA8270.jpg'),
  wanderer: commons('Caspar David Friedrich - Wanderer above the sea of fog.jpg'),
  forest: commons('Waldinneres bei Mondschein (Caspar David Friedrich)-Detail-WUS03239.jpg'),
  lakeGeneva: commons('Joseph Mallord William Turner - Lake Geneva and Mount Blanc - Google Art Project.jpg'),
  arveron: commons('J M W Turner - The Source of the Arveron in the Valley of Chamouni, Savoy - B1977.14.8177 - Yale Center for British Art.jpg'),
  victorLab: commons('Frankenstein observing the first stirrings of his creature. Wellcome L0027125.jpg'),
  frontispiece: commons('Frontispiece to Frankenstein 1831.jpg'),
  abbey: commons('Caspar David Friedrich - Abtei im Eichwald - Google Art Project.jpg'),
  cottage: commons('Caspar David Friedrich - Verschneite Hütte (1827).jpg'),
  london: commons('Joseph Mallord William Turner - London from Greenwich Park - Google Art Project.jpg'),
  oxford: commons('High Street, Oxford (painting), by Turner (1810) crop.jpg'),
  matlock: commons('Joseph Wright of Derby - Matlock Tor by Moonlight - 48.4 - Detroit Institute of Arts.jpg'),
  cumberland: commons('Turner Buttermere Lake with Park of Cromackwater.jpg'),
  ireland: commons("Drury - View of the Giant's Causeway.jpg"),
}

const assignments = {
  'frankenstein-loc-st-petersburg': 'stPetersburg',
  'frankenstein-loc-archangel-portal': 'sailing',
  'frankenstein-loc-geneva-portal': 'lakeGeneva',
  'frankenstein-loc-ingolstadt-portal': 'victorLab',
  'frankenstein-loc-montblanc-portal': 'arveron',
  'frankenstein-loc-britain-portal': 'oxford',
  'frankenstein-loc-rhine': 'wanderer',
  'frankenstein-loc-black-forest': 'forest',
  'frankenstein-loc-continental-road': 'wanderer',
  'frankenstein-loc-geneva-city-portal': 'lakeGeneva',
  'frankenstein-loc-belrive': 'lakeGeneva',
  'frankenstein-loc-lake-geneva': 'lakeGeneva',
  'frankenstein-loc-mont-saleve': 'arveron',
  'frankenstein-loc-evian': 'lakeGeneva',
  'frankenstein-loc-lausanne': 'lakeGeneva',
  'frankenstein-loc-geneva-city': 'lakeGeneva',
  'frankenstein-loc-frankenstein-home': 'cottage',
  'frankenstein-loc-plainpalais': 'lakeGeneva',
  'frankenstein-loc-geneva-prison': 'frontispiece',
  'frankenstein-loc-cemetery': 'abbey',
  'frankenstein-loc-city-gate': 'wanderer',
  'frankenstein-loc-university': 'victorLab',
  'frankenstein-loc-victor-rooms': 'victorLab',
  'frankenstein-loc-laboratory': 'victorLab',
  'frankenstein-loc-clerval-lodging': 'cottage',
  'frankenstein-loc-graveyard': 'abbey',
  'frankenstein-loc-cottage-portal': 'cottage',
  'frankenstein-loc-country-road': 'forest',
  'frankenstein-loc-chamonix': 'arveron',
  'frankenstein-loc-arve-valley': 'arveron',
  'frankenstein-loc-montanvert': 'wanderer',
  'frankenstein-loc-mer-de-glace': 'arveron',
  'frankenstein-loc-mountain-hut': 'cottage',
  'frankenstein-loc-mont-blanc': 'lakeGeneva',
  'frankenstein-loc-london': 'london',
  'frankenstein-loc-oxford': 'oxford',
  'frankenstein-loc-matlock': 'matlock',
  'frankenstein-loc-cumberland': 'cumberland',
  'frankenstein-loc-edinburgh': 'cumberland',
  'frankenstein-loc-perth': 'cumberland',
  'frankenstein-loc-orkney-portal': 'sailing',
  'frankenstein-loc-ireland-portal': 'ireland',
  'frankenstein-loc-english-channel': 'sailing',
  'frankenstein-loc-remote-island': 'sailing',
  'frankenstein-loc-island-hut': 'cottage',
  'frankenstein-loc-rocky-shore': 'seaIce',
  'frankenstein-loc-northern-sea': 'sailing',
  'frankenstein-loc-irish-coast': 'ireland',
  'frankenstein-loc-irish-village': 'cottage',
  'frankenstein-loc-kirwin-court': 'frontispiece',
  'frankenstein-loc-harbor': 'ireland',
  'frankenstein-loc-archangel': 'stPetersburg',
  'frankenstein-loc-open-sea': 'seaIce',
  'frankenstein-loc-walton-ship': 'sailing',
  'frankenstein-loc-sled-route': 'seaIce',
  'frankenstein-loc-ice-field': 'seaIce',
  'frankenstein-loc-ice-raft': 'seaIce',
  'frankenstein-loc-hovel': 'cottage',
  'frankenstein-loc-de-lacey-room': 'cottage',
  'frankenstein-loc-family-room': 'cottage',
  'frankenstein-loc-cottage-door': 'forest',
}

const createdAt = 1786147200000
const usedKeys = [...new Set(Object.values(assignments))]

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  const locationIds = new Set(data.locationMarkers.map(({ id }) => id))
  const missing = data.locationMarkers.filter(({ id }) => !assignments[id])
  const unknown = Object.keys(assignments).filter((id) => !locationIds.has(id))
  if (missing.length || unknown.length) {
    throw new Error(`Location assignment mismatch in ${file}: missing=${missing.map(({ name }) => name)} unknown=${unknown}`)
  }

  data.blobs = (data.blobs ?? []).filter(({ id }) => !id.startsWith('frankenstein-location-image-'))
  data.blobs.push(...usedKeys.map((key) => ({
    id: `frankenstein-location-image-${key}`,
    worldId: data.world.id,
    mimeType: 'image/jpeg',
    url: images[key],
    createdAt,
  })))

  for (const location of data.locationMarkers) {
    location.imageId = `frankenstein-location-image-${assignments[location.id]}`
  }

  const blobIds = new Set(data.blobs.map(({ id }) => id))
  const unresolved = data.locationMarkers.filter(({ imageId }) => !imageId || !blobIds.has(imageId))
  if (unresolved.length) throw new Error(`Unresolved location images in ${file}: ${unresolved.map(({ name }) => name)}`)

  fs.writeFileSync(file, JSON.stringify(data))
  console.log(`${path.relative(root, file)}: ${data.locationMarkers.length} locations illustrated with ${usedKeys.length} Romantic and book illustrations`)
}
