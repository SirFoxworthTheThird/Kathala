import fs from 'node:fs'
import path from 'node:path'

const data = JSON.parse(fs.readFileSync('example/The Iliad.pwk', 'utf8'))
const imageById = new Map(data.blobs.map(blob => [blob.id, blob]))
const entities = new Map()
entities.set(data.world.coverImageId, { category: 'cover', name: data.world.name, description: data.world.description })
for (const map of data.mapLayers) entities.set(map.imageId, { category: 'map', name: map.name, description: map.description })
for (const character of data.characters) entities.set(character.portraitImageId, { category: 'character', name: character.name, description: character.description })
for (const location of data.locationMarkers) entities.set(location.imageId, { category: 'location', name: location.name, description: location.description })
for (const item of data.items) entities.set(item.imageId, { category: 'item', name: item.name, description: item.description })

const replacementNotes = new Map([
  ['iliad-image-cover', 'Replacement required: visual review found a near-photographic finish inconsistent with the painted Neoclassical direction.'],
])

const direction = 'Original painted Neoclassical oil illustration with Late Bronze Age Aegean and Anatolian details; mature historical-book finish and visible brushwork. Avoid photorealism, modern objects, malformed anatomy, unclear limb ownership, bad grips, duplicated objects, pseudo-text, chronological spoilers, and incorrect geography.'
const assets = data.blobs.map(blob => {
  const entity = entities.get(blob.id) ?? { category: 'supporting', name: blob.id, description: 'Supporting story illustration used by Lore or a faction.' }
  const publicPath = path.join('public', blob.url)
  const exists = fs.existsSync(publicPath)
  const replacementNote = replacementNotes.get(blob.id)
  const reviewStatus = !exists ? 'missing' : replacementNote ? 'replacement-required' : 'approved'
  return {
    id: blob.id,
    category: entity.category,
    entity: entity.name,
    path: blob.url,
    prompt: `${direction} Subject: ${entity.name}. ${entity.description} Keep the composition purpose-specific for a PlotWeave ${entity.category} asset. No text or watermark unless legible labels are explicitly required for a navigable map.`,
    reviewStatus,
    reviewNotes: !exists
      ? 'Expected by the PWK but not yet generated or recovered.'
      : replacementNote ?? 'Opened in the September 2026 recovery pass and checked for subject identity, style, historical suitability, anatomy or geometry, duplication, chronology, and obvious rendering defects.',
  }
})

for (const asset of assets) {
  if (!imageById.has(asset.id)) throw new Error(`Unknown image ${asset.id}`)
}

const manifest = {
  story: 'The Iliad',
  source: 'Homer, The Iliad, translated by Samuel Butler, Project Gutenberg eBook 2199',
  direction,
  generatedArtwork: true,
  reviewedAt: '2026-09-11',
  summary: {
    total: assets.length,
    approved: assets.filter(asset => asset.reviewStatus === 'approved').length,
    missing: assets.filter(asset => asset.reviewStatus === 'missing').length,
    replacementRequired: assets.filter(asset => asset.reviewStatus === 'replacement-required').length,
  },
  assets,
}

fs.writeFileSync('scripts/iliad/asset-manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify(manifest.summary, null, 2))
