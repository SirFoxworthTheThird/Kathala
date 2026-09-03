import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const libraryFile = path.join(root, 'public', 'library', 'dracula.pwk')
const exampleFile = path.join(root, 'example', 'Dracula.pwk')
const indexFile = path.join(root, 'public', 'library', 'index.json')
const assetRoot = path.join(root, 'public', 'library', 'dracula', 'art')

const characters = {
  'dracula-char-jonathan': 'jonathan',
  'dracula-char-dracula': 'dracula',
  'dracula-char-mina': 'mina',
  'dracula-char-lucy': 'lucy',
  'dracula-char-seward': 'seward',
  'dracula-char-van-helsing': 'van-helsing',
  'dracula-char-arthur': 'arthur',
  'dracula-char-quincey': 'quincey',
  'dracula-char-renfield': 'renfield',
  'dracula-char-mrs-westenra': 'mrs-westenra',
  'dracula-char-hawkins': 'hawkins',
  'dracula-char-sister-agatha': 'sister-agatha',
  'dracula-char-three-women': 'three-women',
  'dracula-char-captain': 'captain',
  'dracula-char-mate': 'mate',
  'dracula-char-swales': 'swales',
  'dracula-char-bilder': 'bilder',
  'dracula-char-bersicker': 'bersicker',
  'dracula-char-nurse': 'attendant',
  'dracula-char-billington': 'billington',
  'dracula-char-snelling': 'snelling',
  'dracula-char-hildesheim': 'hildesheim',
  'dracula-char-skinsky': 'skinsky',
  'dracula-char-czarina-captain': 'donelson',
  'dracula-char-szgany': 'szgany',
}

const items = {
  'dracula-item-journal': 'journal',
  'dracula-item-mina-diary': 'mina-diary',
  'dracula-item-phonograph': 'phonograph',
  'dracula-item-demeter-log': 'demeter-log',
  'dracula-item-letters': 'letters',
  'dracula-item-crucifix': 'crucifix',
  'dracula-item-mirror': 'mirror',
  'dracula-item-keys': 'keys',
  'dracula-item-earth-boxes': 'earth-boxes',
  'dracula-item-garlic': 'garlic',
  'dracula-item-wafer': 'wafer',
  'dracula-item-stake': 'stake',
  'dracula-item-transfusion': 'transfusion',
  'dracula-item-maps': 'maps',
  'dracula-item-kukri': 'kukri',
  'dracula-item-bowie': 'bowie',
  'dracula-item-rifles': 'rifles',
}

const createdAt = Date.UTC(2026, 8, 3)

function verifyPng(filename) {
  const fullPath = path.join(assetRoot, filename)
  if (!fs.existsSync(fullPath)) throw new Error(`Missing generated asset: ${fullPath}`)
  const signature = fs.readFileSync(fullPath).subarray(0, 8).toString('hex')
  if (signature !== '89504e470d0a1a0a') throw new Error(`Not a PNG: ${fullPath}`)
}

function replaceBlob(blobById, assignedUrls, worldId, id, url) {
  const existing = blobById.get(id)
  if (!existing) throw new Error(`Missing existing blob reference: ${id}`)
  Object.assign(existing, {
    worldId,
    mimeType: 'image/png',
    url,
    createdAt,
  })
  assignedUrls.push(url)
}

function updateFile(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  const blobById = new Map(data.blobs.map((blob) => [blob.id, blob]))
  const assignedUrls = []

  if (data.characters.length !== Object.keys(characters).length) {
    throw new Error(`Character manifest mismatch in ${file}: ${data.characters.length}`)
  }
  for (const character of data.characters) {
    const slug = characters[character.id]
    if (!slug) throw new Error(`No portrait assigned to ${character.name}`)
    const filename = `character-${slug}.png`
    verifyPng(filename)
    replaceBlob(blobById, assignedUrls, data.world.id, character.portraitImageId, `library/dracula/art/${filename}`)
  }

  if (data.items.length !== Object.keys(items).length) {
    throw new Error(`Item manifest mismatch in ${file}: ${data.items.length}`)
  }
  for (const item of data.items) {
    const slug = items[item.id]
    if (!slug) throw new Error(`No illustration assigned to ${item.name}`)
    const filename = `item-${slug}.png`
    verifyPng(filename)
    replaceBlob(blobById, assignedUrls, data.world.id, item.imageId, `library/dracula/art/${filename}`)
  }

  if (new Set(assignedUrls).size !== assignedUrls.length) {
    throw new Error(`Every character and item must have a distinct artwork URL in ${file}`)
  }
  const referencedIds = [
    ...data.characters.map(({ portraitImageId }) => portraitImageId),
    ...data.items.map(({ imageId }) => imageId),
  ]
  for (const id of referencedIds) {
    const blob = blobById.get(id)
    if (!blob?.url?.startsWith('library/dracula/art/') || blob.mimeType !== 'image/png') {
      throw new Error(`Invalid final artwork blob in ${file}: ${id}`)
    }
  }

  const serialized = `${JSON.stringify(data)}\n`
  fs.writeFileSync(file, serialized)
  return { data, serialized }
}

const { data, serialized } = updateFile(libraryFile)
updateFile(exampleFile)

const catalogue = JSON.parse(fs.readFileSync(indexFile, 'utf8'))
const entry = catalogue.entries.find(({ id }) => id === 'dracula')
if (!entry) throw new Error('Dracula library entry not found')
entry.dataBytes = Buffer.byteLength(serialized)
fs.writeFileSync(indexFile, `${JSON.stringify(catalogue, null, 2)}\n`)

console.log(`Updated ${data.characters.length} portraits and ${data.items.length} item illustrations`)
console.log(`Updated ${path.relative(root, exampleFile)} while preserving its independent metadata`)
console.log(`Dracula catalogue size: ${entry.dataBytes} bytes`)
