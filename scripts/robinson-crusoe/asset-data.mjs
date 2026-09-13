export const assetNumber = {
  world: 15,
  characters: {
    crusoe: 141, father: 32, mother: 92, friend: 26, "guinea-captain": 25,
    "sallee-master": 115, xury: 31, moor: 30, "portuguese-captain": 128,
    wells: 43, planters: 112, "ship-crew": 33, "carib-raiders": 108,
    friday: 117, spaniard: 113, "friday-father": 119, "english-captain": 120,
    mate: 100, passenger: 116, mutineers: 101, boatswain: 96,
    "will-atkins": 103, guide: 137, widow: 121,
  },
  locations: {
    "york-home": 105, "north-sea": 27, "yarmouth-roads": 123, london: 129,
    "guinea-coast": 20, sallee: 111, "sallee-harbor": 124, "african-coast": 4,
    "atlantic-passage": 130, "brazil-plantation": 126, "island-gateway": 35,
    "wreck-site": 36, "island-shore": 37, "island-castle": 75,
    "country-bower": 50, "island-interior": 48, cornfields: 104,
    "great-canoe": 45, "island-coast": 52, "goat-pasture": 63,
    "boat-harbor": 59, "footprint-beach": 61, "hidden-pasture": 62,
    "cannibal-shore": 68, "lookout-hill": 65, "hidden-cave": 66,
    "spanish-wreck": 84, "friday-rescue-shore": 72, "boat-yard": 58,
    "mutineer-landing": 86, "english-ship": 122, lisbon: 118,
    "iberian-road": 135, pyrenees: 90, england: 97,
  },
};

export const markerCoordinates = {
  world: {
    "york-home": [1376, 102], "north-sea": [1415, 112], "yarmouth-roads": [1395, 132],
    london: [1362, 145], "guinea-coast": [1280, 610], sallee: [1338, 360],
    "sallee-harbor": [1320, 375], "african-coast": [1210, 515],
    "atlantic-passage": [970, 515], "brazil-plantation": [570, 770],
    "island-gateway": [610, 638], "english-ship": [1050, 430], lisbon: [1288, 285],
    "iberian-road": [1328, 270], pyrenees: [1382, 248], england: [1355, 118],
  },
  island: {
    "wreck-site": [900, 345], "island-shore": [830, 610], "island-castle": [690, 535],
    "country-bower": [470, 420], "island-interior": [430, 650], cornfields: [630, 790],
    "great-canoe": [790, 710], "island-coast": [875, 1000], "goat-pasture": [525, 850],
    "boat-harbor": [775, 780], "footprint-beach": [620, 1190], "hidden-pasture": [420, 930],
    "cannibal-shore": [250, 1100], "lookout-hill": [315, 300], "hidden-cave": [245, 850],
    "spanish-wreck": [925, 330], "friday-rescue-shore": [310, 1080],
    "boat-yard": [735, 770], "mutineer-landing": [770, 1115],
  },
};

export const itemImageFile = {
  "guinea-gold": "item-guinea-gold.png",
  "escape-longboat": "item-escape-longboat.png",
  firearms: "item-firearms.png",
  gunpowder: "item-gunpowder.png",
  tools: "item-tools.png",
  "calendar-post": "item-calendar-post.png",
  journal: "item-journal.png",
  bible: "item-bible.png",
  grain: "item-grain.png",
  goatskins: "item-goatskins.png",
  "seaworthy-canoe": "item-seaworthy-canoe.png",
  "plantation-accounts": "item-plantation-accounts.png",
};

const values = [assetNumber.world, ...Object.values(assetNumber.characters), ...Object.values(assetNumber.locations)];
if (new Set(values).size !== values.length) throw new Error("Every non-map entity must use a distinct illustration");

export const pagetFile = (number) => `paget-${String(number).padStart(3, "0")}.jpg`;
