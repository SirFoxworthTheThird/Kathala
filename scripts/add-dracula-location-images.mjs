import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const files = [
  path.join(root, 'example', 'Dracula.pwk'),
  path.join(root, 'public', 'library', 'dracula.pwk'),
]

const gallery = 'https://www.johncoulthart.com/images/dracula'
const images = Object.fromEntries(
  Array.from({ length: 27 }, (_, index) => {
    const number = String(index + 1).padStart(2, '0')
    return [`coulthart-${number}`, `${gallery}/dracula${number}.jpg`]
  }),
)

const assignments = {
  'dracula-loc-europe': 'coulthart-23',
  'dracula-loc-munich': 'coulthart-23',
  'dracula-loc-vienna': 'coulthart-23',
  'dracula-loc-budapest': 'coulthart-14',
  'dracula-loc-varnav': 'coulthart-25',
  'dracula-loc-galatz': 'coulthart-26',
  'dracula-loc-exeter': 'coulthart-14',
  'dracula-loc-london-portal': 'coulthart-17',
  'dracula-loc-whitby-portal': 'coulthart-08',
  'dracula-loc-demeter-portal': 'coulthart-25',
  'dracula-loc-transylvania-portal': 'coulthart-26',
  'dracula-loc-bistritz': 'coulthart-26',
  'dracula-loc-borgo': 'coulthart-01',
  'dracula-loc-castle-portal': 'coulthart-01',
  'dracula-loc-veresti': 'coulthart-26',
  'dracula-loc-fundu': 'coulthart-26',
  'dracula-loc-river': 'coulthart-26',
  'dracula-loc-galatz-regional': 'coulthart-26',
  'dracula-loc-castle-courtyard': 'coulthart-01',
  'dracula-loc-castle-hall': 'coulthart-02',
  'dracula-loc-castle-library': 'coulthart-04',
  'dracula-loc-castle-dining': 'coulthart-02',
  'dracula-loc-castle-guest': 'coulthart-22',
  'dracula-loc-castle-stair': 'coulthart-04',
  'dracula-loc-harker-room': 'coulthart-22',
  'dracula-loc-gallery': 'coulthart-03',
  'dracula-loc-count-room': 'coulthart-19',
  'dracula-loc-battlements': 'coulthart-04',
  'dracula-loc-chapel': 'coulthart-09',
  'dracula-loc-earth-vault': 'coulthart-19',
  'dracula-loc-vampire-tombs': 'coulthart-27',
  'dracula-loc-hillingham': 'coulthart-10',
  'dracula-loc-purfleet': 'coulthart-09',
  'dracula-loc-asylum-portal': 'coulthart-18',
  'dracula-loc-piccadilly': 'coulthart-20',
  'dracula-loc-bermondsey': 'coulthart-17',
  'dracula-loc-mile-end': 'coulthart-17',
  'dracula-loc-zoo': 'coulthart-11',
  'dracula-loc-ring': 'coulthart-05',
  'dracula-loc-charing': 'coulthart-17',
  'dracula-loc-carfax-chapel': 'coulthart-09',
  'dracula-loc-carfax-house': 'coulthart-09',
  'dracula-loc-carfax-boxes': 'coulthart-19',
  'dracula-loc-carfax-yard': 'coulthart-09',
  'dracula-loc-seward-study': 'coulthart-18',
  'dracula-loc-renfield-cell': 'coulthart-18',
  'dracula-loc-mina-room': 'coulthart-21',
  'dracula-loc-asylum-grounds': 'coulthart-15',
  'dracula-loc-chancery': 'coulthart-14',
  'dracula-loc-whitby-station': 'coulthart-17',
  'dracula-loc-crescent': 'coulthart-05',
  'dracula-loc-harbour': 'coulthart-07',
  'dracula-loc-east-cliff': 'coulthart-06',
  'dracula-loc-churchyard': 'coulthart-08',
  'dracula-loc-abbey': 'coulthart-08',
  'dracula-loc-swales-bench': 'coulthart-06',
  'dracula-loc-demeter-deck': 'coulthart-25',
  'dracula-loc-demeter-helm': 'coulthart-07',
  'dracula-loc-demeter-cabin': 'coulthart-25',
  'dracula-loc-demeter-hold': 'coulthart-25',
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

  data.blobs = (data.blobs ?? []).filter(({ id }) => !id.startsWith('dracula-location-coulthart-'))
  data.blobs.push(...usedKeys.map((key) => ({
    id: `dracula-location-${key}`,
    worldId: data.world.id,
    mimeType: 'image/jpeg',
    url: images[key],
    createdAt,
  })))

  for (const location of data.locationMarkers) {
    location.imageId = `dracula-location-${assignments[location.id]}`
  }

  const blobIds = new Set(data.blobs.map(({ id }) => id))
  const unresolved = data.locationMarkers.filter(({ imageId }) => !imageId || !blobIds.has(imageId))
  if (unresolved.length) throw new Error(`Unresolved location images in ${file}: ${unresolved.map(({ name }) => name)}`)

  fs.writeFileSync(file, JSON.stringify(data))
  console.log(`${path.relative(root, file)}: ${data.locationMarkers.length} locations illustrated with ${usedKeys.length} book illustrations`)
}
