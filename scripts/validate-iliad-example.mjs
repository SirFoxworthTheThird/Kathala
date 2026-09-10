import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const editableBytes = fs.readFileSync('example/The Iliad.pwk')
const libraryBytes = fs.readFileSync('public/library/the-iliad.pwk')
assert.deepEqual(editableBytes, libraryBytes, 'Editable and Library PWKs differ')
const data = JSON.parse(editableBytes.toString('utf8'))
const expected = { chapters: 24, events: 75, characters: 52, locationMarkers: 17, items: 10, mapLayers: 3 }
for (const [collection, count] of Object.entries(expected)) assert.equal(data[collection].length, count, `${collection} count`)

const byId = new Map()
for (const [collection, records] of Object.entries(data)) {
  if (!Array.isArray(records)) continue
  for (const record of records) {
    if (!record?.id) continue
    assert(!byId.has(record.id), `Duplicate id ${record.id}`)
    byId.set(record.id, { collection, record })
  }
}
const requireId = (id, context) => assert(byId.has(id), `${context} references missing id ${id}`)

for (const event of data.events) {
  requireId(event.chapterId, event.id)
  requireId(event.timelineId, event.id)
  requireId(event.locationMarkerId, event.id)
  if (event.povCharacterId) requireId(event.povCharacterId, event.id)
  for (const id of [...event.involvedCharacterIds, ...event.mentionedCharacterIds, ...event.involvedItemIds, ...event.threadIds, ...event.motifIds]) requireId(id, event.id)
  assert(event.tension >= 1 && event.tension <= 5, `${event.id} tension`)
  assert(event.inWorldTime >= 0, `${event.id} inWorldTime`)
}

const snapshots = new Map()
for (const snapshot of data.characterSnapshots) {
  requireId(snapshot.characterId, snapshot.id)
  requireId(snapshot.eventId, snapshot.id)
  requireId(snapshot.currentLocationMarkerId, snapshot.id)
  requireId(snapshot.currentMapLayerId, snapshot.id)
  const event = byId.get(snapshot.eventId).record
  assert(event.involvedCharacterIds.includes(snapshot.characterId), `${snapshot.id} belongs to absent character`)
  assert.equal(snapshot.currentLocationMarkerId, event.locationMarkerId, `${snapshot.id} location mismatch`)
  const key = `${snapshot.eventId}:${snapshot.characterId}`
  assert(!snapshots.has(key), `Duplicate snapshot ${key}`)
  snapshots.set(key, snapshot)
}
for (const event of data.events) for (const characterId of event.involvedCharacterIds) assert(snapshots.has(`${event.id}:${characterId}`), `Missing snapshot for ${characterId} at ${event.id}`)

for (const map of data.mapLayers) {
  requireId(map.imageId, map.id)
  if (map.parentMapId) requireId(map.parentMapId, map.id)
  assert(data.locationMarkers.some(location => location.mapLayerId === map.id), `${map.id} is empty`)
}
for (const map of data.mapLayers.filter(map => map.parentMapId)) {
  const gateways = data.locationMarkers.filter(location => location.linkedMapLayerId === map.id)
  assert.equal(gateways.length, 1, `${map.id} must have exactly one gateway`)
  assert.equal(gateways[0].mapLayerId, map.parentMapId, `${map.id} gateway is on wrong parent`)
}

const entityImages = [
  ...data.characters.map(record => [record.name, record.portraitImageId]),
  ...data.items.map(record => [record.name, record.imageId]),
  ...data.locationMarkers.map(record => [record.name, record.imageId]),
]
for (const [name, imageId] of entityImages) requireId(imageId, name)
assert.equal(new Set(data.characters.map(record => record.portraitImageId)).size, data.characters.length, 'Character portraits are not distinct')
assert.equal(new Set(data.items.map(record => record.imageId)).size, data.items.length, 'Item images are not distinct')

const missingAssets = []
const hashes = new Map()
for (const blob of data.blobs) {
  assert(blob.url.startsWith('library/the-iliad/'), `${blob.id} is not repository hosted`)
  const assetPath = path.join('public', blob.url)
  if (!fs.existsSync(assetPath)) {
    missingAssets.push(blob.url)
    continue
  }
  const bytes = fs.readFileSync(assetPath)
  assert(bytes.length > 10_000, `${blob.url} is implausibly small`)
  const digest = crypto.createHash('sha256').update(bytes).digest('hex')
  assert(!hashes.has(digest), `${blob.url} duplicates ${hashes.get(digest)}`)
  hashes.set(digest, blob.url)
}

const catalogue = JSON.parse(fs.readFileSync('public/library/index.json', 'utf8'))
const entry = catalogue.entries.find(candidate => candidate.id === 'the-iliad')
assert(entry, 'Missing Iliad catalogue entry')
assert.equal(entry.dataBytes, libraryBytes.length, 'Catalogue byte size')
assert.equal(entry.worldId, data.world.id, 'Catalogue world id')
assert.deepEqual(entry.counts, { characters: 52, chapters: 24, events: 75, locations: 17 }, 'Catalogue counts')

const manifest = JSON.parse(fs.readFileSync('scripts/iliad/asset-manifest.json', 'utf8'))
assert.equal(manifest.assets.length, data.blobs.length, 'Manifest asset count')
assert.deepEqual(new Set(manifest.assets.map(asset => asset.id)), new Set(data.blobs.map(blob => blob.id)), 'Manifest image ids')
for (const asset of manifest.assets) {
  const exists = fs.existsSync(path.join('public', asset.path))
  assert.equal(asset.reviewStatus === 'missing', !exists, `${asset.id} manifest existence status`)
}

if (missingAssets.length) {
  console.error(`Missing ${missingAssets.length} expected assets:`)
  for (const asset of missingAssets) console.error(`- ${asset}`)
  process.exitCode = 1
} else {
  console.log(JSON.stringify({ counts: expected, assets: data.blobs.length, bytes: libraryBytes.length, sha256: crypto.createHash('sha256').update(libraryBytes).digest('hex') }, null, 2))
}
