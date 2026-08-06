import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const files = [
  path.join(root, 'example', 'The Name of the Wind.pwk'),
  path.join(root, 'public', 'library', 'the-name-of-the-wind.pwk'),
]

const dan = 'https://images.squarespace-cdn.com/content/v1/5b9c3f5f9f8770f26af0107f'
const simonetti = 'https://marc-simonetti-shop.myshopify.com/cdn/shop/products'
const images = {
  dan01: `${dan}/1537035149718-31739W39Z9EH4F69HEU9/dandossantos_tnotw_cropped_1.jpg`,
  dan02: `${dan}/1537035153722-WEV6GW7J1ASU8WW4PRHZ/dandossantos_tnotw_cropped_2.jpg`,
  dan05: `${dan}/1537035156800-NWIQK0S48LUAY3TTT0RZ/dandossantos_tnotw_cropped_5.jpg`,
  dan06: `${dan}/1537035157577-SVOD8IHH3K1ZPVATWNWE/dandossantos_tnotw_cropped_6.jpg`,
  dan07: `${dan}/1537035158017-FBNQL7EJEJNA8VVX3GQ1/dandossantos_tnotw_cropped_7.jpg`,
  dan08: `${dan}/1537035146783-SY4GMMN8ZND749UMGF9A/dandossantos_tnotw_cropped_8.jpg`,
  dan09: `${dan}/1537035158543-5UNM4AHR00UDUYRKEZMM/dandossantos_tnotw_cropped_9.jpg`,
  dan10: `${dan}/1537035158845-NTT52IM97PSLORB01A9V/dandossantos_tnotw_cropped_10.jpg`,
  dan11: `${dan}/1537035159355-HU2S5HYWW3YWOT40370S/dandossantos_tnotw_cropped_11.jpg`,
  dan14: `${dan}/1537035160318-IGZ8YJ59I6QHRVOU5W2G/dandossantos_tnotw_cropped_14.jpg`,
  dan15: `${dan}/1537034944582-8GCAI0YZI00Y9GWOHHOV/dandossantos_tnotw_cropped_15.jpg`,
  dan16: `${dan}/1537035161227-NKHXWTR35EQ8CXAX1SWD/dandossantos_tnotw_cropped_16.jpg`,
  dan17: `${dan}/1537035161157-WWC6LL5N99UQUZ0O7DP2/dandossantos_tnotw_cropped_17.jpg`,
  dan18: `${dan}/1537035161940-XMOFXVE5AYUKMR5SKALD/dandossantos_tnotw_cropped_18.jpg`,
  dan19: `${dan}/1537035162045-HM8VI6LYLKOV8J8WEBNP/dandossantos_tnotw_cropped_19.jpg`,
  dan20: `${dan}/1537035162690-R9EONK7UYXJZI7ATPE0L/dandossantos_tnotw_cropped_20.jpg`,
  university: `${simonetti}/University_1200x1200.jpg?v=1580493504`,
  underthing: `${simonetti}/undergrounds_1200x1200.jpg?v=1574360523`,
  worldRoad: `${simonetti}/nameofthewind_1200x1200.jpg?v=1574358352`,
  tarbean: `${simonetti}/streetsoftarbean_1200x1200.jpg?v=1574360467`,
  draccus: `${simonetti}/dragon_1200x1200.jpg?v=1574360378`,
  eolian: `${simonetti}/solo_1200x1200.jpg?v=1584034631`,
  elodinCourt: `${simonetti}/elodin_court_1200x1200.jpg?v=1574360435`,
}

const assignments = {
  'loc-anilin': 'worldRoad',
  'loc-ankers': 'eolian',
  'loc-archives': 'dan10',
  'loc-denner-bluffs': 'dan16',
  'loc-devi': 'dan01',
  'loc-dockside-tavern': 'dan06',
  'loc-edema-road': 'dan02',
  'loc-eolian': 'eolian',
  'loc-fishery': 'dan14',
  'loc-forest-road': 'dan19',
  'loc-great-stone-road': 'worldRoad',
  'loc-greystone-hill': 'dan08',
  'loc-hallowfell': 'dan02',
  'loc-house-of-wind': 'elodinCourt',
  'loc-imre': 'university',
  'loc-imre-docks': 'university',
  'loc-mains': 'university',
  'loc-massacre': 'dan07',
  'loc-masters-hall': 'dan09',
  'loc-mauthen-farm': 'dan17',
  'loc-medica': 'dan01',
  'loc-newarre-road': 'worldRoad',
  'loc-newarre-square': 'dan01',
  'loc-rookery': 'dan11',
  'loc-scrael-camp': 'dan01',
  'loc-stonebridge': 'university',
  'loc-tarbean-hillside': 'tarbean',
  'loc-tarbean-rooftops': 'dan15',
  'loc-tarbean-root': 'tarbean',
  'loc-tarbean-waterside': 'dan05',
  'loc-trapis-cellar': 'underthing',
  'loc-trebon-countryside': 'dan16',
  'loc-trebon-hall': 'draccus',
  'loc-trebon-road': 'worldRoad',
  'loc-trebon-root': 'draccus',
  'loc-trebon-town': 'dan18',
  'loc-underthing': 'underthing',
  'loc-underthing-entrance': 'dan20',
  'loc-university-courtyard': 'elodinCourt',
  'loc-university-root': 'university',
  'loc-waystone-inn': 'dan01',
  'loc-waystone-root': 'dan01',
}

// Prefer the portrait artwork already shipped in the companion .pwb. For
// supporting characters without dedicated portrait art, use a book-specific
// illustration of the scene or place with which they are most closely tied.
const characterAssignments = {
  'notw-char-aaron': 'notw-location-image-dan01',
  'notw-char-abenthy': 'notw-location-image-dan02',
  'notw-char-ambrose': '7dQF1340neJ7FACIwc1av',
  'notw-char-anker': 'notw-location-image-eolian',
  'notw-char-arliden': 'ssdnnG93jmvorlhMupG12',
  'notw-char-arwyl': 'notw-location-image-dan01',
  'notw-char-auri': 'notw-location-image-underthing',
  'notw-char-bast': 'UnjGQzV34BB_gbalMtKzx',
  'notw-char-brandeur': 'notw-location-image-dan09',
  'notw-char-carter': 'notw-location-image-dan01',
  'notw-char-chronicler': 'notw-location-image-dan01',
  'notw-char-cinder': 'JcctoFBt4_XDV9RpXewso',
  'notw-char-denna': 'YAqIcVS6aMVCc0OF9jOlU',
  'notw-char-deoch': 'notw-location-image-eolian',
  'notw-char-devi': 'mbAQhZ7z4lJp8PaDpotLR',
  'notw-char-draccus': 'notw-location-image-draccus',
  'notw-char-elodin': 'WvvFOoQQcMw484XV2HvJw',
  'notw-char-elxa-dal': 'notw-location-image-dan14',
  'notw-char-erlus': 'notw-location-image-dan09',
  'notw-char-fela': 'notw-location-image-university',
  'notw-char-fenton': 'notw-location-image-dan14',
  'notw-char-graham': 'notw-location-image-dan01',
  'notw-char-haliax': 'hHIdW29GKlmKI5hrq8vNi',
  'notw-char-hemme': 'notw-location-image-dan09',
  'notw-char-josn': 'notw-location-image-dan06',
  'notw-char-kaerva': 'notw-location-image-dan19',
  'notw-char-kilvin': 'g05HE-a64WXlhZFCUmfIK',
  'notw-char-kvothe': 'EwQYzAtP8MCzVjM_AVW4n',
  'notw-char-laurian': 'daQgF9OIqf_tlMp74HAwU',
  'notw-char-lorren': 'notw-location-image-dan10',
  'notw-char-mandrag': 'notw-location-image-dan14',
  'notw-char-manet': 'notw-location-image-university',
  'notw-char-master-ash': 'notw-location-image-dan19',
  'notw-char-mhenka': 'notw-location-image-tarbean',
  'notw-char-mola': 'notw-location-image-dan01',
  'notw-char-nina': 'notw-location-image-dan18',
  'notw-char-old-cob': 'notw-location-image-dan01',
  'notw-char-pike': 'notw-location-image-dan15',
  'notw-char-reta': 'notw-location-image-dan05',
  'notw-char-roent': 'notw-location-image-worldRoad',
  'notw-char-schiem': 'notw-location-image-dan18',
  'notw-char-selitos': 'notw-location-image-dan08',
  'notw-char-shandi': 'notw-location-image-dan02',
  'notw-char-shep': 'notw-location-image-dan01',
  'notw-char-simmon': 'Yj6b7jE94RvOH7PcE3vmZ',
  'notw-char-skarpi': 'KLtifaWmrT_HjK5tqyktk',
  'notw-char-skin-dancer': 'notw-location-image-dan01',
  'notw-char-sovoy': 'notw-location-image-university',
  'notw-char-stanchion': 'notw-location-image-eolian',
  'notw-char-tehlu': 'notw-location-image-dan08',
  'notw-char-teren': 'notw-location-image-dan02',
  'notw-char-threpe': 'notw-location-image-eolian',
  'notw-char-tinker': 'notw-location-image-worldRoad',
  'notw-char-trapis': 'notw-location-image-underthing',
  'notw-char-trip': 'notw-location-image-dan02',
  'notw-char-wilem': 'pBP3qwOo-z_xZ5BVHLnSh',
}

const itemAssignments = {
  'notw-item-auri-dress': 'notw-location-image-underthing',
  'notw-item-blood-vial': 'mbAQhZ7z4lJp8PaDpotLR',
  'notw-item-cipher': 'notw-location-image-dan01',
  'notw-item-denner-resin': 'notw-location-image-dan16',
  'notw-item-draccus-book': 'notw-location-image-draccus',
  'notw-item-folly': 'notw-location-image-dan01',
  'notw-item-gram': 'notw-location-image-dan14',
  'notw-item-iron-ring': 'notw-location-image-dan01',
  'notw-item-iron-rod': 'notw-location-image-dan01',
  'notw-item-loden-stone': 'notw-location-image-dan14',
  'notw-item-lute': 'notw-location-image-eolian',
  'notw-item-mauthen-vase': 'notw-location-image-dan17',
  'notw-item-rhetoric': 'notw-location-image-dan02',
  'notw-item-sympathy-lamp': 'notw-location-image-dan14',
  'notw-item-talent-pipes': 'notw-location-image-eolian',
}

const createdAt = 1785974400000
const usedKeys = [...new Set(Object.values(assignments))]

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  const pwbFile = file.replace(/\.pwk$/, '.pwb')
  const companion = JSON.parse(fs.readFileSync(pwbFile, 'utf8'))
  const locationIds = new Set(data.locationMarkers.map(({ id }) => id))
  const missing = data.locationMarkers.filter(({ id }) => !assignments[id])
  const unknown = Object.keys(assignments).filter((id) => !locationIds.has(id))
  if (missing.length || unknown.length) {
    throw new Error(`Location assignment mismatch in ${file}: missing=${missing.map(({ name }) => name)} unknown=${unknown}`)
  }

  data.blobs = (data.blobs ?? []).filter(({ id }) => !id.startsWith('notw-location-image-'))
  data.blobs.push(...usedKeys.map((key) => ({
    id: `notw-location-image-${key}`,
    worldId: data.world.id,
    mimeType: 'image/jpeg',
    url: images[key],
    createdAt,
  })))

  for (const location of data.locationMarkers) {
    location.imageId = `notw-location-image-${assignments[location.id]}`
  }

  for (const character of data.characters) {
    character.portraitImageId = characterAssignments[character.id]
    delete character.imageId
  }

  for (const item of data.items) {
    item.imageId = itemAssignments[item.id]
  }

  const blobIds = new Set([...data.blobs, ...companion.blobs].map(({ id }) => id))
  const unresolved = data.locationMarkers.filter(({ imageId }) => !imageId || !blobIds.has(imageId))
  if (unresolved.length) throw new Error(`Unresolved location images in ${file}: ${unresolved.map(({ name }) => name)}`)
  const unresolvedCharacters = data.characters.filter(({ portraitImageId }) => !portraitImageId || !blobIds.has(portraitImageId))
  if (unresolvedCharacters.length) throw new Error(`Unresolved character images in ${file}: ${unresolvedCharacters.map(({ name }) => name)}`)
  const unresolvedItems = data.items.filter(({ imageId }) => !imageId || !blobIds.has(imageId))
  if (unresolvedItems.length) throw new Error(`Unresolved item images in ${file}: ${unresolvedItems.map(({ name }) => name)}`)

  fs.writeFileSync(file, JSON.stringify(data))
  console.log(`${path.relative(root, file)}: ${data.locationMarkers.length} locations, ${data.characters.length} characters, and ${data.items.length} items illustrated`)
}
