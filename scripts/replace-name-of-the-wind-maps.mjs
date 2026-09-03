import fs from 'node:fs'
import assert from 'node:assert/strict'

// Targeted, repeatable map revision, not a regeneration of the book's story.
// Anchors are measured on each final new PNG, from its top-left corner.
const worldPath = 'public/library/the-name-of-the-wind.pwk'
const bundlePath = 'public/library/the-name-of-the-wind.pwb'
const world = JSON.parse(fs.readFileSync(worldPath, 'utf8'))
const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'))
const manifest = JSON.parse(fs.readFileSync('scripts/name-of-the-wind/map-manifest.json', 'utf8'))
const stamp = Date.parse('2026-09-03T16:00:00Z')
const byLocation = new Map(world.locationMarkers.map(l => [l.id, l]))
const changedMaps = new Set(manifest.maps.map(m => m.id))
const assigned = new Set()

for (const entry of manifest.maps) {
  const layer = world.mapLayers.find(m => m.id === entry.id)
  assert(layer, `Missing map ${entry.id}`)
  const bytes = fs.readFileSync(`public/${entry.url}`)
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert.equal(bytes.readUInt32BE(16), entry.width)
  assert.equal(bytes.readUInt32BE(20), entry.height)
  Object.assign(layer, { imageWidth: entry.width, imageHeight: entry.height,
    scalePixelsPerUnit: null, scaleUnit: null, updatedAt: stamp })

  // Keep image IDs stable but replace bytes/URL consistently in BOTH packages.
  const linked = { id: layer.imageId, worldId: world.world.id,
    mimeType: 'image/png', url: entry.url, createdAt: stamp }
  for (const container of [world, bundle]) {
    const index = container.blobs.findIndex(b => b.id === linked.id)
    if (index < 0) container.blobs.push({ ...linked })
    else container.blobs[index] = { ...linked }
  }
  for (const [id, [x, topY]] of Object.entries(entry.anchors)) {
    const location = byLocation.get(id)
    assert(location && location.mapLayerId === entry.id, `Wrong layer for ${id}`)
    assert(x >= 0 && x <= entry.width && topY >= 0 && topY <= entry.height, `Out of bounds: ${id}`)
    Object.assign(location, { x, y: entry.height - topY, updatedAt: stamp })
    assigned.add(id)
  }
}
for (const location of world.locationMarkers) {
  if (changedMaps.has(location.mapLayerId)) assert(assigned.has(location.id), `Unreviewed anchor: ${location.id}`)
}
// This version uses location references rather than absolute movement paths.
// Refuse to silently leave stale geometry if future edits introduce it.
for (const field of ['characterMovements', 'itemPlacements', 'mapRoutes', 'mapRegions', 'mapAnnotations', 'locationSnapshots']) {
  assert.equal((world[field] ?? []).length, 0, `Review coordinate-bearing collection before migration: ${field}`)
}

byLocation.get('loc-ankers').description = "An inn in the small town surrounding the University, on the University side of the Omethi. Kvothe lodges upstairs and plays music in exchange for room and board."
byLocation.get('loc-tarbean-hillside').description = "Tarbean's prosperous upper district, with substantial houses, shops and cleaner streets above the crowded waterfront."
byLocation.get('loc-house-of-wind').description = 'An enclosed University courtyard watched from the surrounding rooftops, where shifting air catches and carries falling leaves.'
byLocation.get('loc-scrael-camp').description = 'The roofless remains of an old house in the countryside outside Newarre, with stone walls around an exposed hearth.'

// The unchanged root map also has a linked record, so opening a map does not
// depend on downloading the bundle used for unrelated character/item images.
const root = world.mapLayers.find(m => m.parentMapId === null)
if (!world.blobs.some(b => b.id === root.imageId)) {
  const image = bundle.blobs.find(b => b.id === root.imageId)
  assert(image?.url, 'Root map must retain its existing linked asset')
  world.blobs.push({ ...image })
}
const lore = {
  id: 'notw-lore-map-reconstruction', worldId: world.world.id,
  categoryId: 'lore-cat-places', title: 'About the Local Maps',
  body: 'The Tarbean, University and Imre, Trebon, and Newarre maps are original AI-generated reader reconstructions. Only the Four Corners main map was used as an aesthetic reference; none of the previous submap layouts was used. Known relationships guide the designs: the University lies west of Imre across the Omethi and Stonebridge; Anker’s belongs to the University-side town; Tarbean contrasts wealthy Hillside with crowded Waterside; Mauthen Farm is near Trebon; and the Waystone Inn belongs to Newarre. Exact streets, building footprints, bearings, local distances and the position of the rural ruins are editorial, not surveyed or author-approved geography. Newarre’s precise position in the wider world remains uncertain; its existing root-map gateway is an approximate navigation aid, not a canonical location. The Underthing inset is a schematic underground view, not a literal surface site or complete floor plan. Maps show neutral place identities rather than later attacks or outcomes. The generation prompts, research references and review limitations are recorded in scripts/name-of-the-wind/map-manifest.json and MAP-REVIEW.md.',
  tags: ['maps', 'sources', 'editorial reconstruction'], coverImageId: null,
  linkedEntityIds: [], visibleFromEventId: null, createdAt: stamp, updatedAt: stamp,
}
const loreIndex = world.lorePages.findIndex(p => p.id === lore.id)
if (loreIndex < 0) world.lorePages.push(lore)
else world.lorePages[loreIndex] = lore
world.world.updatedAt = stamp

const worldText = `${JSON.stringify(world, null, 2)}\n`
const bundleText = JSON.stringify(bundle)
for (const file of [worldPath, 'example/The Name of the Wind.pwk']) fs.writeFileSync(file, worldText)
for (const file of [bundlePath, 'example/The Name of the Wind.pwb']) fs.writeFileSync(file, bundleText)
const catalogue = JSON.parse(fs.readFileSync('public/library/index.json', 'utf8'))
const entry = catalogue.entries.find(e => e.id === 'the-name-of-the-wind')
assert(entry, 'Missing catalogue entry')
entry.dataBytes = Buffer.byteLength(worldText)
entry.imagesBytes = Buffer.byteLength(bundleText)
fs.writeFileSync('public/library/index.json', `${JSON.stringify(catalogue, null, 2)}\n`)
console.log(JSON.stringify({ mapsReplaced: manifest.maps.length, anchors: assigned.size,
  dataBytes: entry.dataBytes, imagesBytes: entry.imagesBytes }, null, 2))
