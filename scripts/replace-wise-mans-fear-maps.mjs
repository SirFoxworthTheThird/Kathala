import fs from 'node:fs'
import assert from 'node:assert/strict'

// Targeted map migration. Never regenerate story/event records.
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'))
const worldPath = 'public/library/the-wise-man-s-fear.pwk'
const bundlePath = 'public/library/the-wise-man-s-fear.pwb'
const world = read(worldPath)
const bundle = fs.existsSync(bundlePath) ? read(bundlePath) : { blobs: [] }
const manifest = read('scripts/wise-mans-fear/map-manifest.json')
const previous = read('public/library/the-name-of-the-wind.pwk')
const previousManifest = read('scripts/name-of-the-wind/map-manifest.json')
const stamp = Date.parse('2026-09-03T18:00:00Z')
const oldMapImages = new Set(world.mapLayers.map(m => m.imageId))
const entries = [...manifest.maps]

// The sequel's inherited entities have different IDs: match exact map/place
// names, not array order or a guessed ID conversion.
for (const sourceEntry of previousManifest.maps) {
  const sourceLayer = previous.mapLayers.find(m => m.id === sourceEntry.id)
  const targetLayer = world.mapLayers.find(m => m.name === sourceLayer.name)
  assert(targetLayer, `Shared map missing: ${sourceLayer.name}`)
  const anchors = {}
  for (const [id, xy] of Object.entries(sourceEntry.anchors)) {
    const sourceLocation = previous.locationMarkers.find(l => l.id === id)
    const matches = world.locationMarkers.filter(l => l.name === sourceLocation.name && l.mapLayerId === targetLayer.id)
    assert.equal(matches.length, 1, `Ambiguous inherited location ${sourceLocation.name}`)
    anchors[matches[0].id] = xy
  }
  if (sourceEntry.id === 'notw-map-university') {
    // Existing inn footprint on the Imre side; precise address is editorial.
    anchors['wmf-loc-grey-man'] = manifest.greyManAnchor
  }
  entries.push({ ...sourceEntry, id: targetLayer.id, anchors })
}

for (const field of ['characterMovements', 'itemPlacements', 'mapRoutes', 'mapRegions', 'mapAnnotations', 'locationSnapshots']) {
  assert.equal((world[field] ?? []).length, 0, `Review coordinate-bearing data before migration: ${field}`)
}
const assigned = new Set()
for (const entry of entries) {
  const layer = world.mapLayers.find(m => m.id === entry.id)
  assert(layer, `Missing map ${entry.id}`)
  const png = fs.readFileSync(`public/${entry.url}`)
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert.equal(png.readUInt32BE(16), entry.width)
  assert.equal(png.readUInt32BE(20), entry.height)
  // All six former placeholders shared the ROOT image ID. Allocate dedicated
  // IDs rather than changing the blob behind the unchanged world map.
  layer.imageId = `wmf-atlas-${entry.id}`
  Object.assign(layer, { imageWidth: entry.width, imageHeight: entry.height,
    scalePixelsPerUnit: null, scaleUnit: null, updatedAt: stamp })
  const linked = { id: layer.imageId, worldId: world.world.id,
    mimeType: 'image/png', url: entry.url, createdAt: stamp }
  for (const container of [world, bundle]) {
    const index = container.blobs.findIndex(b => b.id === linked.id)
    if (index < 0) container.blobs.push({ ...linked })
    else container.blobs[index] = { ...linked }
  }
  for (const [id, [x, topY]] of Object.entries(entry.anchors)) {
    const location = world.locationMarkers.find(l => l.id === id)
    assert(location?.mapLayerId === layer.id, `Wrong map for ${id}`)
    assert(x >= 0 && x <= entry.width && topY >= 0 && topY <= entry.height)
    Object.assign(location, { x, y: entry.height - topY, updatedAt: stamp })
    assigned.add(id)
  }
  for (const location of world.locationMarkers.filter(l => l.mapLayerId === layer.id)) {
    assert(assigned.has(location.id), `Unreviewed marker: ${location.id}`)
  }
  const gateways = world.locationMarkers.filter(l => l.linkedMapLayerId === layer.id)
  assert.equal(gateways.length, 1, `Map needs exactly one gateway: ${layer.name}`)
  assert.equal(gateways[0].mapLayerId, layer.parentMapId)
}
assert.equal(new Set(world.mapLayers.map(m => m.imageId)).size, world.mapLayers.length)
for (const [id, description] of Object.entries(manifest.descriptionCorrections)) {
  const location = world.locationMarkers.find(l => l.id === id)
  assert(location, `Missing corrected location ${id}`)
  Object.assign(location, { description, updatedAt: stamp })
}
// Remove only old map assets no longer referenced anywhere in world data;
// character/item/location art and the root map remain untouched.
const { blobs: ignoredBlobs, ...entities } = world
const references = JSON.stringify(entities)
for (const container of [world, bundle]) {
  container.blobs = container.blobs.filter(b => !oldMapImages.has(b.id) || references.includes(JSON.stringify(b.id)))
}
const root = world.mapLayers.find(m => !m.parentMapId)
if (!world.blobs.some(b => b.id === root.imageId)) {
  const blob = bundle.blobs.find(b => b.id === root.imageId)
  assert(blob?.url, 'Missing original main map link')
  world.blobs.push({ ...blob })
}
const lore = { id: 'wmf-lore-map-reconstruction', worldId: world.world.id,
  categoryId: '9u0DVZY2Ac6K3OcJGeSMP', title: 'About the Local Maps',
  body: manifest.provenance, tags: ['maps', 'sources', 'editorial reconstruction'],
  coverImageId: null, linkedEntityIds: [], visibleFromEventId: null,
  createdAt: stamp, updatedAt: stamp }
const loreIndex = world.lorePages.findIndex(l => l.id === lore.id)
if (loreIndex < 0) world.lorePages.push(lore)
else world.lorePages[loreIndex] = lore
world.world.updatedAt = stamp
const worldText = `${JSON.stringify(world, null, 2)}\n`
const bundleText = JSON.stringify(bundle)
for (const path of [worldPath, "example/The Wise Man's Fear.pwk"]) fs.writeFileSync(path, worldText)
const needsBundle = bundle.blobs.some(b => b.dataBase64)
for (const path of [bundlePath, "example/The Wise Man's Fear.pwb"]) {
  if (needsBundle) fs.writeFileSync(path, bundleText)
  else {
    for (const blob of bundle.blobs) {
      assert(world.blobs.some(b => b.id === blob.id && b.url === blob.url), `Unmigrated linked asset ${blob.id}`)
    }
    // Exact former bundle paths only; all surviving links are already in PWK.
    if (fs.existsSync(path)) fs.unlinkSync(path)
  }
}
const catalogue = read('public/library/index.json')
const entry = catalogue.entries.find(e => e.id === 'the-wise-man-s-fear')
entry.dataBytes = Buffer.byteLength(worldText)
if (needsBundle) {
  entry.images = 'the-wise-man-s-fear.pwb'
  entry.imagesBytes = Buffer.byteLength(bundleText)
} else {
  delete entry.images
  delete entry.imagesBytes
}
fs.writeFileSync('public/library/index.json', `${JSON.stringify(catalogue, null, 2)}\n`)
console.log(JSON.stringify({ maps: entries.length, anchors: assigned.size,
  dataBytes: entry.dataBytes, imagesBytes: entry.imagesBytes }, null, 2))
