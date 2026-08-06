import fs from 'node:fs'

const P = 'treasure-island'
const worldId = `${P}-world`
const timelineId = `${P}-timeline-main`
const now = 1786057200000
const base = { worldId, createdAt: now, updatedAt: now }
const id = (kind, slug) => `${P}-${kind}-${slug}`
const chId = n => id('chapter', String(n).padStart(2, '0'))
const charId = slug => id('char', slug)
const itemId = slug => id('item', slug)
const locId = slug => id('loc', slug)
const mapId = slug => id('map', slug)
const imageId = slug => id('image', slug)
const threadId = slug => id('thread', slug)
const motifId = slug => id('motif', slug)
const directImages = {
  cover: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Treasure_Island-Scribner%27s-1911.jpg/1280px-Treasure_Island-Scribner%27s-1911.jpg',
  'map-atlantic': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Chart_of_the_Atlantic_Ocean%2C_with_the_British%2C_French%2C_%26_Spanish_settlements_in_North_America%2C_and_the_West_Indies_-_as_also_on_the_coast_of_Africa_%2818348541541%29.jpg/1280px-thumbnail.jpg',
  'map-bristol': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Bristolharbourmap.png/1280px-Bristolharbourmap.png',
  'map-ship': 'https://upload.wikimedia.org/wikipedia/commons/4/44/Danish_Naval_Schooner_Diana_%28Plan%29_1863.jpg',
  'map-island': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Treasure-island-map.jpg/1280px-Treasure-island-map.jpg',
  jim: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/TI-JimHawkins.jpg/1280px-TI-JimHawkins.jpg',
  silver: 'https://upload.wikimedia.org/wikipedia/commons/b/b3/N._C._Wyeth_-_Long_John_Silver_%26_Jim_Hawkins.jpg',
  billy: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/TI-billy.jpg/1280px-TI-billy.jpg',
  'black-dog': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/TI-BlackDog.jpg/1280px-TI-BlackDog.jpg',
  pew: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/TI-blindpew.jpg/1280px-TI-blindpew.jpg',
  gunn: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/TI-Gunn.jpg/1280px-TI-Gunn.jpg',
  hands: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/TI-Israel.jpg/1280px-TI-Israel.jpg',
  smollett: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/TI-Smollett_%28restored%29.jpg/1280px-TI-Smollett_%28restored%29.jpg',
  stockade: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/TI-stockade.jpg/1280px-TI-stockade.jpg',
  treasure: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/TI-treasure.jpg/1280px-TI-treasure.jpg',
  'black-spot': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/TI-BlackSpot.jpg/1280px-TI-BlackSpot.jpg',
  knife: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/TI-knife.jpg/1280px-TI-knife.jpg',
  parrot: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/TI-parrot.jpg/1280px-TI-parrot.jpg',
  mutiny: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/TI-PreparingFormutiny.jpg/1280px-TI-PreparingFormutiny.jpg',
  hostage: 'https://upload.wikimedia.org/wikipedia/commons/3/39/N._C._Wyeth_-_Treasure_Island_-_The_Hostage.jpg',
  departure: 'https://upload.wikimedia.org/wikipedia/commons/2/22/N._C._Wyeth_-_Treasure_Island_-_Jim_Hawkins_leaves_home.jpg',
  'bones-routs': 'https://upload.wikimedia.org/wikipedia/commons/1/10/N._C._Wyeth_-_Captain_Bones_routs_Black_Dog.jpg',
  'chapter-10': 'https://upload.wikimedia.org/wikipedia/commons/3/30/Treasure_Island_Chapter_10.png',
  'ship-fight': 'https://upload.wikimedia.org/wikipedia/commons/8/86/Treasure-island03.png',
}
const blob = (slug, _file, _width = 960, mimeType = 'image/jpeg') => ({ id: imageId(slug), worldId, mimeType, url: directImages[slug], createdAt: now })

const blobs = [
  blob('cover', "Treasure Island-Scribner's-1911.jpg", 960),
  blob('map-atlantic', 'Chart of the Atlantic Ocean, with the British, French, & Spanish settlements in North America, and the West Indies - as also on the coast of Africa (18348541541).jpg', 1280),
  blob('map-bristol', 'Bristolharbourmap.png', 1280, 'image/png'),
  blob('map-ship', 'Danish Naval Schooner Diana (Plan) 1863.jpg', 1280),
  blob('map-island', 'Treasure-island-map.jpg', 1280),
  blob('jim', 'TI-JimHawkins.jpg', 720),
  blob('silver', 'N. C. Wyeth - Long John Silver & Jim Hawkins.jpg', 720),
  blob('billy', 'TI-billy.jpg', 720),
  blob('black-dog', 'TI-BlackDog.jpg', 720),
  blob('pew', 'TI-blindpew.jpg', 720),
  blob('gunn', 'TI-Gunn.jpg', 720),
  blob('hands', 'TI-Israel.jpg', 720),
  blob('smollett', 'TI-Smollett (restored).jpg', 720),
  blob('stockade', 'TI-stockade.jpg', 720),
  blob('treasure', 'TI-treasure.jpg', 720),
  blob('black-spot', 'TI-BlackSpot.jpg', 720),
  blob('knife', 'TI-knife.jpg', 720),
  blob('parrot', 'TI-parrot.jpg', 720),
  blob('mutiny', 'TI-PreparingFormutiny.jpg', 720),
  blob('hostage', 'N. C. Wyeth - Treasure Island - The Hostage.jpg', 720),
  blob('departure', 'N. C. Wyeth - Treasure Island - Jim Hawkins leaves home.jpg', 720),
  blob('bones-routs', 'N. C. Wyeth - Captain Bones routs Black Dog.jpg', 720),
  blob('chapter-10', 'Treasure Island Chapter 10.png', 720, 'image/png'),
  blob('ship-fight', 'Treasure-island03.png', 720, 'image/png'),
]

const mapLayers = [
  { ...base, id: mapId('atlantic'), parentMapId: null, name: 'Britain and the Atlantic Passage', description: 'The journey begins on the western English coast, gathers its expedition in Bristol, and crosses the Atlantic toward an unnamed island.', imageId: imageId('map-atlantic'), imageWidth: 1280, imageHeight: 977, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '' },
  { ...base, id: mapId('bristol'), parentMapId: mapId('atlantic'), name: 'Bristol Harbour', description: 'The busy port where Trelawney outfits the expedition, hires the crew, and anchors the Hispaniola before departure.', imageId: imageId('map-bristol'), imageWidth: 1280, imageHeight: 329, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '' },
  { ...base, id: mapId('hispaniola'), parentMapId: mapId('atlantic'), name: 'The Hispaniola', description: 'An editorial deck plan based on a historical schooner, used to follow the voyage, mutiny, and Jim’s struggle for the ship.', imageId: imageId('map-ship'), imageWidth: 1100, imageHeight: 264, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '' },
  { ...base, id: mapId('island'), parentMapId: mapId('atlantic'), name: 'Treasure Island', description: 'Stevenson’s 1883 map of the island, including the anchorages, hills, marsh, stockade, and marked treasure sites.', imageId: imageId('map-island'), imageWidth: 1280, imageHeight: 2276, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '' },
]

const locationMarkers = []
function location(slug, map, name, description, x, y, iconType = 'landmark', linked = null, artwork = null) {
  locationMarkers.push({ ...base, id: locId(slug), mapLayerId: mapId(map), linkedMapLayerId: linked ? mapId(linked) : null, name, description, x, y, iconType, tags: [], factionId: null, imageId: artwork ? imageId(artwork) : null })
}

location('admiral-benbow', 'atlantic', 'Admiral Benbow Inn', 'A lonely coastal inn kept by Jim Hawkins’s family, overlooking a cove and the road used by unwelcome seafaring visitors.', 1140, 790, 'building', null, 'billy')
location('bristol-entrance', 'atlantic', 'Bristol', 'A prosperous western port of shipyards, taverns, merchants, and sailors where the treasure expedition is assembled.', 1160, 815, 'city', 'bristol', 'departure')
location('hispaniola-entrance', 'atlantic', 'The Hispaniola at Sea', 'The expedition’s schooner on its long Atlantic passage from Bristol to the island.', 790, 545, 'ship', 'hispaniola', 'chapter-10')
location('island-entrance', 'atlantic', 'Treasure Island', 'A remote, unhealthy island of wooded slopes, tidal creeks, marsh, and old pirate works.', 430, 360, 'island', 'island', 'treasure')

location('trelawney-lodgings', 'bristol', 'Trelawney’s Bristol Lodgings', 'Rooms used by the squire while he purchases the Hispaniola and recruits sailors for the voyage.', 590, 160, 'building', null, 'departure')
location('spyglass', 'bristol', 'The Spy-glass Tavern', 'Long John Silver’s clean and lively waterfront tavern, crowded with sailors and dominated by its one-legged proprietor.', 780, 180, 'tavern', null, 'silver')
location('bristol-quay', 'bristol', 'Bristol Quay', 'The working quay where stores, weapons, and crew are brought aboard before the Hispaniola sails.', 945, 155, 'harbor', null, 'chapter-10')
location('ship-berth', 'bristol', 'Hispaniola’s Berth', 'The schooner’s final berth in Bristol before she drops downriver for the Atlantic.', 1080, 165, 'ship', 'hispaniola', 'chapter-10')

location('ship-deck', 'hispaniola', 'Main Deck', 'The open working deck where watches are kept, orders given, and control of the schooner openly contested.', 560, 132, 'deck', null, 'ship-fight')
location('ship-roundhouse', 'hispaniola', 'Round-house', 'The officers’ sheltered quarters and council space at the stern of the schooner.', 170, 132, 'room', null, 'smollett')
location('ship-cabin', 'hispaniola', 'Captain’s Cabin', 'The captain’s sheltered quarters at the stern, close to the wheel and officers’ working spaces.', 225, 132, 'room', null, 'hands')
location('ship-hold', 'hispaniola', 'Hold and Magazine', 'The storage space for powder, arms, food, and expedition supplies below deck.', 520, 82, 'storage', null, 'mutiny')
location('ship-galley', 'hispaniola', 'Galley', 'Silver’s working domain aboard ship, where the sea-cook builds trust while quietly organizing the mutiny.', 380, 132, 'room', null, 'silver')
location('apple-barrel', 'hispaniola', 'Apple Barrel', 'A nearly empty provision barrel kept on deck near the galley, large enough for a small boy to sit inside.', 470, 170, 'object', null, 'mutiny')
location('forecastle', 'hispaniola', 'Forecastle', 'The crew’s quarters near the bow, occupied by the hands Silver has gathered around him.', 930, 132, 'room', null, 'mutiny')

location('north-inlet', 'island', 'North Inlet', 'A narrow northern anchorage screened by wooded shores and approached through difficult coastal water.', 600, 1510, 'harbor', null, 'map-island')
location('spyglass-hill', 'island', 'Spy-glass Hill', 'The island’s dominant central height, visible from the anchorages and used as a guide across the interior.', 330, 1275, 'mountain', null, 'map-island')
location('mizzenmast-hill', 'island', 'Mizzenmast Hill', 'A wooded rise in the island’s southern interior, crossed during the search for Flint’s marked site.', 390, 895, 'mountain', null, 'map-island')
location('foremast-hill', 'island', 'Foremast Hill', 'One of the island’s named heights, lying beside the northern arm of the island.', 285, 1690, 'mountain', null, 'map-island')
location('anchorage', 'island', 'Captain Kidd’s Anchorage', 'A sheltered eastern roadstead where the Hispaniola first lies off the island.', 745, 1380, 'harbor', null, 'chapter-10')
location('swamp', 'island', 'Eastern Marsh', 'Hot, stagnant ground around the anchorage whose vapours and water quickly weaken the crews.', 610, 1190, 'swamp', null, 'gunn')
location('stockade', 'island', 'Stockade and Spring', 'A stout log-house within a timber enclosure, built beside reliable fresh water and defensible from every side.', 430, 1115, 'fort', null, 'stockade')
location('landing', 'island', 'Stockade Landing', 'The exposed shore used by the loyal party’s overloaded jolly-boat during the evacuation from the Hispaniola.', 690, 1095, 'shore', null, 'ship-fight')
location('ben-gunn-cave', 'island', 'Ben Gunn’s Cave', 'A dry, concealed cave with a view of the anchorage, used by the maroon as refuge and storehouse.', 315, 975, 'cave', null, 'gunn')
location('coracle-cache', 'island', 'Coracle Cache', 'A hidden place beneath the white rock where Ben Gunn keeps his small skin-and-wood boat.', 720, 980, 'shore', null, 'gunn')
location('hispaniola-grounded', 'island', 'North Inlet Beach', 'A tidal northern shore where deep water gives way to sand, trees, and a narrow approach from the inlet.', 665, 1540, 'ship', null, 'hands')
location('alan-site', 'island', 'Wooded Shore', 'Dense coastal woodland where sightlines are short and distant voices carry between the trees.', 590, 1270, 'forest', null, 'mutiny')
location('tom-site', 'island', 'Forest Clearing', 'A quiet opening ringed by mature trees beyond the first landing beach.', 470, 1230, 'forest', null, 'knife')
location('skeleton', 'island', 'Inland Clearing', 'A narrow clearing among tall timber on the inland route north of the stockade.', 420, 1370, 'landmark', null, 'treasure')
location('treasure-pit', 'island', 'Flint’s Treasure Ground', 'A stand of tall trees near the bearings and marks recorded on Flint’s chart.', 405, 1125, 'landmark', null, 'treasure')

const characterDefs = [
  ['jim', 'Jim Hawkins', ['Jim'], 'The innkeeper’s son whose curiosity, courage, and impulsive decisions carry him from the Admiral Benbow to the centre of the mutiny.', 'jim', '#cf9b4a', true],
  ['mother', 'Mrs Hawkins', ['Jim’s mother'], 'The practical keeper of the Admiral Benbow who insists on taking only the money honestly owed from Billy Bones’s chest.', 'departure', '#8a6a55', true],
  ['father', 'Mr Hawkins', ['Jim’s father'], 'The ailing innkeeper whose decline leaves Jim and his mother exposed to Billy Bones and his pursuers.', 'billy', '#77706c', false],
  ['billy', 'Billy Bones', ['the captain'], 'A scarred former mate of Captain Flint who hides at the Admiral Benbow with the dead pirate’s papers.', 'billy', '#79513d', false],
  ['black-dog', 'Black Dog', [], 'A two-fingered pirate who locates Billy Bones and survives their violent reunion.', 'black-dog', '#4f4740', true],
  ['pew', 'Blind Pew', ['Pew'], 'A blind and terrifying pirate messenger who delivers the black spot and commands the raid on the inn.', 'pew', '#625c59', false],
  ['livesey', 'Dr Livesey', ['Doctor Livesey'], 'A physician, magistrate, and veteran who becomes the expedition’s calm strategist and medical officer.', 'smollett', '#527a76', true],
  ['trelawney', 'Squire Trelawney', ['the squire'], 'An enthusiastic landowner whose money launches the expedition, though his loose talk helps Silver recruit the crew.', 'departure', '#8c684a', true],
  ['smollett', 'Captain Alexander Smollett', ['Captain Smollett'], 'The professional captain of the Hispaniola, suspicious of the voyage’s secrecy and exacting in defence of his loyal crew.', 'smollett', '#405b6b', true],
  ['silver', 'Long John Silver', ['Barbecue', 'the sea-cook'], 'A charismatic one-legged sea-cook and former Flint quartermaster who balances leadership of the mutiny against his own survival.', 'silver', '#816846', true],
  ['parrot', 'Captain Flint', ['Silver’s parrot'], 'Silver’s green parrot, named after the old pirate captain and trained to cry fragments of buccaneering speech.', 'parrot', '#56834d', true],
  ['redruth', 'Tom Redruth', [], 'Trelawney’s elderly gamekeeper and a loyal member of the shore party.', 'stockade', '#805e45', false],
  ['gray', 'Abraham Gray', ['Gray'], 'An honest seaman who breaks from the mutineers when Smollett calls the loyal hands aft.', 'stockade', '#596d72', true],
  ['gunn', 'Ben Gunn', [], 'A marooned former pirate who has survived alone for three years and holds the island’s decisive secret.', 'gunn', '#8c7955', true],
  ['hands', 'Israel Hands', [], 'The Hispaniola’s coxswain and an experienced pirate who remains aboard after the mutiny.', 'hands', '#69564a', false],
  ['anderson', 'Job Anderson', [], 'The ship’s boatswain and one of Silver’s chief mutineers during the attack on the stockade.', 'mutiny', '#70463d', false],
  ['merry', 'George Merry', [], 'An openly hostile pirate who challenges Silver’s authority when the treasure hunt collapses.', 'black-spot', '#7a4d3e', false],
  ['dick', 'Dick Johnson', ['Dick'], 'A young mutineer whose failing health and fear of Flint’s ghost expose the pirates’ crumbling confidence.', 'mutiny', '#8b765c', true],
  ['morgan', 'Tom Morgan', [], 'An older pirate who once sailed with Flint and joins Silver’s mutiny.', 'mutiny', '#6f5b4a', true],
  ['arrow', 'Mr Arrow', ['the mate'], 'The Hispaniola’s unreliable first mate, whose secret drinking ends in his disappearance at sea.', 'chapter-10', '#63727a', false],
  ['hunter', 'John Hunter', ['Hunter'], 'One of Trelawney’s servants and a loyal defender of the stockade.', 'stockade', '#667a55', false],
  ['joyce', 'Richard Joyce', ['Joyce'], 'Trelawney’s quiet valet, inexperienced in battle but steadfast at the stockade.', 'stockade', '#6c725c', false],
  ['alan', 'Alan', [], 'An honest sailor murdered after refusing to join the mutiny.', 'mutiny', '#6e7374', false],
  ['tom', 'Tom', [], 'A loyal seaman who rejects Silver’s offer and pays for that refusal in the island woods.', 'knife', '#6d685c', false],
  ['flint', 'Captain J. Flint', ['Captain Flint'], 'The dead buccaneer whose buried plunder, violent reputation, and old crew govern the living characters’ choices.', 'treasure', '#443f3a', false],
]
const characters = characterDefs.map(([slug, name, aliases, description, portrait, color, isAlive]) => ({ ...base, id: charId(slug), name, aliases, description, portraitImageId: imageId(portrait), color, tags: [], isAlive, birthDate: null }))

const itemDefs = [
  ['treasure-map', 'Flint’s Treasure Map', 'The island chart marked with bearings, memoranda, and three red crosses, one identifying the main cache.', 'map', 'map-island'],
  ['sea-chest', 'Billy Bones’s Sea Chest', 'The tarred chest containing clothes, instruments, coins, and the oilskin packet sought by Flint’s former crew.', 'chest', 'billy'],
  ['black-spot', 'The Black Spot', 'A circular pirate summons cut from printed paper and used to depose or condemn a leader.', 'document', 'black-spot'],
  ['oilskin', 'Oilskin Packet', 'The sealed bundle removed from Billy Bones’s chest and opened at Dr Livesey’s house.', 'package', 'billy'],
  ['logbook', 'Flint’s Account Book', 'A coded record of ships, dates, and accumulated sums that demonstrates the scale of Flint’s plunder.', 'book', 'treasure'],
  ['coins', 'Billy Bones’s Coins', 'A mixed hoard of foreign coinage from many voyages, used by Mrs Hawkins to calculate the inn’s debt.', 'treasure', 'treasure'],
  ['spyglass', 'Silver’s Spyglass', 'A brass telescope suited to a sea-cook who knows ships, harbours, and men better than he first admits.', 'tool', 'silver'],
  ['weapons', 'Muskets and Pistols', 'The firearms shifted aft before the mutiny and later distributed among the defenders of the stockade.', 'weapon', 'stockade'],
  ['powder', 'Powder and Ammunition', 'The expedition’s gunpowder and shot, moved away from the suspect crew and guarded by Smollett’s party.', 'resource', 'stockade'],
  ['union-jack', 'Union Jack', 'The flag raised over the stockade by Captain Smollett as an open declaration of lawful command.', 'flag', 'smollett'],
  ['jolly-roger', 'Jolly Roger', 'The pirate flag raised above the Hispaniola after the mutineers seize her.', 'flag', 'ship-fight'],
  ['coracle', 'Ben Gunn’s Coracle', 'A tiny hide-covered boat, light enough to carry but extremely difficult to steer in open water.', 'boat', 'gunn'],
  ['ben-boat', 'Ben Gunn’s Boat', 'The small craft later used to transport treasure between the island and the recovered schooner.', 'boat', 'gunn'],
  ['treasure', 'Flint’s Treasure', 'Bars, coins, and valuables accumulated through piracy and concealed on the island before Flint’s death.', 'treasure', 'treasure'],
  ['cheese', 'Parmesan Cheese', 'A piece of cheese carried by Livesey and promised to the cheese-starved Ben Gunn.', 'food', 'gunn'],
]
const items = itemDefs.map(([slug, name, description, iconType, artwork]) => ({ ...base, id: itemId(slug), name, description, iconType, imageId: imageId(artwork), tags: [] }))

location('livesey-house', 'atlantic', 'Dr Livesey’s House', 'The doctor’s orderly country house, where Billy Bones’s papers are examined and the treasure expedition is agreed.', 1150, 800, 'building', null, 'smollett')

const chapterDefs = [
  ['The Old Sea-dog at the Admiral Benbow', 'Billy Bones settles at the Hawkins family inn and hires Jim to watch for a one-legged sailor.'],
  ['Black Dog Appears and Disappears', 'Black Dog finds Billy, and their private argument ends in a sword fight and collapse.'],
  ['The Black Spot', 'After Jim’s father dies, Blind Pew delivers the pirates’ summons and Billy Bones dies.'],
  ['The Sea Chest', 'Jim and his mother open Billy’s chest while the pirates approach the inn.'],
  ['The Last of the Blind Man', 'Pew’s gang raids the Admiral Benbow, but revenue officers scatter them and Pew is killed.'],
  ['The Captain’s Papers', 'Livesey and Trelawney examine Flint’s account book and treasure map and resolve to sail.'],
  ['I Go to Bristol', 'Weeks later Jim travels to Bristol and sees the Hispaniola prepared for sea.'],
  ['At the Sign of the Spy-glass', 'Jim meets Long John Silver, who convincingly explains Black Dog’s escape.'],
  ['Powder and Arms', 'Captain Smollett objects to the crew, the leaked purpose of the voyage, and the placement of arms.'],
  ['The Voyage', 'The Hispaniola sails; Arrow disappears and Jim comes to admire Silver’s skill and good humour.'],
  ['What I Heard in the Apple Barrel', 'Hidden among the apples, Jim hears Silver explain the mutiny and recruit Dick.'],
  ['Council of War', 'Jim warns the loyal leaders, who decide to conceal their knowledge until the right moment.'],
  ['How My Shore Adventure Began', 'At the island Jim impulsively joins a shore party, then slips away from Silver’s men.'],
  ['The First Blow', 'Silver murders Tom after Alan’s death reveals that the mutiny has begun.'],
  ['The Man of the Island', 'Jim meets the marooned Ben Gunn and learns that the castaway has valuable information.'],
  ['Narrative Continued by the Doctor: How the Ship Was Abandoned', 'Livesey finds the stockade while Smollett calls the loyal sailors away from the mutineers.'],
  ['Narrative Continued by the Doctor: The Jolly-boat’s Last Trip', 'The loyal party overloads the jolly-boat, loses supplies, and struggles ashore under fire.'],
  ['Narrative Continued by the Doctor: End of the First Day’s Fighting', 'The retreat to the stockade costs Tom Redruth his life, while the defenders establish their position.'],
  ['Narrative Resumed by Jim Hawkins: The Garrison in the Stockade', 'Jim rejoins the defenders and tells them about Ben Gunn as the first night closes in.'],
  ['Silver’s Embassy', 'Silver offers terms at the stockade and Smollett refuses to surrender the map.'],
  ['The Attack', 'The mutineers storm the stockade and are driven off at heavy cost to the defenders.'],
  ['How My Sea Adventure Began', 'Jim leaves the stockade without permission, finds Ben Gunn’s coracle, and heads for the ship.'],
  ['The Ebb-tide Runs', 'Jim cuts the Hispaniola’s cable and the ebb tide carries ship and coracle into the night.'],
  ['The Cruise of the Coracle', 'After a night adrift, Jim works around the island and approaches the drifting schooner.'],
  ['I Strike the Jolly Roger', 'Jim boards the Hispaniola, lowers the pirate flag, and finds Hands wounded beside a dead sailor.'],
  ['Israel Hands', 'Jim and Hands sail for North Inlet until Hands attacks and Jim shoots him from the rigging.'],
  ['Pieces of Eight', 'Jim returns to the stockade at night and discovers that Silver’s pirates now occupy it.'],
  ['In the Enemy’s Camp', 'Silver protects Jim as a hostage while the pirates question their captain’s failing leadership.'],
  ['The Black Spot Again', 'The mutineers depose Silver, but the treasure map restores his command and changes their purpose.'],
  ['On Parole', 'Livesey visits the camp, treats the sick pirates, and privately urges Jim to escape.'],
  ['The Treasure-hunt—Flint’s Pointer', 'The pirates march inland and discover a skeleton arranged as a compass toward the treasure.'],
  ['The Treasure-hunt—The Voice Among the Trees', 'Ben Gunn’s imitation of Flint terrifies the pirates until Silver forces them onward.'],
  ['The Fall of a Chieftain', 'The treasure pit is empty, Merry turns on Silver, and the loyal party springs its ambush.'],
  ['And Last', 'Ben Gunn’s secret is explained, the treasure is loaded, three pirates are marooned, and the survivors sail home.'],
]
const chapters = chapterDefs.map(([title, synopsis], index) => ({ ...base, id: chId(index + 1), timelineId, number: index + 1, title, synopsis, notes: '', wordGoal: null }))

const eventDefs = []
let clock = 100
function event(chapter, title, description, loc, states, options = {}) {
  const elapsed = options.elapsed ?? 0.05
  clock += elapsed
  eventDefs.push({ chapter, title, description, loc, states, items: options.items ?? [], mentioned: options.mentioned ?? [], threads: options.threads ?? [], motifs: options.motifs ?? [], tension: options.tension ?? 2, elapsed, pov: options.pov ?? 'jim', dead: options.dead ?? [], flashback: options.flashback ?? false, time: Math.floor(clock), beat: options.beat ?? null })
}

event(1, 'The Captain Takes a Room', 'Billy Bones arrives with his sea chest, chooses the Admiral Benbow for its isolation, and pays Jim to watch for a one-legged sailor.', 'admiral-benbow', {
  jim: 'Studies the scarred stranger and accepts a monthly coin for keeping watch along the coast.',
  billy: 'Claims the best room, establishes his daily lookout, and warns Jim about a one-legged seaman.',
  mother: 'Receives a rough long-term guest whose small advance does not match his demands.',
  father: 'Continues running the inn despite illness and unease about the new lodger.',
}, { items: ['sea-chest', 'coins'], threads: ['map', 'silver'], motifs: ['watching', 'money'], tension: 2, elapsed: 0 })
event(1, 'Livesey Defies Billy Bones', 'The drunken captain silences the common room with threats, but Dr Livesey refuses to be intimidated and warns him against further drinking.', 'admiral-benbow', {
  jim: 'Watches the doctor answer the captain’s knife with calm legal authority.',
  billy: 'Draws a knife when contradicted, then backs down before Livesey’s warning as magistrate.',
  livesey: 'Finishes treating Jim’s father and firmly limits Billy’s drinking and violence.',
  father: 'Rests under the doctor’s care while disorder spreads through his inn.',
}, { threads: ['authority'], motifs: ['law'], tension: 3, elapsed: 30 })

event(2, 'Black Dog Confronts the Captain', 'Black Dog waits for Billy, blocks his retreat, and presses him about their former shipmates and Flint’s papers.', 'admiral-benbow', {
  jim: 'Obeys the stranger’s demand to hide and hears fragments of the pirates’ quarrel.',
  billy: 'Recognizes Black Dog, tries to control the meeting, and refuses the pressure placed upon him.',
  'black-dog': 'Corners his former shipmate and tests whether threats will recover Flint’s secret.',
}, { threads: ['map', 'pirates'], motifs: ['watching'], tension: 4, elapsed: 6 })
event(2, 'Black Dog Escapes', 'The argument erupts into a sword fight; Black Dog flees wounded and Billy collapses from a stroke.', 'admiral-benbow', {
  jim: 'Calls for Livesey after seeing Billy fall in the doorway.',
  billy: 'Chases Black Dog into the road, misses a killing stroke, and collapses after the exertion.',
  'black-dog': 'Escapes along the road with a bleeding shoulder and his purpose unfulfilled.',
  livesey: 'Bleeds Billy and diagnoses the danger of another bout of rum.',
}, { threads: ['map', 'authority'], motifs: ['violence'], tension: 4, elapsed: 0.02 })

event(3, 'Jim Loses His Father', 'Jim’s father dies after a worsening illness, leaving Jim and his mother to face Billy Bones and the failing inn alone.', 'admiral-benbow', {
  jim: 'Mourns his father while assuming more responsibility for the inn.',
  mother: 'Faces bereavement and the inn’s debts without her husband’s help.',
  father: 'Dies at home after the doctor’s treatment can no longer sustain him.',
}, { dead: ['father'], motifs: ['home'], tension: 3, elapsed: 5 })
event(3, 'Pew Delivers the Black Spot', 'Blind Pew grips Jim’s arm, forces him to lead the way to Billy, and leaves the pirate summons in Billy’s palm.', 'admiral-benbow', {
  jim: 'Guides the blind stranger under duress and recoils from his sudden strength.',
  billy: 'Receives the black spot and calculates that he has only until ten o’clock.',
  pew: 'Uses helplessness as disguise, terrorizes Jim, and delivers the crew’s deadline.',
}, { items: ['black-spot'], threads: ['map', 'pirates'], motifs: ['blindness', 'time'], tension: 5, elapsed: 4 })
event(3, 'Billy Bones Dies', 'Billy tries to flee with the treasure papers but another seizure kills him before he can leave the inn.', 'admiral-benbow', {
  jim: 'Finds the captain dead and realizes that the pirates will soon return for the chest.',
  billy: 'Falls dead beside the inn’s counter with Flint’s secret still concealed upstairs.',
  mother: 'Recognizes that the unpaid bill and approaching danger must now be handled immediately.',
}, { dead: ['billy'], items: ['sea-chest', 'black-spot'], threads: ['map'], motifs: ['time', 'death'], tension: 4, elapsed: 0.02 })

event(4, 'The Village Refuses Help', 'Jim and his mother ask their neighbours to help defend the inn, but fear of Flint’s crew limits them to a horse and warnings.', 'admiral-benbow', {
  jim: 'Runs from door to door and learns how completely Pew’s gang has frightened the district.',
  mother: 'Rejects flight without the money owed to her family and returns to the inn.',
}, { threads: ['pirates'], motifs: ['home', 'money'], tension: 3, elapsed: 0.04 })
event(4, 'The Sea Chest Is Opened', 'Mrs Hawkins counts the inn’s debt from Billy’s mixed coins while Jim takes the oilskin packet before the pirates arrive.', 'admiral-benbow', {
  jim: 'Searches the chest, secures the sealed packet, and hears the blind man’s tapping stick outside.',
  mother: 'Counts exactly what the dead captain owed, refusing to steal even under immediate threat.',
}, { items: ['sea-chest', 'coins', 'oilskin'], threads: ['map'], motifs: ['money', 'time'], tension: 5, elapsed: 0.02 })

event(5, 'The Inn Is Ransacked', 'Pew directs the pirates through the empty inn, but the missing packet sends them into a frantic search.', 'admiral-benbow', {
  pew: 'Commands the raid, curses his companions’ fear, and demands that they find Flint’s papers.',
  'black-dog': 'Searches Billy’s room and chest while urging escape from the approaching officers.',
}, { items: ['sea-chest'], threads: ['map', 'pirates'], motifs: ['blindness', 'time'], tension: 5, elapsed: 0.02, pov: null })
event(5, 'Pew Is Run Down', 'Revenue officers ride into the pirates’ retreat; the gang scatters and the abandoned Pew is struck and killed on the road.', 'admiral-benbow', {
  jim: 'Emerges from hiding with the packet safe and watches the officers restore order.',
  mother: 'Recovers from her faint after escaping with only the money owed.',
  pew: 'Loses his bearings in the road and dies beneath the officers’ horses.',
}, { dead: ['pew'], items: ['oilskin'], threads: ['map', 'authority'], motifs: ['blindness', 'law'], tension: 5, elapsed: 0.02 })

event(6, 'Flint’s Account Is Read', 'Livesey and Trelawney open the packet and identify an account of enormous pirate takings.', 'livesey-house', {
  jim: 'Delivers the packet and listens as the coded entries reveal the scale of Flint’s career.',
  livesey: 'Examines the papers methodically and recognizes evidence of repeated piracy.',
  trelawney: 'Responds to the account with immediate enthusiasm for a treasure expedition.',
}, { items: ['oilskin', 'logbook'], threads: ['map', 'expedition'], motifs: ['documents', 'money'], tension: 2, elapsed: 0.12 })
event(6, 'The Treasure Map Is Revealed', 'The second paper proves to be a detailed island chart with bearings and crosses marking Flint’s cache.', 'livesey-house', {
  jim: 'Sees the island take shape as a real destination rather than a pirate rumour.',
  livesey: 'Accepts the voyage but warns Trelawney to keep the purpose secret.',
  trelawney: 'Commits his money and energy to buying a ship and gathering a crew in Bristol.',
}, { items: ['treasure-map'], threads: ['map', 'expedition'], motifs: ['documents'], tension: 3, elapsed: 0.01, beat: 'inciting_incident' })

event(7, 'Jim Leaves the Admiral Benbow', 'After weeks of preparation, Jim says goodbye to his mother and travels with Redruth toward Bristol.', 'admiral-benbow', {
  jim: 'Leaves home with excitement, carrying the memory of the inn into an uncertain voyage.',
  mother: 'Entrusts her son to the expedition while remaining to rebuild the family business.',
  redruth: 'Takes charge of Jim’s journey and Trelawney’s instructions for reaching Bristol.',
}, { threads: ['expedition'], motifs: ['home'], tension: 1, elapsed: 20 })
event(7, 'The Hispaniola Is Ready', 'Trelawney shows Jim the purchased schooner and praises the one-legged sea-cook who helped recruit her crew.', 'bristol-quay', {
  jim: 'Sees the Hispaniola for the first time and eagerly absorbs the bustle of the harbour.',
  trelawney: 'Proudly presents the ship, stores, and crew he has assembled with Silver’s assistance.',
  redruth: 'Delivers Jim safely and turns to the practical work of loading the expedition.',
}, { items: ['treasure-map', 'weapons', 'powder'], mentioned: ['silver'], threads: ['expedition', 'silver'], motifs: ['ships'], tension: 2, elapsed: 1 })

event(8, 'Jim Meets Long John Silver', 'At the Spy-glass, Jim meets the cheerful one-legged landlord and briefly wonders whether this could be Billy’s feared sailor.', 'spyglass', {
  jim: 'Compares Silver with Billy’s warning and is disarmed by the tavern-keeper’s openness.',
  silver: 'Greets Jim warmly, displays command of the room, and begins building the boy’s trust.',
  parrot: 'Perches near Silver and punctuates the tavern noise with pirate cries.',
}, { items: ['spyglass'], threads: ['silver'], motifs: ['performance', 'watching'], tension: 2, elapsed: 0.04 })
event(8, 'Black Dog Slips Away', 'Jim recognizes Black Dog among the customers, but the pirate escapes while Silver turns the incident into proof of his innocence.', 'spyglass', {
  jim: 'Raises the alarm and explains Black Dog’s connection to Billy Bones.',
  silver: 'Orders a pursuit, ridicules the unpaid bill, and persuades Jim that he shares the boy’s alarm.',
  'black-dog': 'Uses the crowded quay to escape another attempt at capture.',
}, { threads: ['silver', 'pirates'], motifs: ['performance', 'watching'], tension: 3, elapsed: 0.01 })

event(9, 'Smollett States His Objections', 'Captain Smollett tells Trelawney and Livesey that the crew knows too much, the voyage feels unsafe, and the treasure secret has spread.', 'ship-roundhouse', {
  smollett: 'Risks dismissal by giving an honest professional assessment of ship, crew, and leaked purpose.',
  trelawney: 'Takes the captain’s criticism personally but cannot dismiss its practical force.',
  livesey: 'Mediates between captain and owner and tests each objection for evidence.',
  jim: 'Hears that nearly every sailor knows more about the treasure than he should.',
}, { threads: ['expedition', 'mutiny'], motifs: ['authority', 'secrecy'], tension: 3, elapsed: 0.04 })
event(9, 'Arms Are Shifted Aft', 'Smollett orders powder, weapons, and the loyal party’s berths moved away from the main crew.', 'ship-hold', {
  smollett: 'Reorganizes the ship so trusted men can defend the stern if his suspicions prove correct.',
  trelawney: 'Accepts the changes while remaining angry at the implication that his recruits are unsafe.',
  livesey: 'Supports the precautions and preserves cooperation between captain and squire.',
  gray: 'Works with the crew to shift stores without yet knowing why the captain insists.',
}, { items: ['weapons', 'powder'], threads: ['mutiny'], motifs: ['authority', 'weapons'], tension: 3, elapsed: 0.03 })

event(10, 'The Hispaniola Sails', 'The schooner leaves Bristol, and Silver leads the crew in a shanty as the expedition begins its Atlantic passage.', 'ship-deck', {
  jim: 'Begins life at sea, excited by the ship’s movement and the promise of the island.',
  silver: 'Animates the crew, performs loyalty, and makes himself useful to officers and hands alike.',
  smollett: 'Takes the ship out under disciplined sail while continuing to watch the recruited crew.',
  arrow: 'Starts the voyage as mate but fails to maintain authority over the men.',
}, { threads: ['expedition', 'mutiny'], motifs: ['ships', 'songs'], tension: 2, elapsed: 1 })
event(10, 'Mr Arrow Disappears', 'Arrow’s secret drunkenness worsens until he vanishes overboard during a dark night.', 'ship-deck', {
  jim: 'Observes the mate’s decline and accepts the crew’s assumption that he fell into the sea.',
  arrow: 'Ends his unreliable service by disappearing overboard during the passage.',
  smollett: 'Fills the gap in command and keeps the voyage moving despite the loss of his mate.',
  silver: 'Maintains his helpful public role while his allies gain influence among the crew.',
}, { dead: ['arrow'], threads: ['mutiny'], motifs: ['secrecy', 'ships'], tension: 3, elapsed: 18 })
event(10, 'Silver Teaches Jim Seamanship', 'During the passage Silver shares stories, explains the ship, and lets Jim visit the parrot in the galley.', 'ship-galley', {
  jim: 'Treats Silver as a trusted friend and learns eagerly from his experience.',
  silver: 'Cultivates Jim’s affection while concealing his authority over the mutineers.',
  parrot: 'Repeats cries of “pieces of eight,” linking Silver’s friendly galley to Flint’s violent past.',
}, { threads: ['silver'], motifs: ['performance', 'songs'], tension: 1, elapsed: 12 })

event(11, 'Silver Explains His Plan', 'Hidden in the apple barrel, Jim hears Silver describe his service under Flint and his intention to wait until the treasure is aboard.', 'apple-barrel', {
  jim: 'Stays perfectly still while discovering that his trusted friend commands the conspiracy.',
  silver: 'Explains that disciplined patience will let the pirates seize ship and treasure together.',
  dick: 'Listens as Silver converts him from uncertainty to active participation in the mutiny.',
  hands: 'Supports Silver’s strategy while pressing for the eventual death of the loyal party.',
}, { threads: ['mutiny', 'silver'], motifs: ['secrecy', 'watching'], tension: 5, elapsed: 3 })
event(11, 'Land Is Sighted', 'The island appears just after the conspiracy is exposed, forcing Jim to leave the barrel and carry his warning carefully.', 'ship-deck', {
  jim: 'Escapes the barrel without revealing what he knows and looks upon the dangerous island ahead.',
  silver: 'Identifies the anchorage from Flint’s old chart and publicly helps Smollett navigate.',
  smollett: 'Orders the approach while reading tension in the crew he already distrusts.',
  trelawney: 'Celebrates reaching the destination without yet knowing how close the mutiny is.',
}, { items: ['treasure-map'], threads: ['map', 'mutiny'], motifs: ['watching', 'ships'], tension: 4, elapsed: 0.04 })

event(12, 'Jim Warns the Leaders', 'Jim tells Livesey, Trelawney, and Smollett everything he heard in the apple barrel.', 'ship-roundhouse', {
  jim: 'Repeats Silver’s words and identifies the men whose allegiance he can infer.',
  livesey: 'Assesses the warning calmly and places Jim where he can continue observing the crew.',
  trelawney: 'Admits that Smollett judged the crew more accurately than he did.',
  smollett: 'Counts the reliable men and concludes that patience is their only immediate advantage.',
}, { threads: ['mutiny'], motifs: ['secrecy', 'authority'], tension: 4, elapsed: 0.02 })
event(12, 'The Loyal Party Waits', 'The leaders agree to hide their knowledge, keep the map secure, and use Jim to learn the mutineers’ next move.', 'ship-roundhouse', {
  jim: 'Accepts a dangerous role as observer among men who still believe him unsuspecting.',
  livesey: 'Plans around limited numbers and the need to avoid provoking the full crew.',
  trelawney: 'Subordinates his pride to Smollett’s command for the coming crisis.',
  smollett: 'Maintains ordinary shipboard routine while preparing for a contest of timing.',
}, { items: ['treasure-map', 'weapons'], threads: ['map', 'mutiny'], motifs: ['time', 'secrecy'], tension: 4, elapsed: 0.01, beat: 'midpoint' })

event(13, 'The Crew Goes Ashore', 'Smollett grants shore leave to defuse the restless crew, and Silver leads most of the mutineers into the boats.', 'anchorage', {
  jim: 'Watches the balance of men shift toward shore and decides to join at the last instant.',
  silver: 'Leads the shore parties while preserving the appearance of an ordinary holiday.',
  smollett: 'Uses leave to divide the mutineers and gain time aboard the Hispaniola.',
}, { threads: ['mutiny'], motifs: ['time', 'ships'], tension: 3, elapsed: 0.12 })
event(13, 'Jim Slips into the Woods', 'Once the boat grounds, Jim leaps out, outruns the pirates, and disappears into the island’s vegetation.', 'alan-site', {
  jim: 'Acts without orders, seeking freedom to scout before Silver can control him.',
  silver: 'Calls after Jim but remains with the men whose loyalty he must secure.',
  dick: 'Lands with Silver’s party and moves inland under pirate leadership.',
  morgan: 'Joins the armed shore party and watches Jim escape beyond reach.',
}, { threads: ['mutiny', 'jim-independence'], motifs: ['watching', 'wilderness'], tension: 4, elapsed: 0.01 })

event(14, 'Alan Is Murdered', 'A distant cry tells Jim that an honest sailor has refused the mutiny and been killed.', 'alan-site', {
  jim: 'Freezes in the woods as the death cry confirms that the conspiracy has become open murder.',
  alan: 'Refuses to join Silver’s men and is killed out of Jim’s sight.',
  silver: 'Allows violence to enforce the mutiny while moving to confront another loyal sailor.',
}, { dead: ['alan'], threads: ['mutiny'], motifs: ['violence', 'wilderness'], tension: 5, elapsed: 0.02 })
event(14, 'Silver Kills Tom', 'Tom condemns Alan’s murder and walks away; Silver brings him down and kills him with a knife.', 'tom-site', {
  jim: 'Witnesses Silver’s speed and brutality, losing the last of his earlier admiration.',
  silver: 'Drops his crutch, attacks with calculated force, and silences a second loyal sailor.',
  tom: 'Rejects Silver’s authority and dies after choosing loyalty over personal safety.',
}, { dead: ['tom'], threads: ['mutiny', 'silver'], motifs: ['violence', 'performance'], tension: 5, elapsed: 0.01 })

event(15, 'Jim Meets Ben Gunn', 'A ragged figure follows Jim through the trees and reveals himself as Ben Gunn, marooned for three years.', 'ben-gunn-cave', {
  jim: 'Overcomes his fear of the strange castaway and begins testing whether Gunn can help the loyal party.',
  gunn: 'Begs for Christian food, boasts of wealth, and treats Jim as his first route back to society.',
}, { threads: ['gunn-secret', 'jim-independence'], motifs: ['wilderness', 'money'], tension: 2, elapsed: 0.04 })
event(15, 'Ben Gunn Offers a Bargain', 'Gunn hints that he has found something important, asks for a share and passage home, and points out his hidden boat.', 'coracle-cache', {
  jim: 'Recognizes that Gunn’s secret and boat may change the struggle for ship and treasure.',
  gunn: 'Offers information in exchange for protection, money, and a return to England.',
}, { items: ['coracle', 'cheese'], threads: ['gunn-secret', 'map'], motifs: ['secrecy', 'money'], tension: 3, elapsed: 0.02 })

event(16, 'Livesey Finds the Stockade', 'From aboard ship, Livesey scouts the shore and discovers Flint’s old stockade, its spring, and its defensive value.', 'stockade', {
  livesey: 'Inspects the fortification and recognizes it as the loyal party’s best refuge from the larger pirate force.',
  hunter: 'Rows and scouts with the doctor while keeping watch for Silver’s shore parties.',
}, { pov: 'livesey', threads: ['stockade'], motifs: ['wilderness', 'authority'], tension: 3, elapsed: 0.02 })
event(16, 'Smollett Calls the Loyal Hands', 'Smollett confronts the men left aboard and gives any honest sailor a final chance to come aft; Gray breaks from the mutineers.', 'ship-deck', {
  smollett: 'Names the mutiny openly and offers protection to any man willing to return to duty.',
  gray: 'Endures blows from the pirates, then runs aft and commits himself to the captain.',
  trelawney: 'Covers Gray’s escape with the other armed defenders at the stern.',
  livesey: 'Returns from scouting with a defensible destination for the loyal party.',
}, { pov: 'livesey', items: ['weapons', 'powder'], threads: ['mutiny', 'stockade'], motifs: ['authority', 'weapons'], tension: 4, elapsed: 0.02 })

event(17, 'The Jolly-boat Is Overloaded', 'Smollett’s party makes its last trip from the Hispaniola with too many men and stores for the small boat.', 'landing', {
  livesey: 'Balances the need for ammunition against the jolly-boat’s dangerously low freeboard.',
  smollett: 'Directs the evacuation while holding the boat on course under the ship’s guns.',
  trelawney: 'Takes up his musket as the mutineers aboard prepare to fire.',
  redruth: 'Guards his companions and the remaining powder during the exposed crossing.',
  gray: 'Rows for shore as a newly trusted member of the loyal party.',
}, { pov: 'livesey', items: ['weapons', 'powder'], threads: ['stockade'], motifs: ['ships', 'weapons'], tension: 4, elapsed: 0.02 })
event(17, 'The Boat Swamps Under Fire', 'A shot from Trelawney drives the mutineers from the ship’s gun, but the overloaded boat grounds and sinks with much of the powder.', 'landing', {
  livesey: 'Reaches shallow water and salvages what supplies he can while exposed to shore attack.',
  smollett: 'Gets his men out of the sinking boat and immediately forms them for the retreat.',
  trelawney: 'Uses his marksmanship to disrupt the cannon crew before wading ashore.',
  gray: 'Saves weapons from the water and joins the defensive line.',
}, { pov: 'livesey', items: ['weapons', 'powder'], threads: ['stockade'], motifs: ['ships', 'time'], tension: 5, elapsed: 0.01 })

event(18, 'Redruth Falls in the Retreat', 'The loyal party runs for the stockade, exchanges fire with the mutineers, and loses Redruth to a musket ball.', 'stockade', {
  livesey: 'Treats Redruth but can only remain with him through his final moments.',
  redruth: 'Dies reassured that he served the squire faithfully in the first shore battle.',
  trelawney: 'Grieves for his old servant and asks forgiveness for bringing him into the expedition.',
  smollett: 'Secures the enclosure despite the emotional and tactical cost of the retreat.',
  gray: 'Helps drive the attackers back and proves his loyalty under fire.',
}, { pov: 'livesey', dead: ['redruth'], items: ['weapons'], threads: ['stockade'], motifs: ['death', 'loyalty'], tension: 5, elapsed: 0.02 })
event(18, 'The Flag Is Raised', 'Smollett runs up the Union Jack over the stockade and refuses to lower it despite the ship’s cannon fire.', 'stockade', {
  smollett: 'Asserts lawful command with a visible flag even though it gives the pirates a target.',
  livesey: 'Organizes medical supplies and watches the cannon shots fall around the fort.',
  trelawney: 'Accepts Smollett’s discipline and prepares for a siege rather than a treasure hunt.',
  hunter: 'Takes a firing position inside the enclosure and checks the log-house defences.',
  joyce: 'Learns his post and waits anxiously for a direct attack.',
}, { pov: 'livesey', items: ['union-jack', 'weapons'], threads: ['stockade', 'authority'], motifs: ['flags', 'authority'], tension: 3, elapsed: 0.02 })

event(19, 'Jim Reaches the Stockade', 'Jim follows the sound of fighting, enters the fort, and reunites with the surviving loyal party.', 'stockade', {
  jim: 'Returns from his unauthorized scouting with news of Silver’s murders and Ben Gunn.',
  livesey: 'Welcomes Jim safely back and questions him closely about the maroon.',
  smollett: 'Adds Jim’s information to his estimate of the enemy and the island.',
  trelawney: 'Receives Jim with relief after believing him lost among the mutineers.',
}, { threads: ['gunn-secret', 'stockade'], motifs: ['home', 'secrecy'], tension: 3, elapsed: 0.06 })
event(19, 'The Garrison Endures the Night', 'The defenders divide watches, eat sparingly, and listen to drunken pirate songs from the marshy camp below.', 'stockade', {
  jim: 'Takes his place in the garrison while privately thinking about Gunn’s hidden coracle.',
  livesey: 'Monitors wounds and the unhealthy air surrounding the pirate camp.',
  smollett: 'Assigns watches and turns the mixed party into an organized defensive crew.',
  hunter: 'Keeps guard beside the log-house after the exhausting retreat.',
  joyce: 'Settles into his first night under siege with his musket ready.',
}, { threads: ['stockade', 'jim-independence'], motifs: ['songs', 'watching'], tension: 2, elapsed: 0.25 })

event(20, 'Silver Approaches Under Truce', 'Silver comes to the stockade as “Captain Silver” and asks to negotiate for the treasure map.', 'stockade', {
  jim: 'Sees his former friend transformed into the mutineers’ elected captain.',
  silver: 'Uses the white flag and polished speech to seek the map without another costly assault.',
  smollett: 'Forces Silver to wait outside and refuses to recognize his pirate rank.',
  livesey: 'Observes the exchange and the weakening condition of Silver’s men.',
}, { items: ['treasure-map'], threads: ['map', 'stockade', 'silver'], motifs: ['performance', 'authority'], tension: 4, elapsed: 0.25 })
event(20, 'Smollett Rejects the Terms', 'Silver offers safe passage for the map; Smollett instead demands unconditional surrender and drives him away enraged.', 'stockade', {
  jim: 'Listens as negotiation collapses and prepares for the attack Silver promises.',
  silver: 'Loses his diplomatic composure when Smollett offers only chains and a fair trial.',
  smollett: 'Uses the parley to demonstrate confidence and deny the pirates any claim to equality.',
  trelawney: 'Takes his assigned loophole after the captain predicts an immediate assault.',
}, { items: ['treasure-map', 'weapons'], threads: ['map', 'stockade'], motifs: ['law', 'weapons'], tension: 4, elapsed: 0.01 })

event(21, 'The Stockade Is Stormed', 'Musket fire covers a rush across the fence, and the pirates force their way into close combat around the log-house.', 'stockade', {
  jim: 'Fires from his loophole, then retreats inside when attackers cross the enclosure.',
  smollett: 'Commands the defence until two musket wounds leave him unable to continue fighting.',
  trelawney: 'Uses his accuracy from the log-house before joining the close defence.',
  livesey: 'Fights beside the others while preparing to treat whoever survives the rush.',
  gray: 'Meets the attackers hand to hand and becomes the defenders’ strongest active fighter.',
  anderson: 'Leads the pirate charge into the stockade and closes on Jim with a cutlass.',
}, { items: ['weapons'], threads: ['stockade'], motifs: ['violence', 'weapons'], tension: 5, elapsed: 0.25 })
event(21, 'The Defenders Hold', 'Gray kills Anderson, the surviving pirates flee, and the loyal party counts Joyce dead and Hunter mortally injured.', 'stockade', {
  jim: 'Survives Anderson’s attack and discovers how greatly the garrison has been reduced.',
  gray: 'Kills the boatswain and helps turn the assault into a pirate retreat.',
  anderson: 'Falls inside the enclosure while leading the failed attack.',
  joyce: 'Dies at his post from a shot through the log-house.',
  hunter: 'Lies unconscious after being struck down with a musket, beyond Livesey’s power to save.',
  livesey: 'Moves immediately from combat to treating Smollett and Hunter.',
}, { dead: ['anderson', 'joyce', 'hunter'], items: ['weapons'], threads: ['stockade'], motifs: ['death', 'loyalty'], tension: 5, elapsed: 0.02 })

event(22, 'Jim Leaves the Stockade Again', 'While Livesey is away and Smollett rests wounded, Jim takes food and pistols and slips out to find Gunn’s boat.', 'stockade', {
  jim: 'Chooses a private plan over his duty to the garrison and leaves without permission.',
  smollett: 'Remains immobilized by his wounds and unaware that Jim is abandoning his post.',
  trelawney: 'Keeps the reduced garrison secure while the doctor pursues a separate plan.',
}, { items: ['weapons'], threads: ['jim-independence', 'gunn-secret'], motifs: ['secrecy', 'time'], tension: 3, elapsed: 0.3 })
event(22, 'The Coracle Is Launched', 'Jim finds the tiny coracle under the white rock and carries it to the water after dark.', 'coracle-cache', {
  jim: 'Tests the awkward little craft and commits himself to cutting the Hispaniola adrift.',
}, { items: ['coracle', 'weapons'], threads: ['jim-independence'], motifs: ['ships', 'wilderness'], tension: 3, elapsed: 0.08 })

event(23, 'Jim Cuts the Cable', 'Using the current to draw close, Jim saws through the Hispaniola’s anchor cable while Hands and another pirate quarrel aboard.', 'anchorage', {
  jim: 'Works from the tossing coracle and times the final cut to avoid being crushed by the schooner.',
  hands: 'Drinks and quarrels on deck, unaware that the ship is about to drift from the anchorage.',
}, { items: ['coracle'], threads: ['jim-independence', 'ship-control'], motifs: ['time', 'ships'], tension: 5, elapsed: 0.04 })
event(23, 'Ship and Coracle Drift', 'The ebb tide sweeps the Hispaniola seaward and spins Jim’s coracle through the dark anchorage.', 'anchorage', {
  jim: 'Surrenders control to the current and struggles simply to keep the coracle afloat.',
  hands: 'Realizes too late that the schooner is loose and cannot restore order with his companion.',
}, { items: ['coracle'], threads: ['ship-control'], motifs: ['ships', 'wilderness'], tension: 5, elapsed: 0.03 })

event(24, 'Jim Wakes Off the Island', 'After sleeping in the coracle, Jim finds himself outside the island’s surf and works painfully along the rocky coast.', 'coracle-cache', {
  jim: 'Bails, paddles, and studies the breakers for a current that can carry him back toward shelter.',
}, { items: ['coracle'], threads: ['jim-independence', 'ship-control'], motifs: ['wilderness', 'ships'], tension: 4, elapsed: 0.35 })
event(24, 'The Drifting Hispaniola Returns', 'Jim sees the schooner yawing without control and manoeuvres close enough to seize a trailing line.', 'north-inlet', {
  jim: 'Uses the coracle’s last advantage to reach the unattended ship before it can run him down.',
  hands: 'Lies wounded aboard the drifting schooner, unable to manage her alone.',
}, { items: ['coracle'], threads: ['ship-control'], motifs: ['ships', 'time'], tension: 5, elapsed: 0.06 })

event(25, 'Jim Boards the Hispaniola', 'Jim climbs aboard, finds one pirate dead and Israel Hands badly wounded, and claims command of the schooner.', 'ship-deck', {
  jim: 'Raises a pistol, announces himself as captain, and orders Hands to help beach the ship.',
  hands: 'Hides his hostility behind cooperation because he needs Jim to sail and treat his wound.',
}, { items: ['weapons'], threads: ['ship-control', 'jim-independence'], motifs: ['authority', 'performance'], tension: 4, elapsed: 0.02 })
event(25, 'The Jolly Roger Comes Down', 'Jim lowers and throws the pirate colours overboard before cleaning the deck and bringing food to Hands.', 'ship-deck', {
  jim: 'Erases the visible sign of pirate control and tries to impose order on the damaged schooner.',
  hands: 'Studies Jim’s movements, accepts food and drink, and begins planning an ambush.',
}, { items: ['jolly-roger'], threads: ['ship-control'], motifs: ['flags', 'authority'], tension: 3, elapsed: 0.02 })

event(26, 'Hands Guides the Ship North', 'Jim steers under Hands’s directions toward North Inlet, while both pretend their temporary alliance can last.', 'ship-deck', {
  jim: 'Handles the schooner with growing confidence but keeps his loaded pistols close.',
  hands: 'Provides expert sailing directions while secretly recovering a knife from the deck.',
}, { items: ['weapons'], threads: ['ship-control'], motifs: ['performance', 'watching'], tension: 4, elapsed: 0.08 })
event(26, 'Jim Fights from the Rigging', 'As the Hispaniola grounds, Hands attacks; Jim climbs the mast, is wounded, and shoots the pirate into the water.', 'hispaniola-grounded', {
  jim: 'Fires both pistols after Hands pins his shoulder to the mast, surviving his attempt to retake the ship.',
  hands: 'Makes a final knife attack and dies falling from the rigging into North Inlet.',
}, { dead: ['hands'], items: ['weapons'], threads: ['ship-control', 'jim-independence'], motifs: ['violence', 'ships'], tension: 5, elapsed: 0.02 })

event(27, 'Jim Returns by Night', 'Leaving the grounded schooner, Jim crosses the island in darkness and approaches the stockade expecting his friends.', 'stockade', {
  jim: 'Reaches the enclosure exhausted, wounded, and proud of having recovered the Hispaniola.',
}, { threads: ['ship-control', 'stockade'], motifs: ['wilderness', 'home'], tension: 3, elapsed: 0.3 })
event(27, 'The Parrot Gives the Alarm', 'Silver’s parrot cries out in the dark, revealing that the stockade is occupied by pirates who seize Jim.', 'stockade', {
  jim: 'Discovers too late that the garrison has changed hands and surrenders rather than be shot.',
  silver: 'Takes Jim alive and immediately sees value in the boy as hostage and possible ally.',
  parrot: 'Shatters the silence with its familiar cry and exposes Jim’s entrance.',
  merry: 'Surrounds the captive and demands a harsher response than Silver allows.',
  dick: 'Watches the unexpected prisoner while fever begins to weaken him.',
}, { threads: ['silver', 'stockade'], motifs: ['songs', 'watching'], tension: 5, elapsed: 0.01 })

event(28, 'Jim Defies the Pirates', 'Jim admits cutting the ship loose and killing Hands, then warns the pirates that their expedition is failing.', 'stockade', {
  jim: 'Claims responsibility for the pirates’ losses and refuses to beg despite believing death is near.',
  silver: 'Recognizes Jim’s courage and chooses protection over immediate revenge.',
  merry: 'Presses to kill Jim and treats Silver’s restraint as further proof of weak leadership.',
  morgan: 'Supports the hostile majority but hesitates to challenge Silver directly.',
  dick: 'Listens anxiously while illness and superstition erode his confidence.',
}, { threads: ['silver', 'ship-control'], motifs: ['authority', 'performance'], tension: 5, elapsed: 0.01 })
event(28, 'Silver Claims Jim as Hostage', 'Silver tells Jim that Livesey’s party traded away the stockade and map, and privately proposes that they save one another.', 'stockade', {
  jim: 'Accepts Silver’s protection without trusting his explanation of the loyal party’s disappearance.',
  silver: 'Builds a new survival strategy around Jim as witness, hostage, and bargaining counter.',
  merry: 'Withdraws with the other pirates to organize a formal challenge to Silver’s command.',
}, { items: ['treasure-map'], threads: ['silver', 'map'], motifs: ['secrecy', 'performance'], tension: 4, elapsed: 0.01 })

event(29, 'Silver Receives the Black Spot', 'The pirates present Silver with a black spot cut from Dick’s Bible and list the charges against his captaincy.', 'stockade', {
  silver: 'Mocks the procedural errors in the summons and forces his accusers to state every grievance.',
  merry: 'Acts as spokesman for the discontented crew and expects to replace Silver.',
  dick: 'Sacrifices a page of his Bible for the ritual and fears the bad luck of the act.',
  morgan: 'Joins the vote against Silver after the loss of ship, men, and stockade advantage.',
  jim: 'Observes the pirate council from within Silver’s protection.',
}, { items: ['black-spot'], threads: ['silver', 'pirates'], motifs: ['documents', 'authority'], tension: 4, elapsed: 0.02 })
event(29, 'The Map Restores Silver', 'Silver reveals that Livesey gave him Flint’s map, turning the pirates’ anger into excitement and restoring his command.', 'stockade', {
  silver: 'Produces the map at the decisive moment and converts a trial into a renewed treasure hunt.',
  merry: 'Loses the crew’s support when the map answers the strongest charge against Silver.',
  dick: 'Forgets his fever in the immediate promise of finding Flint’s cache.',
  morgan: 'Returns to Silver’s side when the marked crosses appear within reach.',
  jim: 'Realizes that Livesey surrendered the map deliberately and must know something the pirates do not.',
}, { items: ['treasure-map', 'black-spot'], threads: ['map', 'silver', 'gunn-secret'], motifs: ['documents', 'money'], tension: 4, elapsed: 0.01 })

event(30, 'Livesey Treats the Mutineers', 'Livesey arrives under truce, tends the sick and wounded pirates, and preserves his duty as doctor despite their crimes.', 'stockade', {
  livesey: 'Treats fever and wounds while studying Jim’s condition and Silver’s control of the camp.',
  jim: 'Waits for a private word with the doctor but refuses to break the parole Silver grants him.',
  silver: 'Keeps the visit orderly because his crew needs Livesey and Jim’s honour supports his bargain.',
  dick: 'Receives medical attention while visibly deteriorating from fever and fear.',
  merry: 'Distrusts the doctor’s composure but cannot refuse treatment for the crew.',
}, { threads: ['silver', 'gunn-secret'], motifs: ['law', 'loyalty'], tension: 3, elapsed: 0.25 })
event(30, 'Jim Keeps His Parole', 'Alone beyond the fence, Jim tells Livesey how he recovered the ship but refuses the doctor’s invitation to escape.', 'stockade', {
  jim: 'Reports the Hispaniola safe in North Inlet and returns to captivity because he gave Silver his word.',
  livesey: 'Receives the decisive news about the ship and warns Jim that the treasure search contains a hidden danger.',
  silver: 'Allows the private meeting and gains confidence that Jim’s sense of honour will bring him back.',
}, { threads: ['ship-control', 'silver', 'gunn-secret'], motifs: ['loyalty', 'secrecy'], tension: 3, elapsed: 0.01 })

event(31, 'The Treasure Party Sets Out', 'Silver chains Jim to him and leads the reduced pirate band inland using Flint’s map and compass.', 'mizzenmast-hill', {
  jim: 'Walks bound to Silver while looking for signs of Livesey or Ben Gunn in the woods.',
  silver: 'Balances crutch, compass, map, and hostage while driving the pirates toward the marked site.',
  merry: 'Searches eagerly for landmarks and watches for another chance to overthrow Silver.',
  dick: 'Struggles through fever, increasingly frightened by the island and Flint’s memory.',
  morgan: 'Uses his old knowledge of Flint’s habits to interpret the route.',
}, { items: ['treasure-map', 'weapons'], threads: ['map', 'silver'], motifs: ['money', 'wilderness'], tension: 3, elapsed: 0.3 })
event(31, 'The Skeleton Points the Way', 'The party finds a sailor’s skeleton arranged with arms extended toward the treasure bearing.', 'skeleton', {
  jim: 'Recognizes the remains as a deliberate sign of Flint’s cruelty rather than a natural death.',
  silver: 'Uses compass and map to confirm that the bones form a pointer and forces the march onward.',
  merry: 'Tries to dismiss the discovery while remaining unnerved by Flint’s preparation.',
  dick: 'Reads the skeleton as a supernatural warning and clings to his damaged Bible.',
  morgan: 'Identifies the dead man as one of Flint’s old hands and recalls the captain’s violence.',
}, { items: ['treasure-map'], threads: ['map'], motifs: ['death', 'documents'], tension: 4, elapsed: 0.04 })

event(32, 'Flint’s Voice Stops the Pirates', 'A voice singing Flint’s old song echoes through the trees, and the treasure party freezes in terror.', 'treasure-pit', {
  jim: 'Recognizes that a living person may be exploiting the pirates’ superstition from concealment.',
  silver: 'Holds the line through force of will and argues that a ghost would not produce an echo.',
  merry: 'Loses his bravado when the dead captain’s song seems to come from the forest.',
  dick: 'Collapses into prayer and fever, convinced that Flint’s spirit has found them.',
  morgan: 'Remembers the voice and habits of his former captain too clearly to move.',
  gunn: 'Imitates Flint from the trees to delay and frighten the treasure party.',
}, { threads: ['gunn-secret', 'map'], motifs: ['songs', 'performance'], tension: 5, elapsed: 0.03 })
event(32, 'Silver Forces the March Onward', 'When Morgan identifies the voice as Ben Gunn’s, Silver restores momentum and the pirates rush toward the marked pine.', 'treasure-pit', {
  jim: 'Sees fear turn instantly back into greed once Gunn is named as mortal.',
  silver: 'Uses contempt for the maroon to reassert command and keeps Jim close as insurance.',
  merry: 'Recovers enough confidence to race the others toward the treasure ground.',
  dick: 'Follows weakly, still shaken and dependent on the stronger men.',
  morgan: 'Breaks the spell by naming Gunn, a man the crew considers harmless.',
}, { items: ['treasure-map'], threads: ['map', 'silver'], motifs: ['money', 'performance'], tension: 4, elapsed: 0.02 })

event(33, 'The Treasure Pit Is Empty', 'The pirates find a vast excavation with only a broken tool and a few coins; Silver immediately changes sides again.', 'treasure-pit', {
  jim: 'Understands that Livesey gave up a worthless map and waits beside Silver for the pirates’ attack.',
  silver: 'Hands Jim a pistol, steps away from the pit, and prepares to fight the men he led there.',
  merry: 'Realizes the treasure is gone and turns the crew’s fury directly against Silver.',
  dick: 'Stares into the empty hole as hope gives way to feverish panic.',
  morgan: 'Searches the spoil heap for proof that anything valuable remains.',
}, { items: ['treasure-map', 'coins', 'weapons'], threads: ['map', 'silver', 'gunn-secret'], motifs: ['money', 'secrecy'], tension: 5, elapsed: 0.03 })
event(33, 'The Ambush Breaks the Mutiny', 'Livesey, Gray, and Gunn fire from concealment; Merry falls and the surviving pirates flee into the woods.', 'treasure-pit', {
  jim: 'Joins Silver and the hidden loyal party as the balance of power finally reverses.',
  silver: 'Shoots Merry after the ambush and presents himself once more as an ally of the lawful party.',
  merry: 'Dies while leading the final charge against Silver and Jim.',
  livesey: 'Coordinates the ambush that protects Jim and ends organized pirate resistance.',
  gray: 'Fires from cover and advances to secure the empty pit.',
  gunn: 'Reunites with the party after using his knowledge of the treasure to set the trap.',
}, { dead: ['merry'], items: ['weapons'], threads: ['silver', 'gunn-secret'], motifs: ['violence', 'loyalty'], tension: 5, elapsed: 0.01, beat: 'climax' })

event(34, 'Ben Gunn’s Secret Is Revealed', 'At the cave, Livesey explains that Gunn moved Flint’s treasure long ago and that the map was surrendered only after this discovery.', 'ben-gunn-cave', {
  jim: 'Finds the treasure safe and finally understands the doctor’s bargain with Silver.',
  livesey: 'Explains the plan that traded stockade and useless map for time, safety, and control of the cache.',
  gunn: 'Shows the wealth he recovered alone and receives the recognition he sought from the expedition.',
  silver: 'Makes himself useful beside the treasure while judging how securely his latest allegiance will protect him.',
  trelawney: 'Accepts Gunn’s claim to reward and prepares to remove the treasure from the island.',
  gray: 'Guards the cave and the recovered wealth against the remaining pirates.',
}, { items: ['treasure', 'treasure-map', 'ben-boat'], threads: ['gunn-secret', 'map', 'silver'], motifs: ['money', 'secrecy'], tension: 2, elapsed: 0.15 })
event(34, 'The Treasure Is Loaded', 'For days the survivors carry bars and coins from the cave to the Hispaniola, sorting the varied plunder aboard ship.', 'north-inlet', {
  jim: 'Carries coin by coin and confronts the physical weight of the fortune that caused so many deaths.',
  livesey: 'Supervises the work while keeping the diminished party healthy and alert.',
  trelawney: 'Takes possession of the recovered expedition and directs an orderly departure.',
  gray: 'Uses his seamanship and strength to move loads and prepare the schooner for the return voyage.',
  gunn: 'Works tirelessly to transfer the treasure he had hidden and secure his promised passage home.',
  silver: 'Labours cheerfully under guard and waits for a chance to escape with a smaller prize.',
}, { items: ['treasure', 'ben-boat'], threads: ['expedition', 'silver'], motifs: ['money', 'ships'], tension: 2, elapsed: 3 })
event(34, 'The Survivors Sail Home', 'The Hispaniola leaves three surviving mutineers on the island, calls at a Spanish American port where Silver escapes, and returns to England.', 'hispaniola-grounded', {
  jim: 'Leaves the island alive and wealthy but remains haunted by surf and the parrot’s cry.',
  livesey: 'Returns with his patients and companions after maintaining his duties through mutiny and battle.',
  trelawney: 'Completes the expedition with treasure aboard and a far smaller company than he hired.',
  smollett: 'Survives his wounds and relinquishes active command after the voyage home.',
  gray: 'Returns as a trusted seaman and uses his share to advance in his profession.',
  gunn: 'Reaches society again with a reward that he will spend with characteristic speed.',
  silver: 'Escapes at the intermediate port with a bag of coins, avoiding trial and disappearing from the record.',
  parrot: 'Leaves the Hispaniola with Silver, its cry lingering in Jim’s memory.',
}, { items: ['treasure', 'coins'], threads: ['expedition', 'silver'], motifs: ['ships', 'home', 'money'], tension: 2, elapsed: 35, beat: 'resolution' })

const plotThreads = [
  ['map', 'Flint’s Map and Treasure', '#b8873d', 'The papers taken from Billy Bones lead the expedition to Flint’s cache and conceal Gunn’s decisive intervention.'],
  ['silver', 'Silver’s Shifting Allegiance', '#777047', 'Silver moves between trusted cook, mutineer captain, Jim’s protector, and self-interested survivor.'],
  ['pirates', 'Flint’s Former Crew', '#74483f', 'Billy’s old shipmates pursue the papers and later form the core of the Hispaniola mutiny.'],
  ['expedition', 'The Treasure Expedition', '#486f7f', 'Trelawney’s voyage develops from hopeful enterprise into armed survival and eventual return.'],
  ['mutiny', 'The Hispaniola Mutiny', '#8a3f38', 'Silver’s recruited crew prepares, delays, and launches its attempt to seize ship and treasure.'],
  ['authority', 'Lawful Command', '#52667f', 'Livesey and Smollett oppose pirate custom with medical duty, law, discipline, and negotiated terms.'],
  ['stockade', 'The Stockade Siege', '#7b6546', 'The loyal party abandons ship, fortifies Flint’s old enclosure, and survives the pirate assault.'],
  ['jim-independence', 'Jim Acts Alone', '#bc723d', 'Jim’s unsanctioned departures create danger but also recover intelligence, coracle, and ship.'],
  ['gunn-secret', 'Ben Gunn’s Secret', '#827943', 'The maroon’s hints conceal the fact that the treasure has already been moved.'],
  ['ship-control', 'Control of the Hispaniola', '#47758a', 'The schooner passes from Smollett to the mutineers and finally to Jim before enabling the escape.'],
].map(([slug, name, color, description]) => ({ ...base, id: threadId(slug), name, color, description }))

const motifs = [
  ['watching', 'Watching and Eavesdropping', '#596c75', 'Jim repeatedly survives by seeing or hearing what more powerful adults overlook.'],
  ['money', 'Coins and Desire', '#a17e3c', 'Different forms of money expose honesty, greed, fear, and practical ambition.'],
  ['documents', 'Maps, Books, and Marks', '#786348', 'Written objects move power between people while never explaining everything by themselves.'],
  ['ships', 'Ships and Seamanship', '#406b7a', 'Practical knowledge of boats and currents determines who can act on the island.'],
  ['performance', 'Performance and Disguise', '#7d5c51', 'Silver’s friendliness, Pew’s helplessness, and Gunn’s ghostly voice turn acting into power.'],
  ['authority', 'Competing Captains', '#4e5f75', 'Smollett and Silver model opposed forms of command, each tested by frightened followers.'],
  ['law', 'Law, Oaths, and Parole', '#596c58', 'Livesey’s office and Jim’s promise retain force even beyond ordinary institutions.'],
  ['time', 'Deadlines and Timing', '#8d6348', 'The black spot, the mutiny plan, tides, and ambushes all depend on choosing the right moment.'],
  ['violence', 'Sudden Violence', '#8b4541', 'Apparently social encounters can become lethal with almost no warning.'],
  ['death', 'The Dead as Warnings', '#5b5350', 'Bodies, graves, and Flint’s memory direct the choices of the living.'],
  ['home', 'Leaving and Returning Home', '#7b6b56', 'Jim’s adventure begins in a threatened home and ends with wealth shadowed by memory.'],
  ['wilderness', 'Island Wilderness', '#56704f', 'Forest, marsh, surf, and heat resist every attempt to control the island.'],
  ['weapons', 'Arms and Readiness', '#6b6260', 'The placement and possession of weapons repeatedly determine immediate survival.'],
  ['flags', 'Flags and Claims', '#765348', 'The Union Jack and Jolly Roger make competing authority visible.'],
  ['songs', 'Songs and Repeated Voices', '#73634e', 'Shanties and the parrot preserve pirate memory until Gunn turns that memory against the crew.'],
  ['loyalty', 'Loyalty Chosen Under Pressure', '#506b64', 'Gray, Redruth, Jim, and even Silver reveal themselves when allegiance becomes costly.'],
  ['blindness', 'Blindness and Misreading', '#665f5b', 'Pew’s blindness conceals physical power, while other characters repeatedly misread Silver and the purpose of written signs.'],
  ['secrecy', 'Secrets and Partial Knowledge', '#5f596d', 'Maps, overheard plans, hidden boats, and undisclosed bargains distribute knowledge unevenly across the cast.'],
].map(([slug, name, color, description]) => ({ ...base, id: motifId(slug), name, color, description }))

const findThread = slug => threadId(slug)
const findMotif = slug => motifId(slug)
const events = eventDefs.map((entry, index) => ({
  ...base,
  id: id('event', String(index + 1).padStart(3, '0')),
  chapterId: chId(entry.chapter), timelineId, title: entry.title, description: entry.description,
  locationMarkerId: locId(entry.loc), involvedCharacterIds: Object.keys(entry.states).map(charId), mentionedCharacterIds: entry.mentioned.map(charId), involvedItemIds: entry.items.map(itemId),
  tags: [`chapter-${entry.chapter}`], threadIds: entry.threads.map(findThread), motifIds: entry.motifs.map(findMotif), sortOrder: index,
  travelDays: entry.elapsed, inWorldTime: entry.time, tension: entry.tension, structureBeat: entry.beat, status: 'final', povCharacterId: entry.pov ? charId(entry.pov) : null, isFlashback: entry.flashback,
}))
const eventByTitle = new Map(events.map(event => [event.title, event]))
const findEvent = title => {
  const found = eventByTitle.get(title)
  if (!found) throw new Error(`Unknown event title: ${title}`)
  return found.id
}

const characterSnapshots = []
for (const [index, entry] of eventDefs.entries()) {
  const eventRow = events[index]
  for (const [sortKey, [slug, statusNotes]] of Object.entries(entry.states).entries()) {
    const location = locationMarkers.find(row => row.id === eventRow.locationMarkerId)
    characterSnapshots.push({ ...base, id: id('snapshot', `${index + 1}-${slug}`), characterId: charId(slug), eventId: eventRow.id, isAlive: !entry.dead.includes(slug), currentLocationMarkerId: eventRow.locationMarkerId, currentMapLayerId: location.mapLayerId, inventoryItemIds: [], inventoryNotes: '', travelModeId: null, sortKey, statusNotes })
  }
}

const relationshipDefs = [
  ['jim', 'mother', 'son and mother', 5, 'positive', 'Their practical affection anchors Jim’s departure and his idea of home.', true, 'The Captain Takes a Room'],
  ['jim', 'livesey', 'young ally and mentor', 4, 'positive', 'Livesey trusts Jim with information and Jim measures honour partly by the doctor’s example.', true, 'Flint’s Account Is Read'],
  ['jim', 'silver', 'protégé, enemy, and uneasy ally', 5, 'mixed', 'Mutual fascination survives betrayal; each repeatedly becomes useful to the other’s survival.', true, 'Jim Meets Long John Silver'],
  ['jim', 'gunn', 'discoverer and ally', 4, 'positive', 'Jim is the first expedition member to hear Gunn’s offer and connect him to the loyal party.', true, 'Jim Meets Ben Gunn'],
  ['jim', 'smollett', 'cabin boy and captain', 3, 'positive', 'Smollett values Jim’s intelligence but condemns his repeated departures from duty.', false, 'Smollett States His Objections'],
  ['livesey', 'trelawney', 'friends and expedition partners', 4, 'positive', 'The doctor supplies restraint and strategy while the squire supplies money, resolve, and marksmanship.', true, 'Flint’s Account Is Read'],
  ['livesey', 'smollett', 'strategic allies', 5, 'positive', 'They combine medical judgment and professional command throughout the mutiny.', true, 'Smollett States His Objections'],
  ['trelawney', 'smollett', 'owner and captain', 3, 'mixed', 'Initial resentment gives way to respect when Smollett’s warnings prove correct.', false, 'Smollett States His Objections'],
  ['trelawney', 'redruth', 'master and faithful servant', 5, 'positive', 'Redruth follows the squire from home to the stockade and dies in his service.', false, 'Jim Leaves the Admiral Benbow'],
  ['silver', 'parrot', 'keeper and companion', 4, 'positive', 'The parrot reinforces Silver’s public identity and carries the language of Flint’s old crew.', false, 'Jim Meets Long John Silver'],
  ['silver', 'hands', 'mutiny leaders', 3, 'mixed', 'Hands supports the conspiracy but presses for quicker violence than Silver initially wants.', true, 'Silver Explains His Plan'],
  ['silver', 'merry', 'captain and challenger', 4, 'negative', 'Merry repeatedly converts pirate frustration into an attempt to depose or kill Silver.', false, 'The Parrot Gives the Alarm'],
  ['silver', 'gunn', 'former shipmates and enemies', 3, 'negative', 'Silver dismisses the maroon until Gunn’s secret and mimicry undo the treasure hunt.', true, 'Jim Meets Ben Gunn'],
  ['smollett', 'gray', 'captain and loyal sailor', 5, 'positive', 'Smollett’s appeal lets Gray choose duty, and Gray becomes essential to the defence.', false, 'Smollett Calls the Loyal Hands'],
  ['billy', 'pew', 'former shipmates and pursuers', 4, 'negative', 'Pew enforces the old crew’s claim to Flint’s papers after Billy hides them.', false, 'Pew Delivers the Black Spot'],
  ['billy', 'black-dog', 'former shipmates and rivals', 4, 'negative', 'Their shared history under Flint erupts into threats and swordplay at the inn.', true, 'Black Dog Confronts the Captain'],
  ['silver', 'flint', 'former quartermaster and dead captain', 5, 'mixed', 'Silver exploits Flint’s reputation while remaining alert to the fear it inspires in old shipmates.', false, 'Silver Explains His Plan'],
]
const relationships = relationshipDefs.map(([a, b, label, strength, sentiment, description, isBidirectional, start]) => ({ ...base, id: id('relationship', `${a}-${b}`), characterAId: charId(a), characterBId: charId(b), label, strength, sentiment, description, isBidirectional, startEventId: findEvent(start) }))

const placementDefs = [
  ['sea-chest', 'The Captain Takes a Room', 'admiral-benbow', 'Billy has the chest carried to his upstairs room.'],
  ['black-spot', 'Pew Delivers the Black Spot', 'admiral-benbow', 'Pew presses the summons into Billy’s hand.'],
  ['oilskin', 'The Sea Chest Is Opened', 'admiral-benbow', 'Jim removes the packet before the raiders arrive.'],
  ['logbook', 'Flint’s Account Is Read', 'livesey-house', 'Livesey and Trelawney decode the account at the doctor’s table.'],
  ['treasure-map', 'The Treasure Map Is Revealed', 'livesey-house', 'The island map becomes the expedition’s guarded secret.'],
  ['weapons', 'Arms Are Shifted Aft', 'ship-hold', 'Smollett moves the arms close to the trusted berths.'],
  ['powder', 'Arms Are Shifted Aft', 'ship-hold', 'The powder is separated from the suspect crew.'],
  ['spyglass', 'Jim Meets Long John Silver', 'spyglass', 'Silver keeps a telescope suited to a waterfront sea-cook.'],
  ['union-jack', 'The Flag Is Raised', 'stockade', 'Smollett flies the flag above the log-house.'],
  ['coracle', 'The Coracle Is Launched', 'coracle-cache', 'Jim carries Gunn’s hidden craft down to the water.'],
  ['jolly-roger', 'The Jolly Roger Comes Down', 'ship-deck', 'Jim removes the pirate colours from the recovered schooner.'],
  ['treasure-map', 'The Map Restores Silver', 'stockade', 'Silver reveals the chart to the mutineers.'],
  ['treasure', 'Ben Gunn’s Secret Is Revealed', 'ben-gunn-cave', 'Gunn has stacked Flint’s recovered cache inside the cave.'],
  ['treasure', 'The Treasure Is Loaded', 'north-inlet', 'The treasure is transferred to the Hispaniola for the return voyage.'],
]
const itemPlacements = placementDefs.map(([item, title, loc, notes], index) => ({ ...base, id: id('placement', String(index + 1)), itemId: itemId(item), eventId: findEvent(title), locationMarkerId: locId(loc), sortKey: index, notes }))

const factionDefs = [
  ['loyal-party', 'The Loyal Party', 'Smollett’s officers, Trelawney’s servants, Jim, and the sailors who uphold the expedition after the mutiny.', '#486979', 'smollett'],
  ['mutineers', 'The Hispaniola Mutineers', 'Silver’s recruited pirates and wavering seamen, united by the hope of taking Flint’s treasure and the ship.', '#8a4b3c', 'mutiny'],
  ['flint-crew', 'Captain Flint’s Former Crew', 'The scattered survivors of Flint’s piratical company, whose past violence creates the novel’s map, grudges, and rituals.', '#5f5145', 'treasure'],
  ['hawkins-household', 'The Hawkins Household', 'The family and inn exposed to Billy Bones’s presence at the Admiral Benbow.', '#7d684e', 'departure'],
]
const factions = factionDefs.map(([slug, name, description, color, artwork]) => ({ ...base, id: id('faction', slug), name, description, color, coverImageId: imageId(artwork), tags: [] }))
const membershipDefs = [
  ['hawkins-household', 'jim', 'son and assistant', 'The Captain Takes a Room', 'Jim Leaves the Admiral Benbow'],
  ['hawkins-household', 'mother', 'innkeeper', 'The Captain Takes a Room', null],
  ['hawkins-household', 'father', 'innkeeper', 'The Captain Takes a Room', 'Jim Loses His Father'],
  ['flint-crew', 'billy', 'former mate and map keeper', 'The Captain Takes a Room', 'Billy Bones Dies'],
  ['flint-crew', 'black-dog', 'former pirate', 'Black Dog Confronts the Captain', null],
  ['flint-crew', 'pew', 'former pirate and messenger', 'Pew Delivers the Black Spot', 'Pew Is Run Down'],
  ['flint-crew', 'silver', 'former quartermaster', 'Silver Explains His Plan', null],
  ['flint-crew', 'hands', 'former gunner', 'Silver Explains His Plan', 'Jim Fights from the Rigging'],
  ['flint-crew', 'gunn', 'former pirate and maroon', 'Jim Meets Ben Gunn', null],
  ['flint-crew', 'morgan', 'former pirate', 'Silver Explains His Plan', null],
  ['loyal-party', 'jim', 'cabin boy and scout', 'Jim Leaves the Admiral Benbow', null],
  ['loyal-party', 'livesey', 'doctor and strategist', 'Flint’s Account Is Read', null],
  ['loyal-party', 'trelawney', 'financier and marksman', 'Flint’s Account Is Read', null],
  ['loyal-party', 'smollett', 'captain', 'Smollett States His Objections', null],
  ['loyal-party', 'redruth', 'servant and defender', 'Jim Leaves the Admiral Benbow', 'Redruth Falls in the Retreat'],
  ['loyal-party', 'gray', 'able seaman', 'Smollett Calls the Loyal Hands', null],
  ['loyal-party', 'hunter', 'servant and defender', 'Livesey Finds the Stockade', 'The Defenders Hold'],
  ['loyal-party', 'joyce', 'servant and defender', 'The Jolly-boat Is Overloaded', 'The Defenders Hold'],
  ['mutineers', 'silver', 'captain and organizer', 'Silver Explains His Plan', 'The Ambush Breaks the Mutiny'],
  ['mutineers', 'hands', 'coxswain', 'Silver Explains His Plan', 'Jim Fights from the Rigging'],
  ['mutineers', 'anderson', 'boatswain', 'Silver Explains His Plan', 'The Defenders Hold'],
  ['mutineers', 'merry', 'challenger', 'The Crew Goes Ashore', 'The Ambush Breaks the Mutiny'],
  ['mutineers', 'dick', 'young recruit', 'Silver Explains His Plan', null],
  ['mutineers', 'morgan', 'pirate', 'Silver Explains His Plan', null],
]
const factionMemberships = membershipDefs.map(([faction, character, role, start, end], index) => ({ ...base, id: id('membership', String(index + 1)), factionId: id('faction', faction), characterId: charId(character), role, startEventId: findEvent(start), endEventId: end ? findEvent(end) : null, notes: '' }))
const factionRelationships = [
  { ...base, id: id('faction-relationship', 'loyal-mutineers'), factionAId: id('faction', 'loyal-party'), factionBId: id('faction', 'mutineers'), stance: 'hostile', notes: 'Open conflict begins when Jim reveals the apple-barrel conspiracy.' },
  { ...base, id: id('faction-relationship', 'flint-mutineers'), factionAId: id('faction', 'flint-crew'), factionBId: id('faction', 'mutineers'), stance: 'legacy', notes: 'Silver builds the new mutiny around veterans, rituals, and ambitions inherited from Flint.' },
  { ...base, id: id('faction-relationship', 'hawkins-flint'), factionAId: id('faction', 'hawkins-household'), factionBId: id('faction', 'flint-crew'), stance: 'hostile', notes: 'Billy’s pursuers bring Flint’s unfinished business into the Hawkins family inn.' },
]

const loreCategories = [
  ['sources', 'Sources and Artwork', '#756454', 0],
  ['piracy', 'Pirate Customs', '#70483e', 1],
  ['seamanship', 'Ships and Navigation', '#426979', 2],
  ['places', 'Places and Climate', '#5f704d', 3],
  ['history', 'Earlier History', '#5e5966', 4],
].map(([slug, name, color, sortOrder]) => ({ id: id('lore-category', slug), worldId, name, color, sortOrder }))
const loreDefs = [
  ['sources', 'Linked Artwork and Maps', 'The cover and principal illustrations are public-domain works by N. C. Wyeth and Walter Paget from historical editions of Treasure Island. The island chart reproduces Stevenson’s 1883 map; Bristol uses a public-domain harbour map, and the Hispaniola layer uses a historical schooner plan as an editorial spatial aid.', 'cover', ['world'], 'The Captain Takes a Room'],
  ['sources', 'Editorial Chronology', 'The novel does not identify a definitive calendar year for Jim’s adventure. The 1760 dates and intervals used here are an editorial reconstruction based on the order and approximate durations stated in the narrative; they are not presented as canonical dates.', 'map-atlantic', ['world'], 'The Captain Takes a Room'],
  ['piracy', 'The Black Spot', 'Flint’s former crew uses a circular paper token as a formal notice of judgment or removal. Its power depends entirely on shared pirate custom and the recipient’s fear of collective action.', 'black-spot', ['item:black-spot'], 'Pew Delivers the Black Spot'],
  ['piracy', 'Shares and Pirate Articles', 'Silver’s followers think in negotiated shares, elected leadership, and collective accusation, even while violence repeatedly overrides their procedures.', 'mutiny', ['faction:mutineers'], 'Silver Explains His Plan'],
  ['seamanship', 'The Hispaniola', 'A schooner requires coordinated watches, sail handling, steering, anchoring, and knowledge of tide. Once discipline collapses, even possession of the ship does not guarantee control.', 'chapter-10', ['map:hispaniola'], 'The Hispaniola Sails'],
  ['seamanship', 'The Coracle', 'Gunn’s small hide-covered boat is light and concealable but turns readily and offers almost no protection from current or surf.', 'gunn', ['item:coracle'], 'The Coracle Is Launched'],
  ['places', 'The Island’s Unhealthy Ground', 'The low eastern anchorage combines heat, stagnant water, and marsh. The higher cave and spring-fed stockade offer safer positions.', 'map-island', ['map:island'], 'Land Is Sighted'],
  ['places', 'Bristol and Atlantic Trade', 'The expedition departs from a port capable of supplying a ship, arms, food, and a large pool of experienced sailors, honest and otherwise.', 'departure', ['map:bristol'], 'The Hispaniola Is Ready'],
  ['history', 'Captain Flint’s Last Voyage', 'Before the novel begins, Flint buries a vast cache on the island, kills the men who helped him, and leaves a map and remembered trail of terror.', 'treasure', ['character:flint', 'item:treasure'], 'Flint’s Account Is Read'],
  ['history', 'Ben Gunn’s Marooning', 'Gunn returns to the island with another crew, fails to find the treasure, and is abandoned with minimal supplies. Three solitary years reshape him into both comic survivor and strategic power.', 'gunn', ['character:gunn'], 'Jim Meets Ben Gunn'],
  ['piracy', 'Songs, Parrots, and Memory', 'Fragments of pirate language outlive their original setting. Silver’s parrot and Gunn’s imitation of Flint turn repeated words into instruments of identity and fear.', 'parrot', ['character:parrot'], 'Silver Teaches Jim Seamanship'],
]
const resolveEntity = token => {
  const [kind, slug] = token.split(':')
  if (!slug) return worldId
  if (kind === 'item') return itemId(slug)
  if (kind === 'character') return charId(slug)
  if (kind === 'map') return mapId(slug)
  if (kind === 'faction') return id('faction', slug)
  return worldId
}
const lorePages = loreDefs.map(([category, title, body, artwork, links, visible], index) => ({ ...base, id: id('lore-page', String(index + 1)), categoryId: id('lore-category', category), title, body, tags: [], coverImageId: imageId(artwork), linkedEntityIds: links.map(resolveEntity), visibleFromEventId: findEvent(visible) }))

const knowledgeDefs = [
  ['billy-papers', 'Billy possesses Flint’s papers', 'Billy’s sea chest contains the documents sought by his former shipmates.', 'The Sea Chest Is Opened'],
  ['island-map', 'The packet contains a treasure map', 'Flint’s chart identifies an island and marked cache with bearings.', 'The Treasure Map Is Revealed'],
  ['crew-informed', 'The crew knows the voyage’s purpose', 'Smollett learns that the supposed secret has spread through the ship.', 'Smollett States His Objections'],
  ['silver-leader', 'Silver leads the conspiracy', 'The trusted cook is the mutiny’s organizer and strategist.', 'Silver Explains His Plan'],
  ['mutiny-timing', 'The pirates plan to wait for the treasure', 'Silver intends to use the loyal party to find and load the cache before seizing control.', 'Silver Explains His Plan'],
  ['gunn-boat', 'Ben Gunn has a hidden coracle', 'The maroon keeps a tiny boat concealed beneath the white rock.', 'Ben Gunn Offers a Bargain'],
  ['stockade', 'The island has a defensible stockade', 'Flint’s old log-house has a spring and clear fields of fire.', 'Livesey Finds the Stockade'],
  ['jim-ship', 'Jim recovered the Hispaniola', 'The schooner lies grounded and hidden in North Inlet under Jim’s control.', 'Jim Keeps His Parole'],
  ['map-useless', 'Livesey surrendered the map deliberately', 'The doctor could safely give Silver the chart because its marked cache no longer held the treasure.', 'The Treasure Pit Is Empty'],
  ['gunn-treasure', 'Ben Gunn moved Flint’s treasure', 'During his marooning Gunn found the cache and carried it to his cave.', 'Ben Gunn’s Secret Is Revealed'],
]
const knowledgeFacts = knowledgeDefs.map(([slug, title, description, learned]) => ({ ...base, id: id('fact', slug), title, description, tags: [], readerLearnsAtEventId: findEvent(learned), originEventId: findEvent(learned) }))
const revealDefs = [
  ['billy-papers', 'jim', 'The Sea Chest Is Opened', 'Jim finds and removes the packet from Billy’s chest.'],
  ['island-map', 'jim', 'The Treasure Map Is Revealed', 'Jim sees the marked chart opened at Livesey’s house.'],
  ['island-map', 'livesey', 'The Treasure Map Is Revealed', 'Livesey reads the bearings and recognizes the expedition’s goal.'],
  ['island-map', 'trelawney', 'The Treasure Map Is Revealed', 'Trelawney sees the proof needed to fund the voyage.'],
  ['crew-informed', 'smollett', 'Smollett States His Objections', 'The captain reports that the crew openly knows the destination and treasure.'],
  ['crew-informed', 'livesey', 'Smollett States His Objections', 'Livesey accepts the captain’s evidence of leaked secrecy.'],
  ['silver-leader', 'jim', 'Silver Explains His Plan', 'Jim hears Silver directing and educating the conspirators.'],
  ['mutiny-timing', 'jim', 'Silver Explains His Plan', 'The apple-barrel council reveals when the pirates intend to strike.'],
  ['silver-leader', 'livesey', 'Jim Warns the Leaders', 'Jim identifies Silver as the conspiracy’s centre.'],
  ['silver-leader', 'smollett', 'Jim Warns the Leaders', 'The captain learns which trusted crewman actually leads the mutiny.'],
  ['mutiny-timing', 'trelawney', 'Jim Warns the Leaders', 'Jim’s report explains why the mutineers have not yet attacked.'],
  ['gunn-boat', 'jim', 'Ben Gunn Offers a Bargain', 'Gunn points Jim toward the hidden coracle.'],
  ['stockade', 'livesey', 'Livesey Finds the Stockade', 'The doctor personally inspects the fortification and spring.'],
  ['jim-ship', 'livesey', 'Jim Keeps His Parole', 'Jim tells the doctor where he grounded the recovered schooner.'],
  ['map-useless', 'jim', 'The Treasure Pit Is Empty', 'The empty excavation explains why Livesey could relinquish the chart.'],
  ['gunn-treasure', 'jim', 'Ben Gunn’s Secret Is Revealed', 'The cache in the cave resolves Gunn’s earlier hints.'],
  ['gunn-treasure', 'trelawney', 'Ben Gunn’s Secret Is Revealed', 'Trelawney sees that Gunn has already completed the expedition’s central task.'],
]
const knowledgeReveals = revealDefs.map(([fact, character, title, note], index) => ({ ...base, id: id('reveal', String(index + 1)), factId: id('fact', fact), characterId: charId(character), eventId: findEvent(title), note }))

const goalDefs = [
  ['jim', 'The Captain Takes a Room', 'The Survivors Sail Home', 'want', 'Protect his family, understand the pirates’ secret, and return from the expedition on his own terms.'],
  ['jim', 'Silver Explains His Plan', 'The Ambush Breaks the Mutiny', 'fear', 'Prevent Silver’s crew from killing the loyal party and taking the Hispaniola.'],
  ['silver', 'Jim Meets Long John Silver', 'The Survivors Sail Home', 'want', 'Secure wealth and freedom while remaining indispensable to whichever side controls his survival.'],
  ['silver', 'The Parrot Gives the Alarm', 'The Ambush Breaks the Mutiny', 'fear', 'Avoid deposition by his own men and execution by the lawful party.'],
  ['livesey', 'The Treasure Map Is Revealed', 'The Survivors Sail Home', 'want', 'Bring the expedition through piracy, illness, and injury without abandoning medical or legal duty.'],
  ['trelawney', 'The Treasure Map Is Revealed', 'The Treasure Is Loaded', 'want', 'Finance and complete the recovery of Flint’s treasure.'],
  ['smollett', 'Smollett States His Objections', 'The Survivors Sail Home', 'want', 'Preserve lawful command of the ship and protect the people entrusted to him.'],
  ['gunn', 'Jim Meets Ben Gunn', 'The Survivors Sail Home', 'want', 'Trade his island secret for rescue, food, respectability, and a fair reward.'],
  ['merry', 'The Parrot Gives the Alarm', 'The Ambush Breaks the Mutiny', 'want', 'Replace Silver and take direct control of the treasure hunt.'],
  ['mother', 'The Village Refuses Help', 'The Sea Chest Is Opened', 'want', 'Recover only the lawful debt owed to the inn and keep Jim alive.'],
]
const characterGoals = goalDefs.map(([character, start, end, type, text], index) => ({ ...base, id: id('goal', String(index + 1)), characterId: charId(character), startEventId: findEvent(start), endEventId: findEvent(end), type, text }))

const mapRoutes = [
  { ...base, id: id('route', 'bristol-outfitting'), mapLayerId: mapId('bristol'), name: 'Jim’s Bristol Arrival', routeType: 'foot', waypoints: [locId('trelawney-lodgings'), locId('spyglass'), locId('bristol-quay'), locId('ship-berth')], color: '#b07d42', notes: 'Jim moves from the squire’s preparations through Silver’s tavern to the waiting ship.' },
  { ...base, id: id('route', 'ship-control'), mapLayerId: mapId('hispaniola'), name: 'Control of the Hispaniola', routeType: 'foot', waypoints: [locId('apple-barrel'), locId('ship-roundhouse'), locId('ship-hold'), locId('ship-deck'), locId('ship-cabin')], color: '#48788b', notes: 'Key spaces in the conspiracy, defensive preparations, and Jim’s recovery of the schooner.' },
  { ...base, id: id('route', 'jim-island'), mapLayerId: mapId('island'), name: 'Jim’s Island Adventures', routeType: 'foot', waypoints: [locId('anchorage'), locId('alan-site'), locId('tom-site'), locId('ben-gunn-cave'), locId('stockade'), locId('coracle-cache'), locId('north-inlet')], color: '#b0673d', notes: 'Jim’s unsanctioned route from first landing through his meetings, return, and sea adventure.' },
  { ...base, id: id('route', 'treasure-hunt'), mapLayerId: mapId('island'), name: 'The Final Treasure Hunt', routeType: 'foot', waypoints: [locId('stockade'), locId('mizzenmast-hill'), locId('skeleton'), locId('treasure-pit'), locId('ben-gunn-cave')], color: '#8c783d', notes: 'Silver’s party follows Flint’s directions to the empty pit before the survivors reach Gunn’s real cache.' },
]

const months = [
  ['January', 31], ['February', 28], ['March', 31], ['April', 30], ['May', 31], ['June', 30],
  ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31],
].map(([name, days]) => ({ name, days }))

const data = {
  version: 16, type: 'worldbreaker-export', exportedAt: now,
  world: { id: worldId, name: 'Treasure Island', description: 'Jim Hawkins follows a dead pirate’s map from a threatened coastal inn to the Hispaniola and a remote island, where buried wealth draws honest sailors, mutineers, and survivors into a contest of courage, seamanship, loyalty, and shifting command.', coverImageId: imageId('cover'), theme: 'theme-western', readingMode: true, createdAt: now, updatedAt: now, continuityStaleThreshold: 5, calendar: { startYear: 1760, yearSuffix: ' (editorial chronology)', months }, wordTarget: null },
  mapLayers, locationMarkers, characters, items, characterSnapshots, characterMovements: [], itemPlacements, locationSnapshots: [], itemSnapshots: [], relationships, relationshipSnapshots: [],
  timelines: [{ id: timelineId, worldId, name: 'Treasure Island — Master Chronology', description: 'A single reading-order timeline following Jim’s account, with the doctor’s chapters kept in their chronological place rather than split into a separate route.', color: '#b1783f', dayOffset: 0, createdAt: now }],
  chapters, events, blobs, travelModes: [], timelineRelationships: [], crossTimelineArtifacts: [], mapRoutes, mapRegions: [], mapRegionSnapshots: [], mapAnnotations: [],
  loreCategories, lorePages, factions, factionMemberships, factionRelationships, knowledgeFacts, knowledgeReveals, characterGoals, sceneTexts: [], plotThreads, motifs, continuitySuppressions: [], writingLogs: [], sceneRevisions: [],
}

const collectionIds = new Map()
for (const [key, value] of Object.entries(data)) {
  if (!Array.isArray(value)) continue
  for (const row of value) {
    if (!row.id) continue
    if (collectionIds.has(row.id)) throw new Error(`Duplicate id ${row.id} in ${key} and ${collectionIds.get(row.id)}`)
    collectionIds.set(row.id, key)
  }
}
const assertRef = (value, collection, label) => {
  if (value != null && !new Set(collection.map(row => row.id)).has(value)) throw new Error(`${label}: missing ${value}`)
}
events.forEach(row => {
  assertRef(row.chapterId, chapters, `${row.id}.chapterId`)
  assertRef(row.timelineId, data.timelines, `${row.id}.timelineId`)
  assertRef(row.locationMarkerId, locationMarkers, `${row.id}.location`)
  row.involvedCharacterIds.forEach(value => assertRef(value, characters, `${row.id}.character`))
  row.mentionedCharacterIds.forEach(value => assertRef(value, characters, `${row.id}.mentioned`))
  row.involvedItemIds.forEach(value => assertRef(value, items, `${row.id}.item`))
  row.threadIds.forEach(value => assertRef(value, plotThreads, `${row.id}.thread`))
  row.motifIds.forEach(value => assertRef(value, motifs, `${row.id}.motif`))
  if (!Number.isInteger(row.tension) || row.tension < 1 || row.tension > 5) throw new Error(`${row.id}: tension`)
  if (!Number.isFinite(row.travelDays) || row.travelDays < 0) throw new Error(`${row.id}: elapsed time`)
})
characterSnapshots.forEach(row => {
  assertRef(row.characterId, characters, `${row.id}.character`)
  assertRef(row.eventId, events, `${row.id}.event`)
  assertRef(row.currentLocationMarkerId, locationMarkers, `${row.id}.location`)
  const eventRow = events.find(event => event.id === row.eventId)
  if (!eventRow.involvedCharacterIds.includes(row.characterId)) throw new Error(`${row.id}: absent character snapshot`)
})
if (chapters.length !== 34 || new Set(events.map(row => row.chapterId)).size !== 34) throw new Error('Every chapter must contain events')
for (const eventRow of events) {
  const snapshots = characterSnapshots.filter(row => row.eventId === eventRow.id)
  if (snapshots.length !== eventRow.involvedCharacterIds.length) throw new Error(`${eventRow.id}: snapshot count`)
  if (new Set(snapshots.map(row => row.statusNotes.toLowerCase())).size !== snapshots.length) throw new Error(`${eventRow.id}: repeated status`) 
}
mapLayers.forEach(row => assertRef(row.imageId, blobs, `${row.id}.image`))
locationMarkers.forEach(row => {
  assertRef(row.mapLayerId, mapLayers, `${row.id}.map`)
  assertRef(row.linkedMapLayerId, mapLayers, `${row.id}.linkedMap`)
  assertRef(row.imageId, blobs, `${row.id}.image`)
})
characters.forEach(row => assertRef(row.portraitImageId, blobs, `${row.id}.portrait`))
items.forEach(row => assertRef(row.imageId, blobs, `${row.id}.image`))

const text = `${JSON.stringify(data, null, 2)}\n`
fs.writeFileSync('example/Treasure Island.pwk', text)
fs.writeFileSync('public/library/treasure-island.pwk', text)
console.log(JSON.stringify({ chapters: chapters.length, events: events.length, characters: characters.length, snapshots: characterSnapshots.length, locations: locationMarkers.length, maps: mapLayers.length, items: items.length, relationships: relationships.length, lore: lorePages.length, factions: factions.length, facts: knowledgeFacts.length }, null, 2))
