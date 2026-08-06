import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const files = [
  path.join(root, 'example', 'Strange Case of Dr Jekyll and Mr Hyde.pwk'),
  path.join(root, 'public', 'library', 'strange-case-of-dr-jekyll-and-mr-hyde.pwk'),
]

const image = (name) => `jekyll-hyde-image-char-${name}`
const assignments = {
  'jekyll-hyde-loc-utterson-office': image('utterson'),
  'jekyll-hyde-loc-utterson-home': image('enfield'),
  'jekyll-hyde-loc-lanyon-house': image('lanyon'),
  'jekyll-hyde-loc-carew-site': image('carew'),
  'jekyll-hyde-loc-police-station': image('newcomen'),
  'jekyll-hyde-loc-soho-portal': image('hyde'),
  'jekyll-hyde-loc-jekyll-portal': image('jekyll'),
  'jekyll-hyde-loc-hyde-house': image('housekeeper'),
  'jekyll-hyde-loc-back-door': image('hyde'),
  'jekyll-hyde-loc-trampling-corner': image('girl'),
  'jekyll-hyde-loc-all-night-shop': image('father'),
  'jekyll-hyde-loc-soho-street': image('newcomen'),
  'jekyll-hyde-loc-front-hall': image('doctor'),
  'jekyll-hyde-loc-dining-room': image('doctor'),
  'jekyll-hyde-loc-drawing-room': image('guest'),
  'jekyll-hyde-loc-courtyard': image('poole'),
  'jekyll-hyde-loc-window': image('jekyll'),
  'jekyll-hyde-loc-lab-portal': image('poole'),
  'jekyll-hyde-loc-theatre': image('bradshaw'),
  'jekyll-hyde-loc-cabinet': image('jekyll'),
  'jekyll-hyde-loc-chemical-table': image('lanyon'),
  'jekyll-hyde-loc-drawer-cupboard': image('maid'),
  'jekyll-hyde-loc-fireplace': image('guest'),
  'jekyll-hyde-loc-cabinet-door': image('poole'),
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
  console.log(`${path.relative(root, file)}: ${data.locationMarkers.length} locations illustrated with ${new Set(Object.values(assignments)).size} historical book drawings`)
}
