import { characterDefs, locationDefs } from "./world-data.mjs";

export const assetNumber = { world: 15 };

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

export const characterImageFile = Object.fromEntries(
  characterDefs.map(([slug]) => [slug, `character-${slug}.jpg`]),
);

export const locationImageFile = Object.fromEntries(
  locationDefs.map(([slug]) => [slug, `location-${slug}.jpg`]),
);

export const pagetFile = (number) => `paget-${String(number).padStart(3, "0")}.jpg`;
