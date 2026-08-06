import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const files = [
  path.join(root, 'example', 'The Fellowship of the Ring.pwk'),
  path.join(root, 'public', 'library', 'the-fellowship-of-the-ring.pwk'),
]

// Published Tolkien illustrations and licensed card paintings. These URL-backed
// blobs keep the download small and avoid film stills or photographic portraits.
const ted = 'https://www.tednasmith.com/wp-content/uploads'
const images = {
  billFerny: 'https://hallofbeorn.com/Images/Cards/Murder-at-the-Prancing-Pony/Bill-Ferny.jpg',
  deagol: `${ted}/2012/07/TN-Farewell_to_Lorien.jpg`,
  elendil: `${ted}/2012/07/TN-The_Ships_of_the_Faithful.jpg`,
  erestor: 'https://ringsdb.com/bundles/cards/10084.png',
  galdor: 'https://ringsdb.com/bundles/cards/10091.png',
  gilGalad: 'https://ringsdb.com/bundles/cards/08007.png',
  gloin: 'https://ringsdb.com/bundles/cards/01003.png',
  gwaihir: 'https://ringsdb.com/bundles/cards/08059.png',
  harryGoatleaf: 'https://ringsdb.com/bundles/cards/303073.png',
  isildur: `${ted}/2012/07/TN-The_Pillars_of_The_Kings.jpg`,
  radagast: 'https://ringsdb.com/bundles/cards/19145.png',
  saruman: 'https://ringsdb.com/bundles/cards/07003.png',
}

const assignments = {
  'lotr-char-bill-ferny': 'billFerny',
  'lotr-char-deagol': 'deagol',
  'lotr-char-elendil': 'elendil',
  'lotr-char-erestor': 'erestor',
  'lotr-char-galdor-of-the-havens': 'galdor',
  'lotr-char-gil-galad': 'gilGalad',
  'lotr-char-gloin': 'gloin',
  'lotr-char-gwaihir': 'gwaihir',
  'lotr-char-harry-goatleaf': 'harryGoatleaf',
  'lotr-char-isildur': 'isildur',
  'lotr-char-radagast-the-brown': 'radagast',
  'lotr-char-saruman-the-white': 'saruman',
}

const createdAt = Date.UTC(2026, 7, 6)

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  const usedKeys = new Set(Object.values(assignments))

  data.blobs = (data.blobs ?? []).filter(({ id }) => !id.startsWith('fotr-character-art-'))
  data.blobs.push(...[...usedKeys].map((key) => ({
    id: `fotr-character-art-${key}`,
    worldId: data.world.id,
    mimeType: images[key].endsWith('.png') ? 'image/png' : 'image/jpeg',
    url: images[key],
    createdAt,
  })))

  for (const character of data.characters) {
    const key = assignments[character.id]
    if (key) character.portraitImageId = `fotr-character-art-${key}`
  }

  const urlBlobIds = new Set(data.blobs.map(({ id }) => id))
  const missing = data.characters.filter(({ portraitImageId }) => !portraitImageId)
  const unresolvedAdded = data.characters.filter(({ id, portraitImageId }) =>
    assignments[id] && !urlBlobIds.has(portraitImageId))

  if (missing.length || unresolvedAdded.length) {
    throw new Error(
      `Character artwork validation failed in ${file}: missing=${missing.map(({ name }) => name)} unresolved=${unresolvedAdded.map(({ name }) => name)}`,
    )
  }

  fs.writeFileSync(file, JSON.stringify(data))
  console.log(`${path.relative(root, file)}: ${data.characters.length}/${data.characters.length} characters illustrated; ${usedKeys.size} linked paintings added`)
}
