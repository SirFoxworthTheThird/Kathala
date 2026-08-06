import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const files = [
  path.join(root, 'example', 'The Two Towers.pwk'),
  path.join(root, 'public', 'library', 'the-two-towers.pwk'),
]

const rings = 'https://ringsdb.com/bundles/cards'
const beorn = 'https://hallofbeorn.com/Images/Cards'
const ted = 'https://www.tednasmith.com/wp-content/uploads'
const images = {
  // Returning figures from The Fellowship of the Ring.
  billFerny: `${beorn}/Murder-at-the-Prancing-Pony/Bill-Ferny.jpg`,
  deagol: `${ted}/2012/07/TN-Farewell_to_Lorien.jpg`,
  elendil: `${ted}/2012/07/TN-The_Ships_of_the_Faithful.jpg`,
  erestor: `${rings}/10084.png`,
  galdor: `${rings}/10091.png`,
  gilGalad: `${rings}/08007.png`,
  gloin: `${rings}/01003.png`,
  gwaihir: `${rings}/08059.png`,
  harryGoatleaf: `${rings}/303073.png`,
  isildur: `${ted}/2012/07/TN-The_Pillars_of_The_Kings.jpg`,
  radagast: `${rings}/19145.png`,
  saruman: `${rings}/07003.png`,

  // Rohan, Fangorn, the Orc companies, Ithilien, and Cirith Ungol.
  eomer: `${rings}/07001.png`,
  eowyn: `${rings}/01007.png`,
  theoden: `${rings}/06134.png`,
  grima: `${rings}/07002.png`,
  treebeard: `${rings}/08146.png`,
  quickbeam: `${rings}/143006.png`,
  shadowfax: `${rings}/143014.png`,
  erkenbrand: `${rings}/08137.png`,
  hama: `${rings}/04076.png`,
  gamling: `${rings}/144007.png`,
  ugluk: `${ted}/2012/08/TN-Pursuit_in_Rohan.jpg`,
  grishnakh: `${ted}/2012/08/TN-The_Riders_of_Rohan.jpg`,
  mauhur: 'https://s3.amazonaws.com/hallofbeorn-resources/Images/LotR/Cards/DE/The-Uruk-hai-Nightmare/Mauh%C3%BAr.jpg',
  faramir: `${rings}/01014.png`,
  mablung: `${rings}/08084.png`,
  damrod: `${rings}/05010.png`,
  anborn: `${rings}/06114.png`,
  shelob: `${beorn}/The-Land-of-Shadow/Shelob.jpg`,
  shagrat: `${beorn}/The-Mountain-of-Fire/Shagrat.jpg`,
  gorbag: `${beorn}/The-Mountain-of-Fire/Gorbag.jpg`,
  southronCaptain: `${beorn}/The-Sands-of-Harad/Southron-Captain.jpg`,
  oliphaunt: `${beorn}/The-Land-of-Shadow/Oliphaunt.jpg`,

  // Items.
  hornGondor: `${rings}/01042.png`,
  palantir: `${rings}/143020.png`,
  herugrim: `${rings}/143010.png`,
  leafBrooch: `${rings}/08034.png`,
  entDraught: `${rings}/143009.png`,
  orcDraught: `${beorn}/The-Uruk-hai-Nightmare/Orc-draught.jpg`,
}

const characterKeys = {
  '0Heg1WYt4TU59QLmPwIGs': 'gloin',
  '38x8Vr4t86vOx5t-Y60CQ': 'harryGoatleaf',
  'Ca6h5Mi5AkAMkwVDNkT2Y': 'gilGalad',
  'N-B16TGXkiuIqwt0be-vg': 'gwaihir',
  'QRFhfSrTIquPTB7M8xkZi': 'isildur',
  'RP5mMRdvg-whoQIBD73_E': 'radagast',
  'RUaraKzrbkJVs3nBndLqu': 'galdor',
  'b-FdQFgdVO-CKRRGvA1Yg': 'billFerny',
  'kLQ9TiNBdeAWrkOgoq_Vw': 'saruman',
  'l8D-LSQ00Ur6U30y7Jd7X': 'elendil',
  'ldt3iYa9FsynqcGMgbGFh': 'erestor',
  'of6yjH2HRiCF1hpAxPbHN': 'deagol',
  'tt-char-eomer': 'eomer',
  'tt-char-eowyn': 'eowyn',
  'tt-char-theoden': 'theoden',
  'tt-char-grima-wormtongue': 'grima',
  'tt-char-treebeard': 'treebeard',
  'tt-char-quickbeam': 'quickbeam',
  'tt-char-shadowfax': 'shadowfax',
  'tt-char-erkenbrand': 'erkenbrand',
  'tt-char-hama': 'hama',
  'tt-char-gamling': 'gamling',
  'tt-char-ugluk': 'ugluk',
  'tt-char-grishnakh': 'grishnakh',
  'tt-char-mauhur': 'mauhur',
  'tt-char-faramir': 'faramir',
  'tt-char-mablung': 'mablung',
  'tt-char-damrod': 'damrod',
  'tt-char-anborn': 'anborn',
  'tt-char-shelob': 'shelob',
  'tt-char-shagrat': 'shagrat',
  'tt-char-gorbag': 'gorbag',
  'tt-char-southron-captain': 'southronCaptain',
  'tt-char-oliphaunt': 'oliphaunt',
}

const itemKeys = {
  'tt-item-horn-boromir': 'hornGondor',
  'tt-item-palantir': 'palantir',
  'tt-item-herugrim': 'herugrim',
  'tt-item-pippin-brooch': 'leafBrooch',
  'tt-item-ent-draught': 'entDraught',
  'tt-item-orc-draught': 'orcDraught',
  'tt-item-faramir-horn': 'hornGondor',
}

const createdAt = Date.UTC(2026, 7, 6)

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  const usedKeys = new Set([...Object.values(characterKeys), ...Object.values(itemKeys)])

  data.blobs = (data.blobs ?? []).filter(({ id }) => !id.startsWith('tt-linked-art-'))
  data.blobs.push(...[...usedKeys].map((key) => ({
    id: `tt-linked-art-${key}`,
    worldId: data.world.id,
    mimeType: images[key].includes('.png') ? 'image/png' : 'image/jpeg',
    url: images[key],
    createdAt,
  })))

  for (const character of data.characters) {
    const key = characterKeys[character.id]
    if (key) character.portraitImageId = `tt-linked-art-${key}`
  }
  for (const item of data.items) {
    const key = itemKeys[item.id]
    if (key) item.imageId = `tt-linked-art-${key}`
  }

  const blobIds = new Set(data.blobs.map(({ id }) => id))
  const missingCharacters = data.characters.filter(({ portraitImageId }) => !portraitImageId)
  const missingItems = data.items.filter(({ imageId }) => !imageId)
  const unresolvedCharacters = data.characters.filter(({ id, portraitImageId }) =>
    characterKeys[id] && !blobIds.has(portraitImageId))
  const unresolvedItems = data.items.filter(({ id, imageId }) => itemKeys[id] && !blobIds.has(imageId))

  if (missingCharacters.length || missingItems.length || unresolvedCharacters.length || unresolvedItems.length) {
    throw new Error(
      `Artwork validation failed in ${file}: missing characters=${missingCharacters.map(({ name }) => name)}; missing items=${missingItems.map(({ name }) => name)}; unresolved characters=${unresolvedCharacters.map(({ name }) => name)}; unresolved items=${unresolvedItems.map(({ name }) => name)}`,
    )
  }

  fs.writeFileSync(file, JSON.stringify(data))
  console.log(`${path.relative(root, file)}: ${data.characters.length}/${data.characters.length} characters and ${data.items.length}/${data.items.length} items illustrated with ${usedKeys.size} linked images`)
}
