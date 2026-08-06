import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const files = [
  path.join(root, 'example', "Harry Potter and the Philosopher's Stone.pwk"),
  path.join(root, 'public', 'library', 'harry-potter-and-the-philosopher-s-stone.pwk'),
]

const hogwartsGroundsMap = {
  layerId: 'hp-map-hogwarts-grounds',
  url: 'https://preview.redd.it/map-of-hogwarts-v0-0u5dx87xhcoz.jpg?width=1080&crop=smart&auto=webp&s=3910e014226745cd957926376cfbd6ce303e85db',
  width: 1080,
  height: 1437,
}

const base = 'https://contentful.harrypotter.com/usf1vwtuqyxm'
const images = {
  astronomy: `${base}/4K3Ae6KSLYeUgqCgwEsKE4/4f3ea3ec50324b542c535bebffb158a0/HP1_Hogwarts_South_elevation01.jpg?fm=jpg&q=75&w=914`,
  blackLake: `${base}/4giMx4DeeaCMyu9O1gnCdq/0da2c3fbf76153e2ac72520563c44511/minalima-philosophers-stone-2-hagrid-hogwarts.jpg?fm=jpg&q=75&w=914`,
  charms: `${base}/3qDq1So6CseO6ek4MyuE0a/41f1755b77c83e22252a91e31297447c/FiliusFlitwick_PM_B1C10M2_CharmsClass_Moment.jpg?fm=jpg&q=75&w=914`,
  diagonAlley: `${base}/1qSF1jZiDCcSKEEqUWsUga/5a3235c98816ea2726a9151d24238785/JimKay-Harry-Potter-Diagon-Alley.jpg?fm=jpg&q=75&w=914`,
  diagonShops: `${base}/dWN4WIGK3mh8r38y7LtKz/6637be0adcfbf65dc33f21d8d3c463c0/CRM_IMAGE.jpg?fm=jpg&q=75&w=914`,
  flourishBlotts: `${base}/Lj71bKK7BDUlbOgDUwJsh/6e6497bfbeb955ed7bd190a08985e8ff/POSTCARD_MYSTERY_SERIES_02_SPELLBINDING_SHOPS_DIAGON_ALLEY_FINAL_VISUAL_POSTCARD_2_FLOREAN_FORTESCUES_ICE_CREAM_PARLOUR_FLOU.jpg?fm=jpg&q=75&w=914`,
  gringotts: `${base}/17jjHiBNnywmamQ0g0kAIm/6f791b18f029ec22175fec3f57d02653/Goblin_1_.gif?fm=jpg&q=75&w=914`,
  gringottsVaults: `${base}/2g7IizxkriA2aWkY8osi2C/6176892c13f3859f8d30223e7714d023/7.26.1_Gringotts_Colour_04CB.jpg?fm=jpg&q=75&w=914`,
  ollivanders: `${base}/1LjSguWKC53JrGF53BqxNC/78d070229948cced5511aa489b7b653e/POSTCARD_MYSTERY_SERIES_02_SPELLBINDING_SHOPS_DIAGON_ALLEY_FINAL_VISUAL_POSTCARD_1_OLLIVANDERS.jpg?fm=jpg&q=75&w=914`,
  castle: `${base}/6yVf73NTFK0UCUSKWqcOag/d8e6c15e4500aa4e1e74c0d074e51bef/Hogwarts_PM_B1C8M1_ChangingStaircases_Moment.jpg?fm=jpg&q=75&w=914`,
  greatHall: `${base}/2sLwPSOVqoOyCkEgSk0Oek/2a8885b787d86f7bed89e84cf2aa28d5/MinervaMcGonagall_PM_B1C7M2_HarryPotterBeingSortedInGreatHall_Moment.jpg?fm=jpg&q=75&w=914`,
  greatHallCup: `${base}/4Wa2HR97aUemEiI4K2OIOG/28e457f1e3f31feafcf5ef7b9b52b68a/GreatHall_PM_B1C17M3_gryffindorWinningHouseCup_Moment.jpg?fm=jpg&q=75&w=914`,
  gryffindor: `${base}/3CFEHFHpxecymOAiIikmMe/45c1d9b912789769ab4d39dc30de5f2b/Gryffindor.jpg?fm=jpg&q=75&w=914`,
  hagridsHut: `${base}/1ERSda92XiUgGWICymMgc6/5f3dff987a43cf997de4b85867bd662f/HagridsHut_WB_F3_BuckbeaksExecutionAtHagridsHut_Illust_100615_Land.jpg?fm=jpg&q=75&w=914`,
  flying: `${base}/60t884svRYyYUKMgqcImmG/025ec9bf5b967458cf0c3d62eee123d3/HarryPotter_PM_B1C9M1_HarryChasingRemembrall_Moment.jpg?fm=jpg&q=75&w=914`,
  bathroom: `${base}/4V7Pl9aRzqkiq2oqwQg2G2/f2e247fb8781a80e222f2acbc9eda50a/Hogwarts_PM_B1C10M3_TrollInBathroom_Moment.jpg?fm=jpg&q=75&w=914`,
  forest: `${base}/h9j8438ZjTzjfVviIoDZE/20cdc7e2ebcb406ce4af22e36f4dc128/SS_CH14_274_275-high-res-rgb.jpg?fm=jpg&q=75&w=914`,
  forbiddenForest: `https://media.minalima.com/2024/04/book-print-frame-hpib01print_2-1024x1024.jpg`,
  godricsHollow: `${base}/1Gti482aitlE2GBDPCZG2K/7501d66437d6e1ca6cbb81bdbbbc7f84/godrics-hollow_2_1800x1248.png?fit=pad&fm=jpg&h=416&q=75&w=600`,
  library: `${base}/2x2S2N2CKcgoyy2Y8kWU2w/3e350efbd1fce522fa8d2a90df17425a/HogwartsLibrary_PM_B1C14M1_HarryHermioneAndRonInTheLibrary_Moment.jpg?fm=jpg&q=75&w=914`,
  hospital: `${base}/9Ix8YjdI2pIQgFjpV2naQ/f6f59c74636eb0549e6e606100792d87/harry-dumbledore-hospital-wing.jpg?fm=jpg&q=75&w=914`,
  hutRock: `${base}/5bItFB6zWx88mil4hoRSB4/79c60b83a94767eb5fcee69822dd637e/minalima-philosophersstone-hutontherock.jpg?fm=jpg&q=75&w=914`,
  mirror: `${base}/2uo8UV2ZCMIyuYI6KSwo0g/ce1d7d9cd78c8613492fbdd721d4a734/MirrorOfErised_PM_B1C12M3_HarryInFrontOfTheMirrorOfErised_Moment.jpg?fm=jpg&q=75&w=914`,
  mirrorQuirrell: `${base}/2n98D1IUsE22Iyc6uySeis/ee6f76e220a34516615b4b032c009feb/MirrorOfErised_PM_B1C17M1_QuirrellAndHarryInFrontOfTheMirrorOfErised_Moment.jpg?fm=jpg&q=75&w=914`,
  potions: `${base}/4VcPqGNA3SMkW6sk6UookA/0635f76dc4ebd019b0f4764c980d0ea4/B1C8M2.jpg?fm=jpg&q=75&w=914`,
  privetDrive: `${base}/2bWtikP9Jroa8MUr43F0v/5ac507a8bafb5487c8c13d2e98254d2e/minalima-philosophers-stone-1-dumbledore.jpg?fm=jpg&q=75&w=914`,
  privetLetters: `${base}/4S2KM3GrW0I0acmMgyY4Y2/7f83101b28c4b2b923cec62fae6afb1c/PrivetDrive_PM_B1C3M1_LettersInKitchen_Moment.jpg?fm=jpg&q=75&w=914`,
  thirdFloor: `${base}/5qmPShs9AAymeQkCSwEWcQ/34d0d4e6c6333d531a17c2b03386a9cc/Fluffy_PM_B1C9M3_ForbiddenCorridorDoorClosed_Moment.jpg?fm=jpg&q=75&w=914`,
  thirdFloorFluffy: `${base}/1RIQX30ygosgsKsY4w4IWU/f3bd382fd8d4d7710157f0ce00eb0b0d/Fluffy_PM_B1C9M3_ForbiddenCorridorFluffy_Moment.jpg?fm=jpg&q=75&w=914`,
  trophyRoom: `${base}/27wvfoopzagOUWyUQCAmm2/5ed7a9950d82ef1b67e62c24adf0b4cd/Hogwarts_PM_B1C9M2_TrophyRoom_Moment.jpg?fm=jpg&q=75&w=914`,
  chess: `${base}/Myl8eD9Z6MAEECw2KqyEQ/f72d19cfa5ef339ada1b61c58a51a3ad/McGonagallsOffice_PM_B1C16M2_WizardsChessInMcGonagallsOffice_Moment.jpg?fm=jpg&q=75&w=914`,
  train: `${base}/26kJFyXKJSslPMU0zrMRIH/a1aa431fe7e42d87ca614ea3cd51a8ca/minalima-philosophers-stone-hogwarts-express.jpg?fm=jpg&q=75&w=914`,
  zoo: `https://www.hp-lexicon.org/wp-content/uploads/2016/01/harry-potter-book-1-ch02.jpg`,
}

const assignments = {
  'loc-astronomy-tower': 'astronomy',
  'loc-black-lake': 'blackLake',
  'loc-boathouse': 'blackLake',
  'loc-charms-classroom': 'charms',
  'loc-diagon-alley': 'diagonAlley',
  'loc-diagon-alley-entrance': 'diagonAlley',
  'loc-entrance-hall': 'castle',
  'loc-flourish-blotts': 'flourishBlotts',
  'loc-flying-lawn': 'flying',
  'loc-forbidden-forest': 'forbiddenForest',
  'loc-girls-bathroom': 'bathroom',
  'loc-godrics-hollow': 'godricsHollow',
  'loc-great-hall': 'greatHall',
  'loc-gringotts': 'gringotts',
  'loc-gringotts-vaults': 'gringottsVaults',
  'loc-gryffindor-common-room': 'gryffindor',
  'loc-gryffindor-tower': 'gryffindor',
  'loc-hagrids-hut': 'hagridsHut',
  'loc-hogsmeade-station': 'train',
  'loc-hogwarts-castle': 'astronomy',
  'loc-hogwarts-express': 'train',
  'loc-hogwarts-library': 'library',
  'loc-hogwarts-root': 'blackLake',
  'loc-hospital-wing': 'hospital',
  'loc-hut-rock': 'hutRock',
  'loc-kings-cross': 'train',
  'loc-leaky-cauldron': 'diagonAlley',
  'loc-london-root': 'privetDrive',
  'loc-london-zoo': 'zoo',
  'loc-madam-malkins': 'diagonShops',
  'loc-mirror-chamber': 'mirrorQuirrell',
  'loc-ollivanders': 'ollivanders',
  'loc-platform-nine': 'train',
  'loc-potions-classroom': 'potions',
  'loc-privet-drive': 'privetLetters',
  'loc-quality-quidditch': 'diagonShops',
  'loc-quidditch-pitch': 'flying',
  'loc-third-floor': 'thirdFloor',
  'loc-trophy-room': 'trophyRoom',
  'loc-underground-chambers': 'chess',
}

const createdAt = 1785888000000
const usedKeys = [...new Set(Object.values(assignments))]

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  const locations = data.locationMarkers ?? []
  const groundsLayer = data.mapLayers.find(({ id }) => id === hogwartsGroundsMap.layerId)
  const groundsBlob = data.blobs.find(({ id }) => id === groundsLayer?.imageId)
  if (!groundsLayer || !groundsBlob) throw new Error(`Missing Hogwarts Grounds map image in ${file}`)
  groundsLayer.imageWidth = hogwartsGroundsMap.width
  groundsLayer.imageHeight = hogwartsGroundsMap.height
  groundsBlob.url = hogwartsGroundsMap.url
  groundsBlob.mimeType = 'image/jpeg'

  const actualIds = new Set(locations.map((location) => location.id))
  const missingAssignments = locations.filter((location) => !assignments[location.id])
  const unknownAssignments = Object.keys(assignments).filter((id) => !actualIds.has(id))
  if (missingAssignments.length || unknownAssignments.length) {
    throw new Error(`Location assignment mismatch in ${file}: missing=${missingAssignments.map(({ id }) => id)} unknown=${unknownAssignments}`)
  }

  data.blobs = (data.blobs ?? []).filter(({ id }) => !id.startsWith('hp-location-image-'))
  data.blobs.push(...usedKeys.map((key) => ({
    id: `hp-location-image-${key}`,
    worldId: data.world.id,
    mimeType: 'image/jpeg',
    url: images[key],
    createdAt,
  })))

  for (const location of locations) {
    location.imageId = `hp-location-image-${assignments[location.id]}`
  }

  const blobIds = new Set(data.blobs.map(({ id }) => id))
  const unresolved = locations.filter(({ imageId }) => !imageId || !blobIds.has(imageId))
  if (unresolved.length) throw new Error(`Unresolved location images in ${file}: ${unresolved.map(({ id }) => id)}`)

  fs.writeFileSync(file, JSON.stringify(data))
  console.log(`${path.relative(root, file)}: ${locations.length} locations, ${usedKeys.length} linked illustrations`)
}
