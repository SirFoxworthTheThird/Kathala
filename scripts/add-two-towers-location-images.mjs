import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const fellowshipFile = path.join(root, 'example', 'The Fellowship of the Ring.pwk')
const files = [
  path.join(root, 'example', 'The Two Towers.pwk'),
  path.join(root, 'public', 'library', 'the-two-towers.pwk'),
]

const fellowship = JSON.parse(fs.readFileSync(fellowshipFile, 'utf8'))
const fellowshipBlobs = new Map(fellowship.blobs.map((blob) => [blob.id, blob]))
const sharedImages = new Map(fellowship.locationMarkers.map((location) => {
  const blob = fellowshipBlobs.get(location.imageId)
  if (!blob?.url) throw new Error(`Fellowship location has no URL-backed image: ${location.name}`)
  return [location.name, {
    key: location.imageId.replace('fotr-location-image-', ''),
    url: blob.url,
  }]
}))

const newImages = {
  entmoot: 'https://www.tednasmith.com/wp-content/uploads/2012/08/TN-Treebeard_and_the_Entmoot.jpg',
  towerCirith: 'https://www.tednasmith.com/wp-content/uploads/2012/08/TN-Sam_Enters_Mordor_Alone.jpg',
  stairs: 'https://www.tednasmith.com/wp-content/uploads/2012/08/TN-No_Way_Down.jpg',
  orcPyre: 'https://www.tednasmith.com/wp-content/uploads/2012/08/TN-Pursuit_in_Rohan.jpg',
  ephelDuath: 'https://www.tednasmith.com/wp-content/uploads/2012/08/TN-First_Sight_of_Ithilien.jpg',
  glittering: 'https://www.tednasmith.com/wp-content/uploads/2012/07/TN-The_Glittering_Caves_of_Aglarond.jpg',
  ithilien: 'https://www.tednasmith.com/wp-content/uploads/2020/12/TN-Ithilien.jpg',
}

const newAssignments = {
  'Fangorn Forest': sharedImages.get('Derndingle'),
  'Fangorn Edge': sharedImages.get('Derndingle'),
  'Entmoot': { key: 'entmoot', url: newImages.entmoot },
  'Orc Pyre': { key: 'orcPyre', url: newImages.orcPyre },
  'Glittering Caves': { key: 'glittering', url: newImages.glittering },
  'Fords of Isen': { key: 'orcPyre', url: newImages.orcPyre },
  'Ring of Isengard': sharedImages.get('Isengard'),
  'Dead Marshes': sharedImages.get('Gladden Fields'),
  'Ithilien Glade': { key: 'ithilien', url: newImages.ithilien },
  'Ephel Dúath View': { key: 'ephelDuath', url: newImages.ephelDuath },
  'Stairs of Cirith Ungol': { key: 'stairs', url: newImages.stairs },
  'Torech Ungol': sharedImages.get('Shelob’s Lair'),
  'Tower of Cirith Ungol': { key: 'towerCirith', url: newImages.towerCirith },
}

const createdAt = 1785974400000

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  const assignments = new Map()

  for (const location of data.locationMarkers ?? []) {
    const assignment = sharedImages.get(location.name) ?? newAssignments[location.name]
    if (!assignment) throw new Error(`No location image assignment for ${location.name} in ${file}`)
    assignments.set(location.id, assignment)
  }

  const assets = new Map([...assignments.values()].map((asset) => [asset.key, asset.url]))
  data.blobs = (data.blobs ?? []).filter(({ id }) => !id.startsWith('tt-location-image-'))
  data.blobs.push(...[...assets].map(([key, url]) => ({
    id: `tt-location-image-${key}`,
    worldId: data.world.id,
    mimeType: 'image/jpeg',
    url,
    createdAt,
  })))

  for (const location of data.locationMarkers) {
    location.imageId = `tt-location-image-${assignments.get(location.id).key}`
  }

  const blobIds = new Set(data.blobs.map(({ id }) => id))
  const unresolved = data.locationMarkers.filter(({ imageId }) => !imageId || !blobIds.has(imageId))
  if (unresolved.length) throw new Error(`Unresolved location images in ${file}: ${unresolved.map(({ name }) => name)}`)

  fs.writeFileSync(file, JSON.stringify(data))
  console.log(`${path.relative(root, file)}: ${data.locationMarkers.length} locations, ${assets.size} linked illustrations`)
}
